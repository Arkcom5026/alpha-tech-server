'use strict'

function normalizeStockItemReceivePayload(req, _res, next) {
  const body = req.body

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return next()
  }

  if (
    body.barcode &&
    typeof body.barcode === 'object' &&
    typeof body.barcode.barcode === 'string'
  ) {
    return next()
  }

  const barcode =
    typeof body.barcode === 'string'
      ? body.barcode
      : typeof body.code === 'string'
        ? body.code
        : null

  if (barcode) {
    req.body = {
      barcode: {
        barcode,
        serialNumber: body.serialNumber,
      },
    }
  }

  return next()
}

module.exports = { normalizeStockItemReceivePayload }
