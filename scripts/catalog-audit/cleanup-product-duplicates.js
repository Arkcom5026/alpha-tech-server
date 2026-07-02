// scripts/catalog-audit/cleanup-product-duplicates.js
// Execute v3: one short transaction per mapping
// Fixes Prisma P2028 "Transaction not found" from long interactive transaction.
//
// Dry-run:
//   node scripts/catalog-audit/cleanup-product-duplicates.js --dry-run --branchCode=T01 --mapping=scripts/catalog-audit/mappings/product-duplicate-mapping.json
//
// Execute:
//   node scripts/catalog-audit/cleanup-product-duplicates.js --execute --branchCode=T01 --mapping=scripts/catalog-audit/mappings/product-duplicate-mapping.json

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const args = process.argv.slice(2).reduce((acc, item) => {
  const [k, v] = item.replace(/^--/, '').split('=');
  acc[k] = v ?? true;
  return acc;
}, {});

const execute = args.execute === true || args.execute === 'true';
const branchCode = String(args.branchCode || 'T01').trim();
const mappingPath = args.mapping
  ? path.resolve(process.cwd(), String(args.mapping))
  : path.resolve(process.cwd(), 'scripts/catalog-audit/mappings/product-duplicate-mapping.json');

function loadMapping() {
  const raw = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
  return (Array.isArray(raw) ? raw : raw.mapping || raw.items || []).map((row) => ({
    keepId: Number(row.keepId ?? row.keep_id ?? row.keep),
    removeId: Number(row.removeId ?? row.remove_id ?? row.remove),
    reason: row.reason || '',
  }));
}

function assertValidMapping(mapping) {
  const removeSet = new Set();
  for (const row of mapping) {
    if (!Number.isInteger(row.keepId) || row.keepId <= 0) throw new Error(`Invalid keepId: ${JSON.stringify(row)}`);
    if (!Number.isInteger(row.removeId) || row.removeId <= 0) throw new Error(`Invalid removeId: ${JSON.stringify(row)}`);
    if (row.keepId === row.removeId) throw new Error(`keepId/removeId same: ${row.keepId}`);
    if (removeSet.has(row.removeId)) throw new Error(`Duplicate removeId in mapping: ${row.removeId}`);
    removeSet.add(row.removeId);
  }
}

async function productInfo(client, id) {
  return client.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      productTypeId: true,
      templateProductId: true,
      productType: {
        select: {
          id: true,
          branchId: true,
          branch: { select: { branchCode: true } },
        },
      },
    },
  });
}

async function countRefs(client, productId) {
  const [
    branchPrice,
    stockItem,
    stockBalance,
    stockMovement,
    productImage,
    simpleLot,
    clonedProducts,
  ] = await Promise.all([
    client.branchPrice.count({ where: { productId } }),
    client.stockItem.count({ where: { productId } }),
    client.stockBalance.count({ where: { productId } }),
    client.stockMovement.count({ where: { productId } }),
    client.productImage.count({ where: { productId } }),
    client.simpleLot.count({ where: { productId } }),
    client.product.count({ where: { templateProductId: productId } }),
  ]);

  return { branchPrice, stockItem, stockBalance, stockMovement, productImage, simpleLot, clonedProducts };
}

async function dryRunOne(row, index, total) {
  console.log(`[${index}/${total}] checking KEEP ${row.keepId} <- REMOVE ${row.removeId}`);

  const [keep, remove, keepRefs, removeRefs] = await Promise.all([
    productInfo(prisma, row.keepId),
    productInfo(prisma, row.removeId),
    countRefs(prisma, row.keepId),
    countRefs(prisma, row.removeId),
  ]);

  console.log(`   KEEP   #${keep?.id}: ${keep?.name || 'NOT_FOUND'}`);
  console.log(`   REMOVE #${remove?.id}: ${remove?.name || 'NOT_FOUND'}`);
  console.log('   remove refs:', removeRefs);

  return { mapping: row, keep, remove, keepRefs, removeRefs };
}

