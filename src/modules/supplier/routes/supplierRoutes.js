const express = require('express');
const router = express.Router();

const createSupplierController = require('../create/createSupplierSlice');
const listSuppliersController = require('../query/list/listSuppliersSlice');
const getSupplierController = require('../query/detail/getSupplierSlice');
const updateSupplierController = require('../update/updateSupplierSlice');
const deleteSupplierController = require('../delete/deleteSupplierSlice');

const verifyToken = require('../../../middlewares/verifyToken');
router.use(verifyToken);

router.post('/', createSupplierController.handle);
router.get('/', listSuppliersController.handle);
router.get('/:id', getSupplierController.handle);
router.put('/:id', updateSupplierController.handle);
router.delete('/:id', deleteSupplierController.handle);

module.exports = router;
