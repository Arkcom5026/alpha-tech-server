'use strict';

const crypto = require('crypto');
const repository = require('./anonymousShoppingSessionRepository');

const SESSION_TTL_HOURS = 72;
const MAX_ITEM_QUANTITY = 99;

const fail = (code, message, statusCode = 400, details = null) => {
  throw Object.assign(new Error(message), { code, statusCode, details });
};

const normalizeSlug = (value) => {
  const slug = String(value || '').trim().toLowerCase();
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    fail('ANONYMOUS_SESSION_STOREFRONT_INVALID', 'Invalid storefront slug');
  }
  return slug;
};

const normalizeToken = (value) => {
  const token = String(value || '').trim();
  if (!token || token.length < 32 || token.length > 512) {
    fail('ANONYMOUS_SESSION_TOKEN_INVALID', 'Invalid anonymous session token', 401);
  }
  return token;
};

const positiveInt = (value, fieldName, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > max) {
    fail('ANONYMOUS_SESSION_INPUT_INVALID', `${fieldName} must be a positive integer`, 400, { fieldName, max });
  }
  return parsed;
};

const resolveStorefront = async (slug) => {
  const storefront = await repository.findStorefrontBySlug(normalizeSlug(slug));
  if (!storefront) fail('ANONYMOUS_SESSION_STOREFRONT_NOT_FOUND', 'Storefront was not found', 404);
  return { branchId: Number(storefront.branchId) };
};

const createAnonymousShoppingSession = async ({ slug }) => {
  const storefront = await resolveStorefront(slug);
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
  const session = await repository.create({ branchId: storefront.branchId, token, expiresAt });
  return { token, session };
};

const getAnonymousShoppingSession = async ({ slug, token }) => {
  const storefront = await resolveStorefront(slug);
  const session = await repository.findActiveByToken({
    branchId: storefront.branchId,
    token: normalizeToken(token),
  });
  if (!session) fail('ANONYMOUS_SESSION_NOT_FOUND', 'Anonymous shopping session was not found', 404);
  return session;
};

const setAnonymousShoppingSessionItem = async ({ slug, token, productId, quantity }) => {
  const storefront = await resolveStorefront(slug);
  const session = await repository.upsertItem({
    branchId: storefront.branchId,
    token: normalizeToken(token),
    productId: positiveInt(productId, 'productId'),
    quantity: positiveInt(quantity, 'quantity', MAX_ITEM_QUANTITY),
  });
  if (!session) fail('ANONYMOUS_SESSION_NOT_FOUND', 'Anonymous shopping session was not found', 404);
  return session;
};

const removeAnonymousShoppingSessionItem = async ({ slug, token, productId }) => {
  const storefront = await resolveStorefront(slug);
  const session = await repository.removeItem({
    branchId: storefront.branchId,
    token: normalizeToken(token),
    productId: positiveInt(productId, 'productId'),
  });
  if (!session) fail('ANONYMOUS_SESSION_NOT_FOUND', 'Anonymous shopping session was not found', 404);
  return session;
};

const abandonAnonymousShoppingSession = async ({ slug, token }) => {
  const storefront = await resolveStorefront(slug);
  const abandoned = await repository.abandon({
    branchId: storefront.branchId,
    token: normalizeToken(token),
  });
  if (!abandoned) fail('ANONYMOUS_SESSION_NOT_FOUND', 'Anonymous shopping session was not found', 404);
  return { abandoned: true };
};

module.exports = Object.freeze({
  SESSION_TTL_HOURS,
  MAX_ITEM_QUANTITY,
  createAnonymousShoppingSession,
  getAnonymousShoppingSession,
  setAnonymousShoppingSessionItem,
  removeAnonymousShoppingSessionItem,
  abandonAnonymousShoppingSession,
});
