// ✅ @filename: server/routes/employeeRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllEmployees,
  getEmployeesById,
  createEmployees,
  updateEmployees,
  deleteEmployees,
  getUsersByRole,
  approveEmployee,
  getAllPositions,
  updateUserRole, // ⬅️ เพิ่มฟังก์ชันเปลี่ยน Role
  getBranchDropdowns, // ⬅️ สำหรับตัวกรองสาขา (superadmin เท่านั้น)
} = require('../controllers/employeeController');

// ✅ verifyToken: single export (CommonJS)
const verifyToken = require('../middlewares/verifyToken');
const requireAdmin = require('../middlewares/requireAdmin');

// ต้องล็อกอินก่อนเสมอ
router.use(verifyToken);

// หมวด Positions / Branches ที่เกี่ยวข้อง
router.get('/positions', getAllPositions);
// dropdown สาขาสำหรับตัวกรอง (เฉพาะ superadmin)
router.get('/branches/dropdowns', requireAdmin.superadmin, getBranchDropdowns);

// จัดการ Role (เฉพาะ Super Admin)
router.patch('/roles/users/:userId/role', requireAdmin.superadmin, updateUserRole);

// ค้นผู้ใช้ตาม role (วางก่อน dynamic :id เพื่อกันชนกัน)
router.get('/users/by-role', getUsersByRole);

// อนุมัติพนักงานใหม่
router.post('/approve-employee', approveEmployee);

// รายการพนักงานและ CRUD ทั่วไป
router.get('/', getAllEmployees);
router.get('/:id', getEmployeesById);
router.post('/', createEmployees);
router.put('/:id', updateEmployees);
router.delete('/:id', deleteEmployees);

module.exports = router;





