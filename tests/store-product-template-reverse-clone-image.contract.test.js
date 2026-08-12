const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8')

const serviceSource = read('src/modules/product/media/runtime/uploadProductRuntimeService.js')
const repositorySource = read('src/modules/product/media/runtime/uploadProductRuntimeRepository.js')

assert.match(repositorySource, /templateProductId: true/)
assert.match(repositorySource, /templateProduct:/)
assert.match(repositorySource, /uploadResult\?\.secure_url \|\| secureUrl \|\| url/)
assert.match(repositorySource, /uploadResult\?\.public_id \|\| publicId/)
assert.match(repositorySource, /PRODUCT_IMAGE_UPLOAD_RESULT_REQUIRED/)

assert.match(serviceSource, /syncUploadedImageToTemplate/)
assert.match(serviceSource, /syncTemplateImage/)
assert.match(serviceSource, /product\?\.templateProductId/)
assert.match(serviceSource, /uploadBufferToCloudinary\(normalizedFile\)/)
assert.match(serviceSource, /productId: Number\(product\.templateProductId\)/)
assert.match(serviceSource, /uploadResult: templateUpload/)
assert.match(serviceSource, /templateImageSync/)
assert.match(serviceSource, /status: 'SYNCED'/)
assert.match(serviceSource, /status: 'FAILED'/)
assert.match(serviceSource, /SYNC_NOT_REQUESTED/)
assert.match(serviceSource, /cloudinary\.uploader\.destroy\(templateUpload\.public_id/)

assert.doesNotMatch(serviceSource, /productTemplateCandidate|productTemplate\/candidates|promoteCandidate|createCandidate/)

console.log('Store Product Template Reverse Clone Image Contract: PASS')
