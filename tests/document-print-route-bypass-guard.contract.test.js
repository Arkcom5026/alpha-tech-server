'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const controller = fs.readFileSync(
  path.join(__dirname, '../src/modules/storeDevice/controllers/storeDeviceDurableJobController.js'),
  'utf8',
)
const routes = fs.readFileSync(
  path.join(__dirname, '../src/modules/storeDevice/routes/storeDeviceRoutes.js'),
  'utf8',
)

assert.match(controller, /jobType === 'PRINT_DOCUMENT'/)
assert.match(controller, /STORE_DEVICE_PRINT_ROUTE_REQUIRED/)
assert.match(routes, /\/print\/sale-receipts\/:paymentId\/jobs/)
assert.match(routes, /\/print\/delivery-notes\/:saleId\/jobs/)
assert.match(routes, /\/print\/output-tax-invoices\/:taxDocumentId\/jobs/)

for (const file of [
  'createSaleReceiptPrintJobController.js',
  'createDeliveryNotePrintJobController.js',
  'createOutputTaxInvoicePrintJobController.js',
]) {
  const source = fs.readFileSync(path.join(__dirname, '../src/modules/storeDevice/print', file), 'utf8')
  assert.match(source, /createResolveConfiguredPrintRouteService/)
}

console.log('Document print route bypass guard contract: PASS')
