// ✅ @filename: supplierRoutes.js

const express = require('express');
const router = express.Router();
const {
  createSupplier,
  getAllSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier
} = require('../controllers/supplierController');

const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);


// ✅ CRUD Routes สำหรับ Supplier
router.post('/',  createSupplier);
router.get('/',  getAllSuppliers);
router.get('/:id',  getSupplierById);
router.put('/:id',  updateSupplier);
router.delete('/:id',  deleteSupplier);

module.exports = router;
