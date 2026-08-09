'use strict';
const service = require('./documentWorkspaceService');
const list = async (req, res, next) => { try { res.json(await service.listDocumentWorkspace({ branchId: req.user?.branchId, customerId: req.query?.customerId })); } catch (error) { next(error); } };
const confirm = async (req, res, next) => { try { res.status(201).json(await service.confirmDocumentWorkspace({ branchId: req.user?.branchId, employeeId: req.user?.employeeId, customerId: req.body?.customerId, note: req.body?.note, lines: req.body?.lines })); } catch (error) { next(error); } };
module.exports = { list, confirm };
