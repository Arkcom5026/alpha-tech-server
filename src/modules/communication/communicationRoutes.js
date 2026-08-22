const express = require('express');
const verifyToken = require('../../../middlewares/verifyToken');
const AppError = require('../../shared/errors/AppError');
const service = require('./communicationService');
const { requireCommunicationCapability } = require('./communicationAccessPolicy');

const router = express.Router();
router.use(verifyToken);
router.use((req, _res, next) => {
  try {
    // verifyToken already revalidates User + EmployeeProfile against the database on
    // every request (enabled / approved / active / branch). Re-querying the same
    // EmployeeProfile here adds an avoidable database round-trip to every
    // communication read without adding authority.
    const employeeId = Number(req.user?.employeeId);
    const branchId = Number(req.user?.branchId);
    const employeeContextValid =
      req.user?.profileType === 'employee' &&
      Number.isInteger(employeeId) && employeeId > 0 &&
      Number.isInteger(branchId) && branchId > 0 &&
      req.user?.employeeActive === true &&
      req.user?.employeeApproved === true;

    if (!employeeContextValid) {
      throw new AppError('Communication employee context is required', 403);
    }

    req.communicationBranchId = branchId;
    next();
  } catch (error) { next(error); }
});

const handle = (work, status = 200) => async (req, res, next) => {
  try { res.status(status).json({ success: true, data: await work(req) }); } catch (error) { next(error); }
};

const canView = requireCommunicationCapability('viewCommunication');
const canOperate = requireCommunicationCapability('operateCommunication');
const canManageProfiles = requireCommunicationCapability('manageCommunicationProfiles');

router.get('/profiles', canView, handle((req) => service.listProfiles(req.communicationBranchId)));
router.post('/profiles', canView, canManageProfiles, handle((req) => service.saveProfile(req.communicationBranchId, req.body), 201));
router.get('/customers/:customerId/channels', canView, handle((req) => service.listCustomerChannels(req.communicationBranchId, req.params.customerId)));
router.post('/customers/:customerId/channels', canView, canOperate, handle((req) => service.saveCustomerChannel(req.communicationBranchId, req.params.customerId, req.body), 201));
router.get('/repairs/:repairJobId/preference', canView, handle((req) => service.getPreference(req.communicationBranchId, req.params.repairJobId)));
router.put('/repairs/:repairJobId/preference', canView, canOperate, handle((req) => service.savePreference(req.communicationBranchId, req.params.repairJobId, req.body)));
router.get('/repairs/:repairJobId/activities', canView, handle((req) => service.listRepairActivities(req.communicationBranchId, req.params.repairJobId)));
router.post('/repairs/:repairJobId/activities', canView, canOperate, handle((req) => service.recordRepairActivity(req.communicationBranchId, req.params.repairJobId, req.user.employeeId, req.body), 201));

module.exports = router;
