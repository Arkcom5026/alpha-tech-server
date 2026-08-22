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

const imageFile = {
  buffer: Buffer.from('image-bytes'),
  mimetype: 'image/png',
  size: 11,
};

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
          public_id: `${options.folder}/${options.public_id}`,
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
    file: imageFile,
  });

  assert.strictEqual(capturedOptions.folder, 'stores/branch-7/logo');
  assert.strictEqual(capturedOptions.public_id, 'fixed-id');
  assert.strictEqual(capturedOptions.overwrite, false);
  assert.strictEqual(capturedOptions.unique_filename, false);
  assert.strictEqual(result.branchId, 7);
  assert.strictEqual(result.purpose, 'STORE_LOGO');
  assert.strictEqual(result.provider, 'cloudinary');
  assert.strictEqual(result.publicId, 'stores/branch-7/logo/fixed-id');

  await assert.rejects(
    () => service.upload({ branchId: 0, purpose: 'STORE_LOGO', file: imageFile }),
    (error) => error.code === 'EMPLOYEE_BRANCH_CONTEXT_REQUIRED' && error.statusCode === 403
  );
  await assert.rejects(
    () => service.upload({ branchId: 7, purpose: 'OTHER', file: imageFile }),
    (error) => error.code === 'INVALID_STOREFRONT_MEDIA_PURPOSE'
  );
  await assert.rejects(
    () => service.upload({ branchId: 7, purpose: 'STORE_LOGO', file: { buffer: Buffer.from('x'), mimetype: 'text/plain' } }),
    (error) => error.code === 'STOREFRONT_MEDIA_IMAGE_REQUIRED'
  );

  const providerFailure = createStorefrontMediaService({
    cloudinaryClient: {
      uploader: {
        upload_stream(_options, callback) {
          const stream = new PassThrough();
          stream.on('finish', () => callback(Object.assign(new Error('provider 404'), { http_code: 404 })));
          stream.resume();
          return stream;
        },
      },
    },
    idFactory: () => 'failed-id',
  });
  await assert.rejects(
    () => providerFailure.upload({ branchId: 7, purpose: 'STORE_HERO', file: imageFile }),
    (error) => error.code === 'STOREFRONT_MEDIA_PROVIDER_UPLOAD_FAILED' && error.statusCode === 502 && error.cause?.http_code === 404
  );

  const invalidResponse = createStorefrontMediaService({
    cloudinaryClient: {
      uploader: {
        upload_stream(_options, callback) {
          const stream = new PassThrough();
          stream.on('finish', () => callback(null, {}));
          stream.resume();
          return stream;
        },
      },
    },
    idFactory: () => 'invalid-id',
  });
  await assert.rejects(
    () => invalidResponse.upload({ branchId: 7, purpose: 'STORE_COVER', file: imageFile }),
    (error) => error.code === 'STOREFRONT_MEDIA_PROVIDER_RESPONSE_INVALID' && error.statusCode === 502
  );

  const routesSource = fs.readFileSync(path.join(__dirname, '../src/modules/storeExperience/media/storefrontMediaRoutes.js'), 'utf8');
  assert.match(routesSource, /router\.use\(verifyToken\)/);
  assert.match(routesSource, /router\.post\('\/upload', allowManage,/);
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
