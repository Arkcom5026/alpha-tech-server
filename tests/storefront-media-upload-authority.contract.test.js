'use strict';

const assert = require('assert');
const { PassThrough } = require('stream');
const fs = require('fs');
const path = require('path');

const {
  createStorefrontMediaService,
  PURPOSES,
} = require('../src/modules/storeExperience/media/storefrontMediaService');
const { MAX_FILE_SIZE_BYTES } = require('../src/modules/storeExperience/media/storefrontMediaUpload');

const run = async () => {
  assert.deepStrictEqual(Object.keys(PURPOSES), [
    'STORE_LOGO',
    'STORE_COVER',
    'STORE_HERO',
    'STORE_PROMOTION',
  ]);
  assert.strictEqual(MAX_FILE_SIZE_BYTES, 5 * 1024 * 1024);

  let capturedOptions;
  const fakeCloudinary = {
    uploader: {
      upload_stream(options, callback) {
        capturedOptions = options;
        const stream = new PassThrough();
        stream.on('finish', () => callback(null, {
          secure_url: 'https://cdn.example.test/logo.png',
          public_id: options.public_id,
          width: 800,
          height: 400,
          bytes: 1234,
          format: 'png',
          resource_type: 'image',
        }));
        stream.resume();
        return stream;
      },
    },
  };

  const service = createStorefrontMediaService({
    cloudinaryClient: fakeCloudinary,
    idFactory: () => 'fixed-id',
  });

  const result = await service.upload({
    branchId: 7,
    purpose: 'store_logo',
    file: {
      buffer: Buffer.from('image-bytes'),
      mimetype: 'image/png',
      size: 11,
    },
  });

  assert.strictEqual(capturedOptions.public_id, 'stores/branch-7/logo/fixed-id');
  assert.strictEqual(capturedOptions.overwrite, false);
  assert.strictEqual(result.branchId, 7);
  assert.strictEqual(result.purpose, 'STORE_LOGO');
  assert.strictEqual(result.provider, 'cloudinary');
  assert.strictEqual(result.publicId, 'stores/branch-7/logo/fixed-id');

  await assert.rejects(
    () => service.upload({ branchId: 0, purpose: 'STORE_LOGO', file: { buffer: Buffer.from('x'), mimetype: 'image/png' } }),
    (error) => error.code === 'EMPLOYEE_BRANCH_CONTEXT_REQUIRED' && error.statusCode === 403
  );
  await assert.rejects(
    () => service.upload({ branchId: 7, purpose: 'OTHER', file: { buffer: Buffer.from('x'), mimetype: 'image/png' } }),
    (error) => error.code === 'INVALID_STOREFRONT_MEDIA_PURPOSE'
  );
  await assert.rejects(
    () => service.upload({ branchId: 7, purpose: 'STORE_LOGO', file: { buffer: Buffer.from('x'), mimetype: 'text/plain' } }),
    (error) => error.code === 'STOREFRONT_MEDIA_IMAGE_REQUIRED'
  );

  const routesSource = fs.readFileSync(path.join(__dirname, '../src/modules/storeExperience/media/storefrontMediaRoutes.js'), 'utf8');
  assert.match(routesSource, /router\.use\(verifyToken, allowEmployeeContext\)/);
  assert.match(routesSource, /single\('file'\)/);

  const controllerSource = fs.readFileSync(path.join(__dirname, '../src/modules/storeExperience/media/storefrontMediaController.js'), 'utf8');
  assert.match(controllerSource, /req\.employee\?\.branchId \|\| req\.user\?\.branchId/);
  assert.doesNotMatch(controllerSource, /req\.body\?\.branchId/);

  console.log('PASS storefront media upload authority contract');
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
