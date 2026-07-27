const {
  findOpenReadyAudit,
  listExpectedStockItems,
  createReadyAudit,
} = require('./startAuditRepository');

const startReadyStockAudit = async ({
  branchId,
  employeeId,
  findOpen = findOpenReadyAudit,
  listExpected = listExpectedStockItems,
  createAudit = createReadyAudit,
}) => {
  if (!Number.isFinite(branchId)) {
    return { status: 401, body: { message: 'Unauthorized: missing user/branchId' } };
  }

  const existing = await findOpen({ branchId });
  if (existing) {
    return {
      status: 409,
      body: {
        message: 'มีรอบตรวจแบบ DRAFT อยู่แล้ว',
        sessionId: existing.id,
        expectedCount: existing.expectedCount,
      },
    };
  }

  const expected = await listExpected({ branchId });
  const session = await createAudit({ branchId, employeeId, expected });

  return {
    status: 201,
    body: { sessionId: session.id, expectedCount: expected.length },
  };
};

module.exports = { startReadyStockAudit };
