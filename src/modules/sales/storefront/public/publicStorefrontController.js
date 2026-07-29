'use strict';

const { getPublicStorefront } = require('./publicStorefrontService');

const getPublicStorefrontController = async (req, res, next) => {
  try {
    const result = await getPublicStorefront({ slug: req.params?.slug });
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({ getPublicStorefrontController });
