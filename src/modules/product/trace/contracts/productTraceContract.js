const PRODUCT_TRACE_CONTRACT_VERSION = '1.0.0'

const createProductTraceResponse = ({
  query,
  identity,
  procurement,
  inventory,
  sales,
  returns,
  claims,
  repairs,
  summary,
  timeline,
  permissions,
}) => ({
  contractVersion: PRODUCT_TRACE_CONTRACT_VERSION,
  query,
  identity,
  procurement,
  inventory,
  sales,
  returns,
  claims,
  repairs,
  summary,
  timeline,
  permissions,
})

module.exports = {
  PRODUCT_TRACE_CONTRACT_VERSION,
  createProductTraceResponse,
}
