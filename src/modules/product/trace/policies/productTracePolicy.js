const {
  ProductTraceFailureCode,
  ProductTraceError,
} = require('../contracts/productTraceFailureCode')
const {
  OPERATIONAL_RESIDUAL_CAPABILITIES,
  hasOperationalResidualCapability,
} = require('../../../employee/authorization/operationalResidualAuthority')

const buildProductTracePermissions = ({ actor, employeeProfile }) => {
  const role = String(actor?.role || '').trim().toUpperCase()
  const employeeRole = String(actor?.employeeRole || actor?.v2Role || employeeProfile?.v2Role || '').trim().toUpperCase()
  const employeeId = Number(actor?.employeeId || actor?.profileId || employeeProfile?.id)
  const employeeContext = Number.isInteger(employeeId) && employeeId > 0
  const platformAdmin = actor?.isSuperAdmin === true || ['ADMIN', 'SUPERADMIN', 'SUPPERADMIN'].includes(role)
  const authorityActor = {
    ...actor,
    employeeRole,
  }

  const canViewTrace = employeeContext || platformAdmin
    ? hasOperationalResidualCapability(
      authorityActor,
      OPERATIONAL_RESIDUAL_CAPABILITIES.PRODUCT_TRACE_READ,
    )
    : Boolean(actor?.id)

  const canViewFinancials = employeeContext || platformAdmin
    ? hasOperationalResidualCapability(
      authorityActor,
      OPERATIONAL_RESIDUAL_CAPABILITIES.PRODUCT_TRACE_FINANCIAL,
    )
    : false

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
  buildProductTracePermissions,
  assertCanViewProductTrace,
}
