'use strict';

const { getPublicStorePolicy } = require('./publicStorePolicyService');

const getPublicStorePolicyController = async (req, res, next) => {
  try {
    const data = await getPublicStorePolicy({ slug: req.params?.slug });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({ getPublicStorePolicyController });
