const { createProductTraceResponse } = require('../contracts/productTraceContract')

const mapProductTraceResponse = (projection) => createProductTraceResponse(projection)

module.exports = {
  mapProductTraceResponse,
}
