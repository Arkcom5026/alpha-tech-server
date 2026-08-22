const {
  ProductTraceFailureCode,
  ProductTraceError,
} = require('../contracts/productTraceFailureCode')
const {
  RESIDUAL_POSITION_CAPABILITIES,
  hasResidualCapability,
} = require('../../../employee/authorization/residualPositionAuthority')

const PRODUCT_TRACE_CAPABILITY = Object.freeze({
  READ: RESIDUAL_POSITION_CAPABILITIES.PRODUCT_TRACE_READ,
  FINANCIAL: RESIDUAL_POSITION_CAPABILITIES.PRODUCT_TRACE_FINANCIAL,
})

const LEGACY_PRODUCT_TRACE_READ_ROLES = Object.freeze(['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN'])
const LEGACY_PRODUCT_TRACE_FINANCIAL_ROLES = Object.freeze(['OWNER', 'MANAGER'])

const buildProductTracePermissions = ({ actor, employeeProfile }) => {
  const role = String(actor?.role || '').toUpperCase()
  const employeeRole = String(actor?.employeeRole || employeeProfile?.v2Role || '').toUpperCase()
  const authorityActor = { ...actor, employeeRole }

  const canViewTrace = hasResidualCapability(
    authorityActor,
    PRODUCT_TRACE_CAPABILITY.READ,
    {
      legacyRoles: LEGACY_PRODUCT_TRACE_READ_ROLES,
      authenticatedFallback: true,
    },
  )
  const canViewFinancials = hasResidualCapability(
    authorityActor,
    PRODUCT_TRACE_CAPABILITY.FINANCIAL,
    { legacyRoles: LEGACY_PRODUCT_TRACE_FINANCIAL_ROLES },
  )

  return {
    canViewTrace,
    canViewFinancials,
    canViewSupplier: canViewFinancials,
    canViewCustomerContact: true,
    role: role || null,
    employeeRole: employeeRole || null,
  }
}

const assertCanViewProductTrace = (permissions) => {
  if (!permissions?.canViewTrace) {
    throw new ProductTraceError({
      code: ProductTraceFailureCode.PRODUCT_TRACE_FORBIDDEN,
      message: 'คุณไม่มีสิทธิ์ดูประวัติสินค้า',
      status: 403,
    })
  }
}

module.exports = {
  PRODUCT_TRACE_CAPABILITY,
  buildProductTracePermissions,
  assertCanViewProductTrace,
}
