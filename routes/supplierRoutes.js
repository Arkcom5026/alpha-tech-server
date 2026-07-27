// ✅ @filename: supplierRoutes.js

const express = require('express');
const router = express.Router();

const createSupplierController = require('../src/modules/supplier/create/createSupplierSlice');
const listSuppliersController = require('../src/modules/supplier/query/list/listSuppliersSlice');
const getSupplierController = require('../src/modules/supplier/query/detail/getSupplierSlice');
const updateSupplierController = require('../src/modules/supplier/update/updateSupplierSlice');
const deleteSupplierController = require('../src/modules/supplier/delete/deleteSupplierSlice');

const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);

// ✅ CRUD Routes สำหรับ Supplier
router.post('/', createSupplierController.handle);
router.get('/', listSuppliersController.handle);
router.get('/:id', getSupplierController.handle);
router.put('/:id', updateSupplierController.handle);
router.delete('/:id', deleteSupplierController.handle);

module.exports = router;
