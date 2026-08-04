'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repositoryPath = path.join(
  __dirname,
  '..',
  'src',
  'modules',
  'sales',
  'storefront',
  'public',
  'publicStorefrontRepository.js'
);

const source = fs.readFileSync(repositoryPath, 'utf8');

assert(source.includes('const publishedProductFromSql = Prisma.sql`'), 'FROM/JOIN fragment must be isolated');
assert(source.includes('const publishedProductWhereSql = (branchId) => Prisma.sql`'), 'WHERE fragment must be isolated');
assert(!source.includes('const publishedProductSql = (branchId)'), 'legacy combined SQL fragment must be retired');

const listQueryStart = source.indexOf('const listPublishedProducts');
const detailQueryStart = source.indexOf('const findPublishedProductById');
const listSource = source.slice(listQueryStart, detailQueryStart);

const fromIndex = listSource.indexOf('${publishedProductFromSql}');
const lateralIndex = listSource.indexOf('LEFT JOIN LATERAL');
const whereIndex = listSource.indexOf('${publishedProductWhereSql(branchId)}');

assert(fromIndex >= 0, 'list query must include FROM/JOIN fragment');
assert(lateralIndex > fromIndex, 'cover image LATERAL join must follow FROM/JOIN fragment');
assert(whereIndex > lateralIndex, 'visibility WHERE predicates must follow every JOIN');

console.log('public storefront product query order contract: PASS');
