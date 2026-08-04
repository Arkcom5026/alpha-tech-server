'use strict';

const repository = require('./publicStorefrontRepository');

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SORT_OPTIONS = new Set(['name_asc', 'price_asc', 'price_desc', 'newest']);

const fail = (statusCode, code, message) => {
  throw Object.assign(new Error(message), { statusCode, code });
};

const normalizeSlug = (value) => {
  const slug = String(value || '').trim().toLowerCase();
  if (!slug || !SLUG_PATTERN.test(slug)) fail(400, 'STOREFRONT_SLUG_INVALID', 'Invalid storefront slug');
  return slug;
};

const normalizePositiveInt = (value, fallback, max) => {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) fail(400, 'PUBLIC_DISCOVERY_VALIDATION_FAILED', 'Pagination parameters must be positive integers');
  return Math.min(number, max);
};

const normalizeOptionalPositiveInt = (value, field) => {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) fail(400, 'PUBLIC_DISCOVERY_VALIDATION_FAILED', `${field} must be a positive integer`);
  return number;
};

const normalizeSort = (value) => {
  const sort = String(value || 'name_asc').trim();
  if (!SORT_OPTIONS.has(sort)) fail(400, 'PUBLIC_DISCOVERY_VALIDATION_FAILED', 'Unsupported product sort');
  return sort;
};

const requirePublishedStorefront = async (slug) => {
  const storefront = await repository.findPublishedBySlug(normalizeSlug(slug));
  if (!storefront) fail(404, 'STOREFRONT_NOT_FOUND', 'Storefront was not found');
  return storefront;
};

const getPublicStorefront = async (input = {}) => requirePublishedStorefront(input.slug);

const listPublicStorefrontProducts = async (input = {}) => {
  const storefront = await requirePublishedStorefront(input.slug);
  const page = normalizePositiveInt(input.page, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = normalizePositiveInt(input.pageSize, 24, 100);
  const categoryId = normalizeOptionalPositiveInt(input.categoryId, 'categoryId');
  const brandId = normalizeOptionalPositiveInt(input.brandId, 'brandId');
  const sort = normalizeSort(input.sort);
  const search = String(input.search || '').trim().slice(0, 120);
  const result = await repository.listPublishedProducts({ branchId: storefront.branchId, search, categoryId, brandId, sort, page, pageSize });

  const { branchId: _branchId, ...publicStorefront } = storefront;
  return {
    storefront: publicStorefront,
    items: result.items,
    facets: result.facets,
    query: { search, categoryId, brandId, sort },
    pagination: { page, pageSize, total: result.total, totalPages: Math.ceil(result.total / pageSize) },
  };
};

const getPublicStorefrontProduct = async (input = {}) => {
  const storefront = await requirePublishedStorefront(input.slug);
  const productId = Number(input.productId);
  if (!Number.isInteger(productId) || productId <= 0) fail(400, 'PUBLIC_DISCOVERY_VALIDATION_FAILED', 'productId must be a positive integer');
  const product = await repository.findPublishedProductById({ branchId: storefront.branchId, productId });
  if (!product) fail(404, 'PUBLIC_PRODUCT_NOT_FOUND', 'Public product was not found');
  const { branchId: _branchId, ...publicStorefront } = storefront;
  return { storefront: publicStorefront, product };
};

module.exports = Object.freeze({ getPublicStorefront, listPublicStorefrontProducts, getPublicStorefrontProduct });
