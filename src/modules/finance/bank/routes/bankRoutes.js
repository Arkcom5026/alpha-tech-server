const express = require('express');
const verifyToken = require('../../../../../middlewares/verifyToken');
const { getAllBanks } = require('../query/list/getAllBanksController');
const { getBankById } = require('../query/detail/getBankByIdController');
const { createBank } = require('../create/createBankController');
const { updateBank } = require('../update/updateBankController');
const { deleteBank } = require('../delete/deleteBankController');
const {
  BANK_CAPABILITY,
  allowBankCapabilities,
} = require('../shared/bankAuthorization');

const router = express.Router();
router.use(verifyToken);

const requireBankRead = allowBankCapabilities(BANK_CAPABILITY.READ);
const requireBankManage = allowBankCapabilities(
  BANK_CAPABILITY.READ,
  BANK_CAPABILITY.MANAGE,
);
const requireBankDelete = allowBankCapabilities(
  BANK_CAPABILITY.READ,
  BANK_CAPABILITY.MANAGE,
  BANK_CAPABILITY.DELETE,
);

router.get('/', requireBankRead, getAllBanks);
router.get('/:id', requireBankRead, getBankById);
router.post('/', requireBankManage, createBank);
router.patch('/:id', requireBankManage, updateBank);
router.delete('/:id', requireBankDelete, deleteBank);

module.exports = router;
