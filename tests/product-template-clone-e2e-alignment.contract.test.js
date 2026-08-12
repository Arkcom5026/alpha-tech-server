const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8')

const serviceSource = read('src/modules/product/templateClone/services/productTemplateCloneService.js')
const controllerSource = read('src/modules/product/templateClone/controllers/productTemplateCloneController.js')
const routeSource = read('src/modules/product/routes/productRoutes.js')
const quickStockServiceSource = read('src/modules/product/quickStock/services/QuickStockService.js')

assert.match(routeSource, /router\.post\('\/pos\/create-from-template', productTemplateCloneController\.createOperationalProductFromTemplate\)/)
assert.doesNotMatch(quickStockServiceSource, /productTemplateEngine/)
assert.doesNotMatch(quickStockServiceSource, /cloneProductFromTemplate/)

assert.match(controllerSource, /branchId:\s*req\.user\?\.branchId/)
assert.match(controllerSource, /employeeId:\s*req\.employee\?\.id\s*\|\|\s*req\.user\?\.employeeId/)
assert.match(controllerSource, /role:\s*req\.user\?\.role/)
assert.match(controllerSource, /v2Role:\s*req\.employee\?\.role/)
assert.match(controllerSource, /const status = Number\(error\?\.status \|\| error\?\.statusCode\)/)
assert.match(controllerSource, /status >= 400 && status < 500/)
assert.match(controllerSource, /return res\.status\(status\)\.json/)

assert.match(serviceSource, /findOperationalRuntimeProductByTemplateId/)
assert.match(serviceSource, /created:\s*false/)
assert.match(serviceSource, /exists:\s*true/)
assert.match(serviceSource, /TARGET_BRANCH_CANNOT_BE_TEMPLATE_BRANCH/)

assert.match(serviceSource, /fetchTemplateCloneDefaults/)
assert.match(serviceSource, /productImages:/)
assert.match(serviceSource, /branchPrice:/)
assert.match(serviceSource, /Cloned from Product Template/)

assert.match(serviceSource, /ensureSelectedBrandMapping/)
assert.match(serviceSource, /db\.productTypeBrand\.create/)
assert.match(serviceSource, /error\?\.code === 'P2002'/)

assert.match(serviceSource, /resolveCloneSaleBarcode/)
assert.match(serviceSource, /productType:\s*\{ branchId:\s*Number\(branchId\) \}/)
assert.match(serviceSource, /return conflict \? null : saleBarcode/)

assert.match(serviceSource, /priceAuthorityPolicy\.assertPricePayload/)
assert.match(serviceSource, /employeeId:\s*toInt\(employeeId\)/)

assert.match(serviceSource, /templateProduct:\s*\{ connect:\s*\{ id:\s*tplId \} \}/)
assert.match(serviceSource, /branch:\s*\{ connect:\s*\{ id:\s*brId \} \}/)

console.log('Product Template Clone E2E Alignment Contract: PASS')
