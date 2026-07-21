const {
  ProductTraceFailureCode,
  ProductTraceError,
} = require('../contracts/productTraceFailureCode')

const FINANCIAL_ROLES = new Set(['SUPERADMIN', 'ADMIN'])
const FINANCIAL_EMPLOYEE_ROLES = new Set(['OWNER', 'MANAGER'])

const buildProductTracePermissions = ({ actor, employeeProfile }) => {
  const role = String(actor?.role || '').toUpperCase()
  const employeeRole = String(employeeProfile?.v2Role || '').toUpperCase()

  const canViewFinancials =
    FINANCIAL_ROLES.has(role) || FINANCIAL_EMPLOYEE_ROLES.has(employeeRole)

  return {
    canViewTrace: Boolean(actor?.id),
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
