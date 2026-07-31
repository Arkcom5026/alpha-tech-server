const { prisma } = require('../../../../../lib/prisma');
const {
  createCombinedBillingDocumentRepository,
} = require('./createCombinedBillingDocumentRepository');
const {
  createCombinedBillingDocumentService,
} = require('./createCombinedBillingDocumentService');

const repository = createCombinedBillingDocumentRepository({ prisma });
const service = createCombinedBillingDocumentService({ repository });

const createCombinedBillingDocument = async (req, res) => {
  try {
    const document = await service.create({
      branchId: req.user?.branchId,
      employeeId: req.user?.employeeId,
      saleIds: req.body?.saleIds,
      note: req.body?.note,
    });

    return res.status(201).json(document);
  } catch (error) {
    console.error('❌ [createCombinedBillingDocument] error:', error);

    if (error.statusCode === 401) {
      return res.status(401).json({ code: error.code, error: error.message });
    }
    if (error.statusCode === 403) {
      return res.status(403).json({ code: error.code, error: error.message });
    }
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({
      error: error?.message || 'ไม่สามารถสร้างเอกสารรวมได้',
    });
  }
};

module.exports = { createCombinedBillingDocument };
