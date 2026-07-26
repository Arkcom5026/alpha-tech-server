const customerWarrantyAssetsService = require('./customerWarrantyAssetsService');
const { resolveRepairActor } = require('../../utils/repairActor');

async function listCustomerWarrantyAssets(req, res, next) {
  try {
    const actor = resolveRepairActor(req.user);
    const data = await customerWarrantyAssetsService.execute(
      actor,
      req.params.customerId
    );
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = { listCustomerWarrantyAssets };
