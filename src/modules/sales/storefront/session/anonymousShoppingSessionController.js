'use strict';

const {
  createAnonymousShoppingSession,
  getAnonymousShoppingSession,
  setAnonymousShoppingSessionItem,
  removeAnonymousShoppingSessionItem,
  abandonAnonymousShoppingSession,
} = require('./anonymousShoppingSessionService');

const readToken = (req) => req.get('X-Anonymous-Session-Token') || req.cookies?.anonymousShoppingSessionToken;

const createController = async (req, res, next) => {
  try {
    const result = await createAnonymousShoppingSession({ slug: req.params.slug });
    res.setHeader('X-Anonymous-Session-Token', result.token);
    return res.status(201).json({ ok: true, data: result.session, token: result.token });
  } catch (error) {
    return next(error);
  }
};

const getController = async (req, res, next) => {
  try {
    const data = await getAnonymousShoppingSession({ slug: req.params.slug, token: readToken(req) });
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
};

const setItemController = async (req, res, next) => {
  try {
    const data = await setAnonymousShoppingSessionItem({
      slug: req.params.slug,
      token: readToken(req),
      productId: req.params.productId,
      quantity: req.body?.quantity,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
};

const removeItemController = async (req, res, next) => {
  try {
    const data = await removeAnonymousShoppingSessionItem({
      slug: req.params.slug,
      token: readToken(req),
      productId: req.params.productId,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
};

const abandonController = async (req, res, next) => {
  try {
    const data = await abandonAnonymousShoppingSession({
      slug: req.params.slug,
      token: readToken(req),
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({
  createController,
  getController,
  setItemController,
  removeItemController,
  abandonController,
});
