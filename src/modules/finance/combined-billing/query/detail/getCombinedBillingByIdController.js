const { GetCombinedBillingByIdService } = require('./getCombinedBillingByIdService');

const service = new GetCombinedBillingByIdService();

const getCombinedBillingById = async (req, res) => {
  try {
    const document = await service.execute({
      id: req.params?.id,
      branchId: req.user?.branchId,
    });

    return res.json(document);
  } catch (error) {
    console.error('❌ [getCombinedBillingById] error:', error);
    return res.status(error?.statusCode || 500).json({
      error: error?.message || 'ไม่สามารถโหลดเอกสารได้',
    });
  }
};

module.exports = { getCombinedBillingById };
