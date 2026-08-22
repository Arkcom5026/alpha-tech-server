'use strict'

const {
  ProductTraceFailureCode,
  ProductTraceError,
} = require('../contracts/productTraceFailureCode')
const {
  OPERATIONAL_RESIDUAL_CAPABILITIES,
  resolveResidualCapability,
} = require('../../../employee/authorization/operationalResidualAuthority')

const buildProductTracePermissions = ({ actor = {}, employeeProfile }) => {
  const authorityActor = {
    ...actor,
    employeeRole: actor.employeeRole || actor.v2Role || employeeProfile?.v2Role || null,
  }
  const role = String(authorityActor.role || '').trim().toUpperCase()
  const employeeRole = String(authorityActor.employeeRole || '').trim().toUpperCase()

  const canViewTrace = resolveResidualCapability(
    authorityActor,
    OPERATIONAL_RESIDUAL_CAPABILITIES.PRODUCT_TRACE_READ,
    { legacyAuthenticated: true },
  )
  const canViewFinancials = resolveResidualCapability(
    authorityActor,
    OPERATIONAL_RESIDUAL_CAPABILITIES.PRODUCT_TRACE_FINANCIALS,
    { legacyRoles: ['OWNER', 'MANAGER'] },
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
  buildProductTracePermissions,
  assertCanViewProductTrace,
}
