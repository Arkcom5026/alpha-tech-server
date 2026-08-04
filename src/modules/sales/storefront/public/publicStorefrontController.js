'use strict';

const {
  getPublicStorefront,
  listPublicStorefrontProducts,
  getPublicStorefrontProduct,
} = require('./publicStorefrontService');

const getPublicStorefrontController = async (req, res, next) => {
  try {
    return res.status(200).json({ ok: true, data: await getPublicStorefront({ slug: req.params?.slug }) });
  } catch (error) {
    return next(error);
  }
};

const listPublicStorefrontProductsController = async (req, res, next) => {
  try {
    const result = await listPublicStorefrontProducts({
      slug: req.params?.slug,
      search: req.query?.q,
      categoryId: req.query?.categoryId,
      brandId: req.query?.brandId,
      sort: req.query?.sort,
      page: req.query?.page,
      pageSize: req.query?.pageSize,
    });
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const getPublicStorefrontProductController = async (req, res, next) => {
  try {
    const result = await getPublicStorefrontProduct({ slug: req.params?.slug, productId: req.params?.productId });
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({
  getPublicStorefrontController,
  listPublicStorefrontProductsController,
  getPublicStorefrontProductController,
});
