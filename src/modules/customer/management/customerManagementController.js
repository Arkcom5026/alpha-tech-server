const service = require('./customerManagementService');

const send = (res, result) => res.status(result.status).json(result.body);

async function listCustomers(req, res) {
  try {
    return send(res, await service.listCustomers({
      user: req.user || {},
      scope: req.query?.scope,
      query: req.query?.q,
      limit: req.query?.limit,
    }));
  } catch (error) {
    console.error('[customerManagementController] list failed:', error);
    return res.status(500).json({ code: 'CUSTOMER_MANAGEMENT_LIST_FAILED', message: 'โหลดรายการลูกค้าไม่สำเร็จ' });
  }
}

async function getCustomerDetail(req, res) {
  try {
    return send(res, await service.getCustomerDetail({
      user: req.user || {},
      customerProfileId: req.params?.id,
    }));
  } catch (error) {
    console.error('[customerManagementController] detail failed:', error);
    return res.status(500).json({ code: 'CUSTOMER_MANAGEMENT_DETAIL_FAILED', message: 'โหลดรายละเอียดลูกค้าไม่สำเร็จ' });
  }
}

async function claimLegacyCustomer(req, res) {
  try {
    return send(res, await service.claimLegacyCustomer({
      user: req.user || {},
      customerProfileId: req.params?.id,
    }));
  } catch (error) {
    console.error('[customerManagementController] claim failed:', error);
    return res.status(500).json({ code: 'CUSTOMER_LEGACY_CLAIM_FAILED', message: 'รับลูกค้าเข้าร้านไม่สำเร็จ' });
  }
}

module.exports = { listCustomers, getCustomerDetail, claimLegacyCustomer };
