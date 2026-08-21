const express = require('express');
const router = express.Router();

const createSupplierController = require('../create/createSupplierSlice');
const listSuppliersController = require('../query/list/listSuppliersSlice');
const getSupplierController = require('../query/detail/getSupplierSlice');
const updateSupplierController = require('../update/updateSupplierSlice');
const deleteSupplierController = require('../delete/deleteSupplierSlice');
const {
  allowSupplierAccess,
  allowSupplierDelete,
} = require('../shared/supplierAuthorization');

const verifyToken = require('../../../../middlewares/verifyToken');
router.use(verifyToken);

router.post('/', allowSupplierAccess, createSupplierController.handle);
router.get('/', allowSupplierAccess, listSuppliersController.handle);
router.get('/:id', allowSupplierAccess, getSupplierController.handle);
router.put('/:id', allowSupplierAccess, updateSupplierController.handle);
router.delete('/:id', allowSupplierDelete, deleteSupplierController.handle);

module.exports = router;
