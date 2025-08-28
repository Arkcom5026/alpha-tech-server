// scripts/backfillCatalogSlugs.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const toSpaces = (s='') => s.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
const stripPunct = (s='') => s.replace(/[^\p{L}\p{N}\s.]/gu, '');
const normalizeName = (raw='') => toSpaces(stripPunct(String(raw).normalize('NFC'))).toLowerCase();
const slugify = (raw='') =>
  normalizeName(raw).replace(/\./g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');

async function backfill({ table, id, parentKey }) {
  const rows = await prisma[table].findMany({
    select: { [id]: true, name: true, normalizedName: true, slug: true, [parentKey]: true },
  });

  // ทำ slug ให้ unique ต่อ parent (normalizedName ไม่แต่ง suffix — ใช้ตรวจซ้ำเชิงตรรกะ)
  const byParent = new Map();
  for (const r of rows) {
    const pid = r[parentKey] ?? 0;
    if (!byParent.has(pid)) byParent.set(pid, new Set());
  }

  for (const r of rows) {
    const pid = r[parentKey] ?? 0;
    const used = byParent.get(pid);
    const normalized = r.normalizedName || normalizeName(r.name || '');
    let slug = r.slug || slugify(r.name || '') || `${table}-${r[id]}`;
    let cand = slug, i = 2;
    while (used.has(cand)) cand = `${slug}-${i++}`;
    used.add(cand);

    await prisma[table].update({
      where: { [id]: r[id] },
      data: { normalizedName: normalized || null, slug: cand || null },
    });
  }
}

(async () => {
  try {
    console.log('Backfilling ProductType...');
    await backfill({ table: 'productType', id: 'id', parentKey: 'categoryId' });

    console.log('Backfilling ProductProfile...');
    await backfill({ table: 'productProfile', id: 'id', parentKey: 'productTypeId' });

    console.log('Backfilling ProductTemplate...');
    await backfill({ table: 'productTemplate', id: 'id', parentKey: 'productProfileId' });

    console.log('✅ Done');
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
