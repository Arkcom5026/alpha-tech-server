// scripts/backfillCatalogSlugs.js
// Legacy maintenance script.
//
// ProductType no longer uses slug as runtime identity and must not be backfilled here.
// Keep this script only for legacy models that still own slug independently.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const toSpaces = (s = '') => s.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
const stripPunct = (s = '') => s.replace(/[^\p{L}\p{N}\s.]/gu, '');
const normalizeName = (raw = '') => toSpaces(stripPunct(String(raw).normalize('NFC'))).toLowerCase();
const slugify = (raw = '') =>
  normalizeName(raw).replace(/\./g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

async function backfill({ table, id, parentKey }) {
  const rows = await prisma[table].findMany({
    select: { [id]: true, name: true, normalizedName: true, slug: true, [parentKey]: true },
  });

  const byParent = new Map();
  for (const row of rows) {
    const parentId = row[parentKey] ?? 0;
    if (!byParent.has(parentId)) byParent.set(parentId, new Set());
  }

  for (const row of rows) {
    const parentId = row[parentKey] ?? 0;
    const used = byParent.get(parentId);
    const normalizedName = row.normalizedName || normalizeName(row.name || '');
    const baseSlug = row.slug || slugify(row.name || '') || `${table}-${row[id]}`;
    let candidate = baseSlug;
    let suffix = 2;

    while (used.has(candidate)) candidate = `${baseSlug}-${suffix++}`;
    used.add(candidate);

    await prisma[table].update({
      where: { [id]: row[id] },
      data: { normalizedName: normalizedName || null, slug: candidate || null },
    });
  }
}

(async () => {
  try {
    console.log('Skipping ProductType: ProductType.slug is deprecated.');

    console.log('Backfilling ProductProfile...');
    await backfill({ table: 'productProfile', id: 'id', parentKey: 'productTypeId' });

    console.log('Backfilling ProductTemplate...');
    await backfill({ table: 'productTemplate', id: 'id', parentKey: 'productProfileId' });

    console.log('Done');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
