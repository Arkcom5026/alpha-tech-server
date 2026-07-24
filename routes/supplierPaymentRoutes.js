const express = require('express');
const router = express.Router();
const {
  createSupplierPayment,
  getAllSupplierPayments,
  getSupplierPaymentsByPO,
  deleteSupplierPayment,
  getAdvancePaymentsBySupplier,
  getSupplierPaymentsBySupplier,
} = require('../controllers/supplierPaymentController');

const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);

const requireSupplierPaymentActor = (req, res, next) => {
  const branchId = Number(req.user?.branchId);
  const employeeId = Number(req.user?.employeeId);

  if (!Number.isInteger(branchId) || branchId <= 0) {
    return res.status(403).json({
      code: 'BRANCH_CONTEXT_REQUIRED',
      message: 'ไม่พบสาขาของพนักงานผู้ทำรายการ',
    });
  }

  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    return res.status(403).json({
      code: 'EMPLOYEE_CONTEXT_REQUIRED',
      message: 'ไม่พบข้อมูลพนักงานผู้ทำรายการ',
    });
  }

  return next();
};

// สร้างรายการชำระเงินใหม่ ต้องมี EmployeeProfile และสาขาจาก DB authority
router.post('/', requireSupplierPaymentActor, createSupplierPayment);

router.get('/advance', getAdvancePaymentsBySupplier);
router.get('/by-supplier/:supplierId', getSupplierPaymentsBySupplier);
router.get('/', getAllSupplierPayments);
router.get('/by-po/:poId', getSupplierPaymentsByPO);
router.delete('/:id', deleteSupplierPayment);

module.exports = router;
