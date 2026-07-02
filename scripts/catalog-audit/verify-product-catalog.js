// scripts/catalog-audit/verify-product-catalog.js
// P1 Product Catalog Verification
//
// Run:
//   node scripts/catalog-audit/verify-product-catalog.js --branchCode=T01

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const args = process.argv.slice(2).reduce((acc, item) => {
  const [k, v] = item.replace(/^--/, '').split('=');
  acc[k] = v ?? true;
  return acc;
}, {});

const branchCode = String(args.branchCode || 'T01').trim();

const STOP_WORDS = [
  'แท้',
  'หมึกแท้',
  'GENUINE',
  'INK',
  'CARTRIDGE',
  'BOTTLE',
  'PRINTER',
  'FOR',
  'PRINT',
  'ตลับหมึกแท้',
];

const REPLACE_WORDS = [
  [/\bCO\b/g, 'COLOR'],
  [/\bCOL\b/g, 'COLOR'],
  [/\bBK\b/g, 'BLACK'],
  [/\bBLK\b/g, 'BLACK'],
  [/\bCYN\b/g, 'CYAN'],
  [/\bC\b/g, 'CYAN'],
  [/\bMAG\b/g, 'MAGENTA'],
  [/\bM\b/g, 'MAGENTA'],
  [/\bYEL\b/g, 'YELLOW'],
  [/\bY\b/g, 'YELLOW'],
];

function normalizeName(name = '') {
  let s = String(name).toUpperCase();
  s = s.replace(/([A-Z]+)[\s-]+([0-9]+)/g, '$1$2');
  s = s.replace(/([0-9]+)[\s-]+([A-Z]+)/g, '$1$2');
  s = s.replace(/[^A-Z0-9ก-๙]+/g, ' ');

  for (const [regex, value] of REPLACE_WORDS) s = s.replace(regex, value);

  for (const word of STOP_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').toUpperCase();
    s = s.replace(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'g'), ' ');
  }

  return s.replace(/\s+/g, ' ').trim();
}

async function main() {
  const products = await prisma.product.findMany({
    where: {
      active: true,
      productType: {
        branch: { branchCode },
      },
    },
    include: {
      brand: { select: { id: true, name: true } },
      productType: {
        select: {
          id: true,
          name: true,
          branch: { select: { branchCode: true } },
        },
      },
    },
    orderBy: { id: 'asc' },
  });

  const groups = new Map();
  for (const p of products) {
    const key = `${p.brandId ?? 'NO_BRAND'}::${normalizeName(p.name)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }

  const duplicates = [...groups.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({ key, rows }));

  const orphanBranchPrice = await prisma.branchPrice.count({
    where: {
      product: null,
    },
  }).catch(() => null);

  console.log('\n==================================================');
  console.log('P1 Product Catalog Verification');
  console.log('==================================================');
  console.log('BranchCode:', branchCode);
  console.log('Products:', products.length);
  console.log('Business duplicate groups:', duplicates.length);
  console.log('Orphan BranchPrice:', orphanBranchPrice === null ? 'SKIPPED' : orphanBranchPrice);

  if (duplicates.length) {
    console.log('\n❌ Duplicate groups remain:');
    duplicates.forEach((g, i) => {
      console.log(`\nGROUP ${i + 1}: ${g.key}`);
      g.rows.forEach((p) => console.log(`#${p.id} | ${p.name}`));
    });
  } else {
    console.log('\n✅ Business duplicate verification PASS');
  }

  console.log('\n==================================================\n');
}

main()
  .catch((error) => {
    console.error('❌ Product catalog verification failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