async function executeOne(row, index, total) {
  console.log(`[${index}/${total}] merging KEEP ${row.keepId} <- REMOVE ${row.removeId}`);

  return prisma.$transaction(async (tx) => {
    const keep = await productInfo(tx, row.keepId);
    const remove = await productInfo(tx, row.removeId);

    if (!keep) throw new Error(`KEEP product not found: ${row.keepId}`);
    if (!remove) {
      console.log(`   SKIP: REMOVE #${row.removeId} not found`);
      return { mapping: row, skipped: 'REMOVE_NOT_FOUND' };
    }

    const actualBranchCode = remove.productType?.branch?.branchCode;
    if (actualBranchCode !== branchCode) {
      throw new Error(`REMOVE ${row.removeId} branch mismatch. expected=${branchCode}, actual=${actualBranchCode}`);
    }

    const beforeRefs = await countRefs(tx, row.removeId);
    const actions = [];

    // Move reference tables first.
    if (beforeRefs.productImage > 0) {
      const r = await tx.productImage.updateMany({
        where: { productId: row.removeId },
        data: { productId: row.keepId },
      });
      actions.push({ table: 'ProductImage', update: r.count });
    }

    if (beforeRefs.stockItem > 0) {
      const r = await tx.stockItem.updateMany({
        where: { productId: row.removeId },
        data: { productId: row.keepId },
      });
      actions.push({ table: 'StockItem', update: r.count });
    }

    if (beforeRefs.stockMovement > 0) {
      const r = await tx.stockMovement.updateMany({
        where: { productId: row.removeId },
        data: { productId: row.keepId },
      });
      actions.push({ table: 'StockMovement', update: r.count });
    }

    if (beforeRefs.simpleLot > 0) {
      const r = await tx.simpleLot.updateMany({
        where: { productId: row.removeId },
        data: { productId: row.keepId },
      });
      actions.push({ table: 'SimpleLot', update: r.count });
    }

    if (beforeRefs.clonedProducts > 0) {
      const r = await tx.product.updateMany({
        where: { templateProductId: row.removeId },
        data: { templateProductId: row.keepId },
      });
      actions.push({ table: 'Product.templateProductId', update: r.count });
    }

    // BranchPrice: remove product usually has only one T01 row.
    const removePrices = await tx.branchPrice.findMany({
      where: { productId: row.removeId },
      select: { id: true, branchId: true },
    });

    let priceMoved = 0;
    let priceDeleted = 0;

    for (const bp of removePrices) {
      const existing = await tx.branchPrice.findFirst({
        where: {
          productId: row.keepId,
          branchId: bp.branchId,
        },
        select: { id: true },
      });

      if (existing) {
        await tx.branchPrice.delete({ where: { id: bp.id } });
        priceDeleted += 1;
      } else {
        await tx.branchPrice.update({
          where: { id: bp.id },
          data: { productId: row.keepId },
        });
        priceMoved += 1;
      }
    }
    actions.push({ table: 'BranchPrice', moved: priceMoved, deleted: priceDeleted });

    // StockBalance: handle only if exists.
    const balances = await tx.stockBalance.findMany({ where: { productId: row.removeId } });

    let balanceMoved = 0;
    let balanceMerged = 0;

    for (const bal of balances) {
      const existing = await tx.stockBalance.findUnique({
        where: {
          productId_branchId: {
            productId: row.keepId,
            branchId: bal.branchId,
          },
        },
      });

      if (existing) {
        await tx.stockBalance.update({
          where: {
            productId_branchId: {
              productId: row.keepId,
              branchId: bal.branchId,
            },
          },
          data: {
            quantity: { increment: Number(bal.quantity || 0) },
            reserved: { increment: Number(bal.reserved || 0) },
            lastReceivedCost: bal.lastReceivedCost ?? existing.lastReceivedCost,
            avgCost: bal.avgCost ?? existing.avgCost,
          },
        });

        await tx.stockBalance.delete({
          where: {
            productId_branchId: {
              productId: row.removeId,
              branchId: bal.branchId,
            },
          },
        });

        balanceMerged += 1;
      } else {
        await tx.stockBalance.update({
          where: {
            productId_branchId: {
              productId: row.removeId,
              branchId: bal.branchId,
            },
          },
          data: { productId: row.keepId },
        });
        balanceMoved += 1;
      }
    }

    if (balances.length) actions.push({ table: 'StockBalance', moved: balanceMoved, merged: balanceMerged });

    await tx.product.delete({ where: { id: row.removeId } });
    actions.push({ table: 'Product', deleted: row.removeId });

    console.log(`   OK deleted #${row.removeId}: ${remove.name}`);

    return {
      mapping: row,
      keep: { id: keep.id, name: keep.name },
      remove: { id: remove.id, name: remove.name },
      beforeRefs,
      actions,
    };
  }, {
    timeout: 20000,
    maxWait: 10000,
  });
}

async function main() {
  const mapping = loadMapping();
  assertValidMapping(mapping);

  console.log('\n==================================================');
  console.log('P1 Product Duplicate Cleanup Execute v3');
  console.log('==================================================');
  console.log('Mode:', execute ? 'EXECUTE' : 'DRY-RUN');
  console.log('BranchCode:', branchCode);
  console.log('Mapping:', mappingPath);
  console.log('Items:', mapping.length);
  console.log('==================================================\n');

  const started = Date.now();
  const items = [];

  for (let i = 0; i < mapping.length; i += 1) {
    const row = mapping[i];
    const item = execute
      ? await executeOne(row, i + 1, mapping.length)
      : await dryRunOne(row, i + 1, mapping.length);
    items.push(item);
  }

  const report = {
    ok: true,
    mode: execute ? 'execute' : 'dry-run',
    branchCode,
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - started,
    mappingCount: mapping.length,
    items,
  };

  const reportsDir = path.join(process.cwd(), 'scripts', 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportsDir, `product-duplicate-cleanup-${branchCode}-${report.mode}-${ts}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n==================================================');
  console.log('DONE');
  console.log('Elapsed:', report.elapsedMs, 'ms');
  console.log('Report:', reportPath);
  console.log(execute ? 'DATA CHANGED ✅' : 'NO DATA CHANGED ✅');
  console.log('==================================================\n');
}

main()
  .catch((error) => {
    console.error('❌ Cleanup failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
