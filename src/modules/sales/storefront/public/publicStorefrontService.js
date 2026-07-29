'use strict';

const repository = require('./publicStorefrontRepository');

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const getPublicStorefront = async (input = {}) => {
  const slug = String(input.slug || '').trim().toLowerCase();

  if (!slug || !SLUG_PATTERN.test(slug)) {
    throw Object.assign(new Error('Invalid storefront slug'), {
      statusCode: 400,
      code: 'STOREFRONT_SLUG_INVALID',
    });
  }

  const storefront = await repository.findPublishedBySlug(slug);
  if (!storefront) {
    throw Object.assign(new Error('Storefront was not found'), {
      statusCode: 404,
      code: 'STOREFRONT_NOT_FOUND',
    });
  }

  return storefront;
};

module.exports = Object.freeze({ getPublicStorefront });
