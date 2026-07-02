// scripts/audit-product-duplicates.js
// P1 Product Catalog Duplicate Purchase Audit
// ใช้ตรวจสอบ "สินค้าที่ซื้อซ้ำกัน" ใน Template Catalog (default: T01)
// ไม่ลบข้อมูลใด ๆ — เป็น Audit Report เท่านั้น
//
// Run:
//   node scripts/audit-product-duplicates.js
//   node scripts/audit-product-duplicates.js --branchCode=T01
//   node scripts/audit-product-duplicates.js --json
//
// Output:
//   console report
//   scripts/reports/product-duplicate-audit-<branchCode>-<timestamp>.json

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const args = process.argv.slice(2).reduce((acc, item) => {
  const [k, v] = item.replace(/^--/, '').split('=');
  acc[k] = v ?? true;
  return acc;
}, {});

const branchCode = String(args.branchCode || 'T01').trim();
const outputJsonOnly = args.json === true || args.json === 'true';

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

  // Normalize separators first: CL-811, CL 811 => CL811
  s = s.replace(/([A-Z]+)[\s-]+([0-9]+)/g, '$1$2');
  s = s.replace(/([0-9]+)[\s-]+([A-Z]+)/g, '$1$2');

  // Remove punctuation
  s = s.replace(/[^A-Z0-9ก-๙]+/g, ' ');

  for (const [regex, value] of REPLACE_WORDS) {
    s = s.replace(regex, value);
  }

  for (const word of STOP_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').toUpperCase();
    s = s.replace(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'g'), ' ');
  }

  s = s.replace(/\s+/g, ' ').trim();

  // Canon CL811 COLOR Ink Cartridge -> CANON CL811 COLOR
  return s;
}

function buildGroupKey(product) {
  const brandId = product.brandId ?? 'NO_BRAND';
  return `${brandId}::${normalizeName(product.name)}`;
}

function scoreKeepCandidate(product) {
  // เกณฑ์เบื้องต้น:
  // - id น้อยกว่า มักเป็น catalog เดิม
  // - ชื่อสั้นกว่า/สะอาดกว่าเล็กน้อย
  // - มีรูป/branchPrice ได้คะแนนเพิ่ม
  let score = 0;
  score += Math.max(0, 100000 - Number(product.id || 0)) / 1000;
  score += product.productImages?.length ? 20 : 0;
  score += product.branchPrice?.length ? 10 : 0;
  score -= String(product.name || '').length / 10;
  return score;
}

async function main() {
  const products = await prisma.product.findMany({
    where: {
      active: true,
      productType: {
        branch: {
          branchCode,
        },
      },
    },
    include: {
      brand: { select: { id: true, name: true } },
      productType: {
        select: {
          id: true,
          name: true,
          branchId: true,
          branch: { select: { id: true, branchCode: true, name: true } },
        },
      },
      branchPrice: { select: { id: true, branchId: true, priceRetail: true, priceWholesale: true, costPrice: true } },
      productImages: { select: { id: true, isCover: true } },
    },
    orderBy: { id: 'asc' },
  });

  const groups = new Map();

  for (const product of products) {
    const normalizedName = normalizeName(product.name);
    if (!normalizedName) continue;

    const key = buildGroupKey(product);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        brandId: product.brandId,
        brandName: product.brand?.name || null,
        normalizedName,
        products: [],
      });
    }

    groups.get(key).products.push(product);
  }

  const duplicateGroups = [...groups.values()]
    .filter((g) => g.products.length > 1)
    .map((g, index) => {
      const ranked = [...g.products].sort((a, b) => scoreKeepCandidate(b) - scoreKeepCandidate(a));
      const keep = ranked[0];
      const remove = ranked.slice(1);

      return {
        groupNo: index + 1,
        brandId: g.brandId,
        brandName: g.brandName,
        normalizedName: g.normalizedName,
        qty: g.products.length,
        recommendedKeepId: keep.id,
        recommendedRemoveIds: remove.map((p) => p.id),
        products: g.products.map((p) => ({
          id: p.id,
          name: p.name,
          brandId: p.brandId,
          brandName: p.brand?.name || null,
          productTypeId: p.productTypeId,
          productTypeName: p.productType?.name || null,
          branchCode: p.productType?.branch?.branchCode || null,
          imageCount: p.productImages?.length || 0,
          branchPriceCount: p.branchPrice?.length || 0,
          score: Number(scoreKeepCandidate(p).toFixed(2)),
        })),
      };
    })
    .sort((a, b) => b.qty - a.qty || a.normalizedName.localeCompare(b.normalizedName));

  const report = {
    ok: true,
    branchCode,
    generatedAt: new Date().toISOString(),
    totalProductsScanned: products.length,
    duplicateGroupCount: duplicateGroups.length,
    duplicateProductCount: duplicateGroups.reduce((sum, g) => sum + g.qty, 0),
    groups: duplicateGroups,
  };

  const reportsDir = require('path').join(process.cwd(), 'scripts', 'reports');
  require('fs').mkdirSync(reportsDir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = require('path').join(reportsDir, `product-duplicate-audit-${branchCode}-${ts}.json`);
  require('fs').writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

  if (outputJsonOnly) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('\n==================================================');
  console.log('P1 Product Duplicate Purchase Audit');
  console.log('==================================================');
  console.log('BranchCode:', branchCode);
  console.log('Products scanned:', report.totalProductsScanned);
  console.log('Duplicate groups:', report.duplicateGroupCount);
  console.log('Duplicate product rows:', report.duplicateProductCount);
  console.log('Report:', outPath);

  if (!duplicateGroups.length) {
    console.log('\n✅ No duplicate purchase candidates found.');
    return;
  }

  for (const g of duplicateGroups) {
    console.log('\n--------------------------------------------------');
    console.log(`GROUP ${String(g.groupNo).padStart(3, '0')}`);
    console.log('Brand:', g.brandName || g.brandId || '-');
    console.log('Normalized:', g.normalizedName);
    console.log('Qty:', g.qty);
    console.log('Recommend KEEP:', g.recommendedKeepId);
    console.log('Recommend REMOVE:', g.recommendedRemoveIds.join(', ') || '-');
    console.log('');

    for (const p of g.products) {
      const flag = p.id === g.recommendedKeepId ? 'KEEP?' : 'REMOVE?';
      console.log(`${flag} #${p.id} | ${p.name} | PT:${p.productTypeId} ${p.productTypeName || ''} | images:${p.imageCount} | priceRows:${p.branchPriceCount}`);
    }
  }

  console.log('\n==================================================');
  console.log('Audit complete. Review manually before cleanup SQL.');
  console.log('==================================================\n');
}

main()
  .catch((error) => {
    console.error('❌ Product duplicate audit failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
