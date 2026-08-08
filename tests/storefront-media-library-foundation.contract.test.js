'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  createStorefrontMediaService,
  DEFAULT_LIBRARY_PAGE_SIZE,
  MAX_LIBRARY_PAGE_SIZE,
  normalizePageSize,
  purposeFromPublicId,
} = require('../src/modules/storeExperience/media/storefrontMediaService');

const run = async () => {
  assert.strictEqual(DEFAULT_LIBRARY_PAGE_SIZE, 24);
  assert.strictEqual(MAX_LIBRARY_PAGE_SIZE, 60);
  assert.strictEqual(normalizePageSize(undefined), 24);
  assert.strictEqual(normalizePageSize(0), 24);
  assert.strictEqual(normalizePageSize(12), 12);
  assert.strictEqual(normalizePageSize(100), 60);
  assert.strictEqual(purposeFromPublicId('stores/branch-13/hero/abc', 13), 'STORE_HERO');
  assert.strictEqual(purposeFromPublicId('stores/branch-99/hero/abc', 13), null);

  let capturedOptions;
  const fakeCloudinary = {
    api: {
      async resources(options) {
        capturedOptions = options;
        return {
          resources: [
            {
              public_id: 'stores/branch-13/hero/hero-1',
              secure_url: 'https://cdn.example.test/hero-1.jpg',
              width: 1600,
              height: 600,
              bytes: 4567,
              format: 'jpg',
              resource_type: 'image',
              created_at: '2026-08-06T10:00:00Z',
            },
            {
              public_id: 'stores/branch-99/hero/leak',
              secure_url: 'https://cdn.example.test/leak.jpg',
            },
          ],
          next_cursor: 'cursor-2',
        };
      },
    },
  };

  const repository = {
    async findExperienceUsageByBranchId(branchId) {
      assert.strictEqual(branchId, 13);
      return { contentConfiguration: null, publishedContentConfiguration: null };
    },
  };
  const service = createStorefrontMediaService({ cloudinaryClient: fakeCloudinary, repository });
  const result = await service.list({
    branchId: 13,
    purpose: 'store_hero',
    pageSize: 100,
    nextCursor: 'cursor-1',
  });

  assert.deepStrictEqual(capturedOptions, {
    resource_type: 'image',
    type: 'upload',
    prefix: 'stores/branch-13/hero/',
    max_results: 60,
    direction: 'desc',
    next_cursor: 'cursor-1',
  });
  assert.strictEqual(result.branchId, 13);
  assert.strictEqual(result.purpose, 'STORE_HERO');
  assert.strictEqual(result.assets.length, 1);
  assert.strictEqual(result.assets[0].purpose, 'STORE_HERO');
  assert.strictEqual(result.assets[0].publicId, 'stores/branch-13/hero/hero-1');
  assert.strictEqual(result.assets[0].createdAt, '2026-08-06T10:00:00Z');
  assert.strictEqual(result.assets[0].usage.state, 'UNUSED');
  assert.strictEqual(result.assets[0].deletable, false);
  assert.strictEqual(result.nextCursor, 'cursor-2');

  await assert.rejects(
    () => service.list({ branchId: 0 }),
    (error) => error.code === 'EMPLOYEE_BRANCH_CONTEXT_REQUIRED' && error.statusCode === 403
  );
  await assert.rejects(
    () => service.list({ branchId: 13, purpose: 'PRODUCT' }),
    (error) => error.code === 'INVALID_STOREFRONT_MEDIA_PURPOSE'
  );

  const failingService = createStorefrontMediaService({
    cloudinaryClient: {
      api: {
        async resources() {
          throw Object.assign(new Error('provider detail must stay private'), { http_code: 401 });
        },
      },
    },
    repository,
  });
  await assert.rejects(
    () => failingService.list({ branchId: 13 }),
    (error) => error.code === 'STOREFRONT_MEDIA_PROVIDER_LIST_FAILED'
      && error.statusCode === 502
      && error.message === 'ไม่สามารถโหลดคลังรูปภาพจากผู้ให้บริการได้'
  );

  const routesSource = fs.readFileSync(
    path.join(__dirname, '../src/modules/storeExperience/media/storefrontMediaRoutes.js'),
    'utf8'
  );
  assert.match(routesSource, /router\.use\(verifyToken, allowEmployeeContext\)/);
  assert.match(routesSource, /router\.get\('\/'\s*,\s*controller\.listStorefrontMedia\)/);

  const controllerSource = fs.readFileSync(
    path.join(__dirname, '../src/modules/storeExperience/media/storefrontMediaController.js'),
    'utf8'
  );
  assert.match(controllerSource, /req\.employee\?\.branchId \|\| req\.user\?\.branchId/);
  assert.match(controllerSource, /purpose:\s*req\.query\?\.purpose/);
  assert.doesNotMatch(controllerSource, /req\.query\?\.branchId/);
  assert.doesNotMatch(controllerSource, /req\.body\?\.branchId/);

  console.log('PASS storefront media library foundation contract');
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
