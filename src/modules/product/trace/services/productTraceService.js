const {
  ProductTraceFailureCode,
  ProductTraceError,
} = require('../contracts/productTraceFailureCode')
const {
  findEmployeeAuthorizationContext,
  findProductTraceByLookup,
} = require('../repositories/productTraceRepository')
const {
  buildProductTracePermissions,
  assertCanViewProductTrace,
} = require('../policies/productTracePolicy')
const { buildProductTraceIdentity } = require('../builders/productTraceIdentityBuilder')
const { buildProductTraceProcurement } = require('../builders/productTraceProcurementBuilder')
const { buildProductTraceInventory } = require('../builders/productTraceInventoryBuilder')
const { buildProductTraceSales } = require('../builders/productTraceSalesBuilder')
const { buildProductTraceReturns } = require('../builders/productTraceReturnBuilder')
const { buildProductTraceClaims } = require('../builders/productTraceClaimBuilder')
const { buildProductTraceRepairs } = require('../builders/productTraceRepairBuilder')
const { buildProductTraceSummary } = require('../builders/productTraceSummaryBuilder')
const { buildProductTraceTimeline } = require('../builders/productTraceTimelineBuilder')
const { mapProductTraceTimeline } = require('../mappers/productTraceTimelineMapper')
const { mapProductTraceResponse } = require('../mappers/productTraceMapper')

const getProductTraceByLookup = async ({ lookup, branchId, actor }) => {
  const employeeProfile = await findEmployeeAuthorizationContext({
    employeeId: actor?.employeeId || actor?.profileId,
  })

  const permissions = buildProductTracePermissions({ actor, employeeProfile })
  assertCanViewProductTrace(permissions)

  const stockItem = await findProductTraceByLookup({ lookup, branchId })

  if (!stockItem) {
    throw new ProductTraceError({
      code: ProductTraceFailureCode.STOCK_ITEM_NOT_FOUND,
      message: 'ไม่พบสินค้าจากบาร์โค้ดหรือหมายเลขซีเรียลนี้ในสาขาของคุณ',
      status: 404,
    })
  }

  const identity = buildProductTraceIdentity(stockItem)
  const procurement = buildProductTraceProcurement(stockItem, permissions)
  const inventory = buildProductTraceInventory(stockItem)
  const sales = buildProductTraceSales(stockItem, permissions)
  const returns = buildProductTraceReturns(stockItem, permissions)
  const claims = buildProductTraceClaims(stockItem)
  const repairs = buildProductTraceRepairs(stockItem, permissions)
  const summary = buildProductTraceSummary({ stockItem, returns, permissions })
  const timeline = mapProductTraceTimeline(buildProductTraceTimeline({
    stockItem,
    procurement,
    sales,
    returns,
    claims,
    repairs,
    permissions,
  }))

  return mapProductTraceResponse({
    query: { lookup, matchedBy: stockItem.barcode === lookup ? 'BARCODE' : 'SERIAL_NUMBER' },
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
}

module.exports = {
  getProductTraceByLookup,
}
