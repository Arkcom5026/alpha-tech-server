'use strict'

const {
  createWindowsBrowserPdfPrintRenderService,
} = require('./windowsBrowserPdfPrintRenderService')
const {
  renderSaleReceipt80mmHtml,
} = require('./saleReceipt80mmHtmlRenderer')

const fail = (code, message, statusCode = 400) =>
  Object.assign(new Error(message), { code, statusCode })

const createSaleReceipt80mmPdfRenderService = ({
  readinessService,
  transport,
} = {}) => createWindowsBrowserPdfPrintRenderService({
  readinessService,
  transport,
  renderHtml({ documentPurpose, projection }) {
    if (documentPurpose?.code !== 'SALE_RECEIPT') {
      throw fail(
        'STORE_DEVICE_SALE_RECEIPT_80MM_PURPOSE_INVALID',
        'Sale receipt 80mm PDF renderer requires SALE_RECEIPT document purpose',
        409,
      )
    }

    return renderSaleReceipt80mmHtml({ projection })
  },
})

module.exports = {
  createSaleReceipt80mmPdfRenderService,
}
