const repository = require('./branchPriceRuntimeRepository');

const toInt = (value) => (
  value === undefined || value === null || value === ''
    ? undefined
    : Number(value)
);

const pickPriceUpdate = (source = {}) => {
  const update = {};

  if (source.costPrice !== undefined) update.costPrice = repository.D(source.costPrice);
  if (source.priceRetail !== undefined || source.retailPrice !== undefined) {
    update.priceRetail = repository.D(source.retailPrice ?? source.priceRetail);
  }
  if (source.priceWholesale !== undefined || source.wholesalePrice !== undefined) {
    update.priceWholesale = repository.D(source.wholesalePrice ?? source.priceWholesale);
  }
  if (source.priceTechnician !== undefined || source.technicianPrice !== undefined) {
    update.priceTechnician = repository.D(source.technicianPrice ?? source.priceTechnician);
  }
  if (source.priceOnline !== undefined) update.priceOnline = repository.D(source.priceOnline);
  if (source.effectiveDate !== undefined) {
    update.effectiveDate = source.effectiveDate ? new Date(source.effectiveDate) : null;
  }
  if (source.expiredDate !== undefined) {
    update.expiredDate = source.expiredDate ? new Date(source.expiredDate) : null;
  }
  if (source.note !== undefined) update.note = source.note || null;
  if (typeof source.isActive === 'boolean') update.isActive = source.isActive;

  return update;
};

const validateDateOrder = (effectiveDate, expiredDate) => {
  const effective = effectiveDate ? new Date(effectiveDate) : null;
  const expired = expiredDate ? new Date(expiredDate) : null;
  return { effective, expired, valid: !(effective && expired && expired < effective) };
};

const buildProductWhere = ({
  branchId,
  categoryId,
  productTypeId,
  productProfileId,
  templateId,
  productTemplateId,
  productId,
  searchText,
  q,
  includeInactive,
}) => {
  if (productProfileId) {
    return { error: { error: 'UNSUPPORTED_LEGACY_FILTER', field: 'productProfileId' } };
  }

  const AND = [{ productType: { branchId } }];
  const templateProductId = toInt(templateId ?? productTemplateId);

  if (templateProductId) AND.push({ templateProductId });
  if (productTypeId) AND.push({ productTypeId: toInt(productTypeId) });
  if (productId) AND.push({ id: toInt(productId) });
  if (categoryId) {
    AND.push({
      productType: {
        branchId,
        globalProductType: { categoryId: toInt(categoryId) },
      },
    });
  }

  const text = String(searchText ?? q ?? '').trim();
  if (text) AND.push({ name: { contains: text, mode: 'insensitive' } });

  const includeInactiveFlag = String(includeInactive).toLowerCase() === 'true'
    || String(includeInactive) === '1';
  if (!includeInactiveFlag) AND.push({ active: true });

  return { where: { AND } };
};

const projectProductsWithPrices = async (products, branchId) => {
  const prices = await repository.findBranchPrices({
    branchId,
    productIds: products.map((product) => product.id),
  });
  const priceMap = new Map(prices.map((price) => [price.productId, price]));

  return products.map((product) => ({
    product: {
      ...product,
      categoryId: product.productType?.globalProductType?.categoryId ?? null,
      category: product.productType?.globalProductType?.category ?? null,
      model: null,
      description: null,
      spec: null,
      templateId: product.templateProductId ?? null,
      template: product.templateProduct || null,
    },
    branchPrice: priceMap.get(product.id) || null,
  }));
};

const getActiveBranchPrice = ({ branchId, productId }) => (
  repository.findActiveBranchPrice({ branchId, productId, now: new Date() })
);

const upsertBranchPrice = async ({ actor, input }) => {
  const productId = toInt(input.productId);
  const retailValue = input.retailPrice ?? input.priceRetail;
  const dates = validateDateOrder(input.effectiveDate, input.expiredDate);

  const pricePatch = pickPriceUpdate(input);
  const createData = {
    costPrice: repository.D(input.costPrice),
    priceRetail: repository.D(retailValue),
    priceWholesale: repository.D(input.wholesalePrice ?? input.priceWholesale),
    priceTechnician: repository.D(input.technicianPrice ?? input.priceTechnician),
    priceOnline: repository.D(input.priceOnline),
    effectiveDate: dates.effective,
    expiredDate: dates.expired,
    note: input.note || null,
    isActive: typeof input.isActive === 'boolean' ? input.isActive : true,
  };

  return repository.upsertBranchPrice({
    productId,
    branchId: actor.branchId,
    employeeId: actor.employeeId,
    pricePatch,
    createData,
  });
};

const getBranchPricesByBranch = async ({ branchId, query }) => {
  const built = buildProductWhere({ branchId, ...query, includeInactive: false });
  if (built.error) return { error: built.error };

  const products = await repository.findProducts({
    where: built.where,
    orderBy: { name: 'asc' },
  });
  return { items: await projectProductsWithPrices(products, branchId) };
};

const getAllProductsWithBranchPrice = async ({ branchId, query }) => {
  const { page, pageSize, sort, withMeta, ...filters } = query || {};
  const built = buildProductWhere({ branchId, ...filters });
  if (built.error) return { error: built.error };

  const allowedSortFields = new Set(['name', 'id', 'createdAt', 'updatedAt']);
  let orderBy = { name: 'asc' };
  if (sort && typeof sort === 'string') {
    const [field, direction] = String(sort).split(':');
    if (allowedSortFields.has(field)) {
      orderBy = { [field]: String(direction).toLowerCase() === 'desc' ? 'desc' : 'asc' };
    }
  }

  const currentPage = Math.max(0, toInt(page) || 0);
  const size = Math.min(200, Math.max(0, toInt(pageSize) || 0));
  const usePaging = currentPage > 0 && size > 0;
  const total = usePaging ? await repository.countProducts(built.where) : undefined;

  const products = await repository.findProducts({
    where: built.where,
    orderBy,
    ...(usePaging ? { skip: (currentPage - 1) * size, take: size } : {}),
  });
  const items = await projectProductsWithPrices(products, branchId);
  const wantMeta = String(withMeta).toLowerCase() === 'true' || String(withMeta) === '1';

  return { items, total, page: currentPage, pageSize: size, usePaging, wantMeta };
};

const updateMultipleBranchPrices = async ({ actor, updates }) => {
  const operations = updates
    .map((item) => {
      const productId = toInt(item?.product?.id || item?.productId);
      if (!productId) return null;

      const dates = validateDateOrder(item?.effectiveDate, item?.expiredDate);
      if (!dates.valid) return null;

      return repository.buildUpsertOperation({
        productId,
        branchId: actor.branchId,
        employeeId: actor.employeeId,
        update: pickPriceUpdate(item),
        create: {
          costPrice: repository.D(item.costPrice),
          priceRetail: repository.D(item.retailPrice ?? item.priceRetail),
          priceWholesale: repository.D(item.wholesalePrice ?? item.priceWholesale),
          priceTechnician: repository.D(item.technicianPrice ?? item.priceTechnician),
          priceOnline: repository.D(item.priceOnline),
          effectiveDate: dates.effective,
          expiredDate: dates.expired,
          note: item.note || null,
          isActive: typeof item.isActive === 'boolean' ? item.isActive : true,
        },
      });
    })
    .filter(Boolean);

  return repository.bulkUpsertBranchPrices({ operations });
};

module.exports = {
  toInt,
  validateDateOrder,
  getActiveBranchPrice,
  upsertBranchPrice,
  getBranchPricesByBranch,
  getAllProductsWithBranchPrice,
  updateMultipleBranchPrices,
};
