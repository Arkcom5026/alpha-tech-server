const { prisma } = require('../../../../lib/prisma');
const {
  DEFAULT_TEMPLATE_BRANCH_CODE,
  ProductTemplateRepository,
} = require('../repositories/productTemplateRepository');

const repository = new ProductTemplateRepository(prisma);

const findTemplateBranchByCode = (branchCode) => repository.findTemplateBranchByCode(branchCode);
const list = (input) => repository.list(input);
const findById = (input) => repository.findById(input);
const createTemplate = (input) => repository.createTemplate(input);
const updateTemplate = (input) => repository.updateTemplate(input);
const setActive = (input) => repository.setActive(input);

const findPriceSnapshot = ({ productId, branchId }) =>
  prisma.branchPrice.findUnique({
    where: {
      productId_branchId: {
        productId: Number(productId),
        branchId: Number(branchId),
      },
    },
    select: { costPrice: true },
  });

const upsertPriceSnapshot = ({ productId, branchId, create, update }) =>
  prisma.branchPrice.upsert({
    where: {
      productId_branchId: {
        productId: Number(productId),
        branchId: Number(branchId),
      },
    },
    create,
    update,
  });

module.exports = {
  DEFAULT_TEMPLATE_BRANCH_CODE,
  findTemplateBranchByCode,
  list,
  findById,
  createTemplate,
  updateTemplate,
  setActive,
  findPriceSnapshot,
  upsertPriceSnapshot,
};
