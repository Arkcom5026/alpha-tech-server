'use strict';

const service = require('./storePaymentAccountService');

const branchIdOf = (req) => req.user?.branchId;

const list = async (req, res, next) => {
  try {
    const includeInactive = String(req.query?.includeInactive || '0') === '1';
    const rows = await service.listStorePaymentAccounts(branchIdOf(req), { includeInactive });
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const row = await service.getStorePaymentAccount(branchIdOf(req), req.params.id);
    return res.json(row);
  } catch (error) {
    return next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const row = await service.createStorePaymentAccount(branchIdOf(req), req.body || {});
    return res.status(201).json(row);
  } catch (error) {
    return next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const row = await service.updateStorePaymentAccount(branchIdOf(req), req.params.id, req.body || {});
    return res.json(row);
  } catch (error) {
    return next(error);
  }
};

module.exports = { create, get, list, update };
