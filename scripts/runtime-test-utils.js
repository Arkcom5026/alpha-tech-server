// scripts/runtime-test-utils.js
require('dotenv').config();

const { prisma } = require('../lib/prisma');

const toNumber = (value, fallback = null) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const nowCode = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const logHeader = (title) => {
  console.log('\n==================================================');
  console.log(title);
  console.log('==================================================');
};

const pass = (message) => console.log(`✅ ${message}`);

const getTemplateBranch = async (branchCode = process.env.TEST_TEMPLATE_BRANCH_CODE || 'T01') => {
  const branch = await prisma.branch.findFirst({
    where: { branchCode },
    select: { id: true, name: true, branchCode: true, features: true },
  });

  if (!branch) throw new Error(`Template branch not found: ${branchCode}`);
  return branch;
};

const pickTemplateProduct = async ({
  templateProductId = process.env.TEST_TEMPLATE_PRODUCT_ID,
  search = process.env.TEST_TEMPLATE_SEARCH || '',
} = {}) => {
  const explicitId = toNumber(templateProductId);

  if (explicitId) {
    const product = await prisma.product.findUnique({
      where: { id: explicitId },
      select: { id: true, name: true, mode: true, productTypeId: true, brandId: true, unitId: true },
    });
    if (!product) throw new Error(`Template product not found by id: ${explicitId}`);
    return product;
  }

  const templateBranch = await getTemplateBranch();

  const product = await prisma.product.findFirst({
    where: {
      active: true,
      ...(search ? { name: { contains: String(search).trim(), mode: 'insensitive' } } : {}),
      branchPrice: { some: { branchId: templateBranch.id } },
    },
    orderBy: { id: 'asc' },
    select: { id: true, name: true, mode: true, productTypeId: true, brandId: true, unitId: true },
  });

  if (!product) throw new Error('No template product found.');
  return product;
};

module.exports = {
  prisma,
  toNumber,
  nowCode,
  logHeader,
  pass,
  getTemplateBranch,
  pickTemplateProduct,
};
