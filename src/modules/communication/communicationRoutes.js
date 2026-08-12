const express = require('express');
const verifyToken = require('../../../middlewares/verifyToken');
const prisma = require('../../database/prisma/client');
const AppError = require('../../shared/errors/AppError');
const service = require('./communicationService');
const { requireCommunicationCapability } = require('./communicationAccessPolicy');

const router = express.Router();
router.use(verifyToken);
router.use(async (req, _res, next) => {
  try {
    const employeeId = Number(req.user?.employeeId);
    const employee = Number.isInteger(employeeId) ? await prisma.employeeProfile.findUnique({ where: { id: employeeId }, select: { branchId: true, active: true, approved: true } }) : null;
    if (!employee?.active || !employee?.approved) throw new AppError('Communication employee context is required', 403);
    if (req.user?.branchId && Number(req.user.branchId) !== Number(employee.branchId)) throw new AppError('Cross-branch communication access is forbidden', 403);
    req.communicationBranchId = employee.branchId;
    next();
  } catch (error) { next(error); }
});

const handle = (work, status = 200) => async (req, res, next) => {
  try { res.status(status).json({ success: true, data: await work(req) }); } catch (error) { next(error); }
};

const canView = requireCommunicationCapability('viewCommunication');
const canManageProfiles = requireCommunicationCapability('manageCommunicationProfiles');
router.get('/profiles', canView, handle((req) => service.listProfiles(req.communicationBranchId)));
router.post('/profiles', canManageProfiles, handle((req) => service.saveProfile(req.communicationBranchId, req.body), 201));
router.get('/customers/:customerId/channels', canView, handle((req) => service.listCustomerChannels(req.communicationBranchId, req.params.customerId)));
router.post('/customers/:customerId/channels', canView, handle((req) => service.saveCustomerChannel(req.communicationBranchId, req.params.customerId, req.body), 201));
router.get('/repairs/:repairJobId/preference', canView, handle((req) => service.getPreference(req.communicationBranchId, req.params.repairJobId)));
router.put('/repairs/:repairJobId/preference', canView, handle((req) => service.savePreference(req.communicationBranchId, req.params.repairJobId, req.body)));
router.get('/repairs/:repairJobId/activities', canView, handle((req) => service.listRepairActivities(req.communicationBranchId, req.params.repairJobId)));
router.post('/repairs/:repairJobId/activities', canView, handle((req) => service.recordRepairActivity(req.communicationBranchId, req.params.repairJobId, req.user.employeeId, req.body), 201));

module.exports = router;
