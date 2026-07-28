const express = require('express');
const verifyToken = require('../../../../../middlewares/verifyToken');
const { getAllBanks } = require('../query/list/getAllBanksController');
const { getBankById } = require('../query/detail/getBankByIdController');
const { createBank } = require('../create/createBankController');
const { updateBank } = require('../update/updateBankController');
const { deleteBank } = require('../delete/deleteBankController');

const router = express.Router();
router.use(verifyToken);

router.get('/', getAllBanks);
router.get('/:id', getBankById);
router.post('/', createBank);
router.patch('/:id', updateBank);
router.delete('/:id', deleteBank);

module.exports = router;
