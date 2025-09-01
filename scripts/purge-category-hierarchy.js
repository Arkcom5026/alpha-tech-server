// scripts/purge-category-hierarchy.js
// SuperAdmin-only maintenance script to HARD DELETE a Category and its entire hierarchy
// Usage examples:
//   node scripts/purge-category-hierarchy.js --id 123 --execute --force
//   node scripts/purge-category-hierarchy.js --id 123 --dry-run      (default)
// Optional flags:
//   --override-system   allow deleting Category with isSystem=true
//   --force             skip interactive confirmation (CI usage)
//   --execute           actually perform deletion (without this flag, it's dry-run)
// Notes:
//   - This bypasses Archive/Restore safety and ON DELETE RESTRICT by deleting children first.
//   - Run ONLY by SuperAdmin with recent backups.
//   - Ensure your Prisma schema matches relations used below.

/* eslint-disable no-console */
const readline = require('readline');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function parseArgs(argv) {
  const args = { dryRun: true, execute: false, force: false, overrideSystem: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--execute') args.execute = true, args.dryRun = false;
    else if (a === '--dry-run') args.dryRun = true, args.execute = false;
    else if (a === '--force') args.force = true;
    else if (a === '--override-system') args.overrideSystem = true;
    else if ((a === '--id' || a === '-i') && argv[i + 1]) { args.id = Number(argv[++i]); }
  }
  return args;
}

function askConfirm(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(String(answer || '').trim().toLowerCase());
    });
  });
}

async function collectHierarchy(categoryId) {
  // Fetch full tree with minimal selects
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, name: true, isSystem: true },
  });
  if (!category) return { category: null };

  const productTypes = await prisma.productType.findMany({
    where: { categoryId },
    select: { id: true, name: true },
  });

  const productTypeIds = productTypes.map((t) => t.id);

  const productProfiles = productTypeIds.length
    ? await prisma.productProfile.findMany({
        where: { productTypeId: { in: productTypeIds } },
        select: { id: true, name: true, productTypeId: true },
      })
    : [];

  const productProfileIds = productProfiles.map((p) => p.id);

  const productTemplates = productProfileIds.length
    ? await prisma.productTemplate.findMany({
        where: { productProfileId: { in: productProfileIds } },
        select: { id: true, name: true, productProfileId: true },
      })
    : [];

  const templateIds = productTemplates.map((t) => t.id);

  const products = templateIds.length
    ? await prisma.product.findMany({
        where: { templateId: { in: templateIds } },
        select: { id: true, sku: true, name: true, templateId: true },
      })
    : [];

  return { category, productTypes, productProfiles, productTemplates, products };
}

function summarize(h) {
  const counts = {
    productTypes: h.productTypes?.length || 0,
    productProfiles: h.productProfiles?.length || 0,
    productTemplates: h.productTemplates?.length || 0,
    products: h.products?.length || 0,
  };
  return counts;
}

async function purge(args) {
  const id = Number(args.id);
  if (!id) throw new Error('Missing --id <categoryId>');

  const h = await collectHierarchy(id);
  if (!h.category) {
    console.error('❌ Category not found');
    process.exit(1);
  }

  if (h.category.isSystem && !args.overrideSystem) {
    console.error('❌ Category isSystem=true. Pass --override-system to proceed.');
    process.exit(1);
  }

  const counts = summarize(h);
  console.log('—'.repeat(60));
  console.log('PURGE CATEGORY (HARD DELETE) — DRY RUN:', args.dryRun ? 'YES' : 'NO');
  console.log('Category:', `${h.category.id} — ${h.category.name} — isSystem=${h.category.isSystem}`);
  console.log('Counts: ', counts);
  console.log('Delete order (bottom-up): Products → Templates → Profiles → Types → Category');
  console.log('—'.repeat(60));

  if (args.dryRun) return; // preview only

  if (!args.force) {
    const answer = await askConfirm('Type DELETE to confirm hard delete this category and ALL descendants: ');
    if (answer !== 'delete') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  await prisma.$transaction(async (tx) => {
    // 1) Products
    if (h.products.length) {
      await tx.product.deleteMany({ where: { id: { in: h.products.map((x) => x.id) } } });
      console.log(`✔ Deleted products: ${h.products.length}`);
    }

    // 2) Templates
    if (h.productTemplates.length) {
      await tx.productTemplate.deleteMany({ where: { id: { in: h.productTemplates.map((x) => x.id) } } });
      console.log(`✔ Deleted templates: ${h.productTemplates.length}`);
    }

    // 3) Profiles
    if (h.productProfiles.length) {
      await tx.productProfile.deleteMany({ where: { id: { in: h.productProfiles.map((x) => x.id) } } });
      console.log(`✔ Deleted profiles: ${h.productProfiles.length}`);
    }

    // 4) Types
    if (h.productTypes.length) {
      await tx.productType.deleteMany({ where: { id: { in: h.productTypes.map((x) => x.id) } } });
      console.log(`✔ Deleted types: ${h.productTypes.length}`);
    }

    // 5) Category
    await tx.category.delete({ where: { id } });
    console.log('✔ Deleted category');
  });
}

(async function main() {
  const args = parseArgs(process.argv);
  try {
    await purge(args);
    console.log(args.dryRun ? 'DRY-RUN completed.' : 'PURGE completed.');
  } catch (e) {
    console.error('❌ Failed:', e.message || e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
