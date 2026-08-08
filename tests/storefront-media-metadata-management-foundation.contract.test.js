'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  PURPOSE_CONTENT_FIELDS,
  normalizeSearch,
  usageStateOf,
  classifyUsage,
  matchesSearch,
  createStorefrontMediaService,
} = require('../src/modules/storeExperience/media/storefrontMediaService');

const run = async () => {
  assert.deepStrictEqual(PURPOSE_CONTENT_FIELDS, {
    STORE_LOGO: 'logoUrl',
    STORE_COVER: 'coverImageUrl',
    STORE_HERO: 'heroImageUrl',
    STORE_PROMOTION: 'promotionImageUrl',
  });
  assert.strictEqual(normalizeSearch('  HERO-ONE  '), 'hero-one');
  assert.strictEqual(normalizeSearch('x'.repeat(200)).length, 120);
  assert.strictEqual(usageStateOf({ draft: true, published: true }), 'DRAFT_AND_PUBLISHED');
  assert.strictEqual(usageStateOf({ draft: true, published: false }), 'DRAFT');
  assert.strictEqual(usageStateOf({ draft: false, published: true }), 'PUBLISHED');
  assert.strictEqual(usageStateOf({ draft: false, published: false }), 'UNUSED');

  const heroAsset = {
    purpose: 'STORE_HERO',
    secureUrl: 'https://cdn.example.test/hero-draft.jpg',
    publicId: 'stores/branch-13/hero/hero-draft',
  };
  const classified = classifyUsage(heroAsset, {
    contentConfiguration: { heroImageUrl: heroAsset.secureUrl },
    publishedContentConfiguration: { heroImageUrl: heroAsset.secureUrl },
  });
  assert.deepStrictEqual(classified.usage, {
    draft: true,
    published: true,
    state: 'DRAFT_AND_PUBLISHED',
  });
  assert.strictEqual(classified.deletable, false);
  assert.strictEqual(matchesSearch(heroAsset, 'hero-draft'), true);
  assert.strictEqual(matchesSearch(heroAsset, 'promotion'), false);

  let usageLookupBranchId = null;
  const service = createStorefrontMediaService({
    cloudinaryClient: {
      api: {
        async resources() {
          return {
            resources: [
              {
                public_id: 'stores/branch-13/hero/hero-draft',
                secure_url: 'https://cdn.example.test/hero-draft.jpg',
                width: 1600,
                height: 600,
                bytes: 204800,
                format: 'jpg',
                resource_type: 'image',
                created_at: '2026-08-06T12:00:00Z',
              },
              {
                public_id: 'stores/branch-13/hero/hero-unused',
                secure_url: 'https://cdn.example.test/hero-unused.jpg',
                width: 1200,
                height: 500,
                bytes: 102400,
                format: 'jpg',
                resource_type: 'image',
                created_at: '2026-08-06T11:00:00Z',
              },
            ],
            next_cursor: null,
          };
        },
      },
    },
    repository: {
      async findExperienceUsageByBranchId(branchId) {
        usageLookupBranchId = branchId;
        return {
          contentConfiguration: { heroImageUrl: 'https://cdn.example.test/hero-draft.jpg' },
          publishedContentConfiguration: { heroImageUrl: 'https://cdn.example.test/hero-draft.jpg' },
        };
      },
    },
  });

  const result = await service.list({
    branchId: 13,
    purpose: 'STORE_HERO',
    search: 'draft',
  });

  assert.strictEqual(usageLookupBranchId, 13);
  assert.strictEqual(result.search, 'draft');
  assert.strictEqual(result.assets.length, 1);
  assert.strictEqual(result.assets[0].publicId, 'stores/branch-13/hero/hero-draft');
  assert.strictEqual(result.assets[0].usage.state, 'DRAFT_AND_PUBLISHED');
  assert.strictEqual(result.assets[0].deletable, false);

  const usageFailureService = createStorefrontMediaService({
    cloudinaryClient: {
      api: {
        async resources() {
          return { resources: [] };
        },
      },
    },
    repository: {
      async findExperienceUsageByBranchId() {
        throw new Error('database detail must stay private');
      },
    },
  });
  await assert.rejects(
    () => usageFailureService.list({ branchId: 13 }),
    (error) => error.code === 'STOREFRONT_MEDIA_USAGE_LOOKUP_FAILED'
      && error.statusCode === 500
      && error.message === 'ไม่สามารถตรวจสอบการใช้งานรูปภาพได้'
  );

  const repositorySource = fs.readFileSync(
    path.join(__dirname, '../src/modules/storeExperience/media/storefrontMediaRepository.js'),
    'utf8'
  );
  assert.match(repositorySource, /where:\s*\{ branchId \}/);
  assert.match(repositorySource, /contentConfiguration:\s*true/);
  assert.match(repositorySource, /publishedContentConfiguration:\s*true/);

  const controllerSource = fs.readFileSync(
    path.join(__dirname, '../src/modules/storeExperience/media/storefrontMediaController.js'),
    'utf8'
  );
  assert.match(controllerSource, /search:\s*req\.query\?\.search/);
  assert.doesNotMatch(controllerSource, /req\.query\?\.branchId/);

  const serviceSource = fs.readFileSync(
    path.join(__dirname, '../src/modules/storeExperience/media/storefrontMediaService.js'),
    'utf8'
  );
  assert.match(serviceSource, /deletable:\s*false/);
  assert.doesNotMatch(serviceSource, /uploader\.destroy/);
  assert.doesNotMatch(serviceSource, /delete_resources/);

  console.log('PASS storefront media metadata management foundation contract');
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
