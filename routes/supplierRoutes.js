// ✅ @filename: supplierRoutes.js

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/verifyToken');
const {
  createSupplier,
  getAllSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier
} = require('../controllers/supplierController');

// ✅ CRUD Routes สำหรับ Supplier
router.post('/', verifyToken, createSupplier);
router.get('/', verifyToken, getAllSuppliers);
router.get('/:id', verifyToken, getSupplierById);
router.put('/:id', verifyToken, updateSupplier);
router.delete('/:id', verifyToken, deleteSupplier);

module.exports = router;
