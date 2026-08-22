'use strict';

const {
  ProductTraceFailureCode,
  ProductTraceError,
} = require('../contracts/productTraceFailureCode')
const {
  RESIDUAL_BUSINESS_CAPABILITIES,
  hasResidualBusinessCapability,
} = require('../../employee/authorization/residualBusinessPositionAuthority')

const buildProductTracePermissions = ({ actor = {}, employeeProfile = null }) => {
  const authorityActor = {
    ...actor,
    employeeRole: actor.employeeRole || actor.v2Role || employeeProfile?.v2Role || null,
  }
  const employeeContext = Boolean(
    employeeProfile
      || Number(authorityActor.employeeId || authorityActor.profileId) > 0
      || String(authorityActor.profileType || '').trim().toLowerCase() === 'employee',
  )

  const canViewTrace = employeeContext
    ? hasResidualBusinessCapability(authorityActor, RESIDUAL_BUSINESS_CAPABILITIES.PRODUCT_TRACE_READ)
    : Boolean(authorityActor.id)
  const canViewFinancials = hasResidualBusinessCapability(
    authorityActor,
    RESIDUAL_BUSINESS_CAPABILITIES.PRODUCT_TRACE_FINANCIAL,
  )

  return {
    canViewTrace,
    canViewFinancials,
    canViewSupplier: canViewFinancials,
    canViewCustomerContact: true,
    role: String(authorityActor.role || '').trim().toUpperCase() || null,
    employeeRole: String(authorityActor.employeeRole || '').trim().toUpperCase() || null,
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
