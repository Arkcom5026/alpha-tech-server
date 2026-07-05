// src/modules/product/quickStock/routes/quickStockRoutes.js
const express = require('express')
const router = express.Router()

// 🟢 FIXED: เลี้ยวเข้าหาโฟลเดอร์ controllers ตามที่คุณจัดระเบียบโครงสร้างล่าสุด
const quickStockController = require('../controllers/quickStockController')
const quickReceiveDropdownController = require('../controllers/quickReceiveDropdownController')

// ดึงฟังก์ชันออกมาพร้อมผูก Context (bind) ป้องกันอาการบริบท Class Instance หลุด
const handleQuickEnroll = quickStockController?.handleQuickEnroll
  ? quickStockController.handleQuickEnroll.bind(quickStockController)
  : null

// 🟢 [เพิ่มใหม่] ดึงฟังก์ชัน All-in-One พร้อมผูก Context (bind) ของ Class Instance ตัวใหม่
const handleQuickStockInAllInOne = quickStockController?.quickStockInAllInOne
  ? quickStockController.quickStockInAllInOne.bind(quickStockController)
  : null

const handleQuickStockExistingReceive = quickStockController?.quickStockExistingReceive
  ? quickStockController.quickStockExistingReceive.bind(quickStockController)
  : null

const handleQuickReceiveDropdowns = quickReceiveDropdownController?.getQuickReceiveDropdowns
  ? quickReceiveDropdownController.getQuickReceiveDropdowns.bind(quickReceiveDropdownController)
  : null

// ถอย 4 ชั้น (../../../../) ออกไปหา verifyToken ที่อยู่ระดับนอกสุดเคียงข้าง server.js
const verifyToken = require('../../../../../middlewares/verifyToken')

// ระบบล็อกนิรภัยป้องกันสิทธิ์ขาดหายตั้งแต่จังหวะ Boot Server
if (typeof verifyToken !== 'function') {
  throw new Error('[quickStockRoutes] verifyToken middleware is not a function — check server/middlewares/verifyToken.js')
}
if (typeof handleQuickEnroll !== 'function') {
  throw new Error('[quickStockRoutes] handleQuickEnroll is not a function — check src/modules/product/quickStock/controllers/quickStockController.js export')
}
// 🟢 [เพิ่มใหม่] ตรวจสอบฟังก์ชัน All-in-One ตั้งแต่จังหวะ Boot Server ป้องกันเซิร์ฟเวอร์แครชกลางคัน
if (typeof handleQuickStockInAllInOne !== 'function') {
  throw new Error('[quickStockRoutes] handleQuickStockInAllInOne (quickStockInAllInOne) is not a function — check src/modules/product/quickStock/controllers/quickStockController.js export')
}
if (typeof handleQuickStockExistingReceive !== 'function') {
  throw new Error('[quickStockRoutes] handleQuickStockExistingReceive (quickStockExistingReceive) is not a function — check src/modules/product/quickStock/controllers/quickStockController.js export')
}
if (typeof handleQuickReceiveDropdowns !== 'function') {
  throw new Error('[quickStockRoutes] handleQuickReceiveDropdowns is not a function — check src/modules/product/quickStock/controllers/quickReceiveDropdownController.js export')
}

// ✅ server.js mount เรียบร้อยแล้วที่: app.use('/api/quick-stock', quickStockRoutes)

// ฟังก์ชันสำหรับเคลียร์ค่า String เพื่อเปรียบเทียบสิทธิ์
const cleanRole = (r) => String(r || '').trim().toUpperCase()

/**
 * 🛡️ ด่านคัดกรองบทบาทหน้าที่พนักงานแบบไฮบริด (Defensive Context Guard)
 */
const allowQuickStockForEmployeeContext = (req, res, next) => {
  const legacyRole = cleanRole(req?.user?.role)
  const legacyProfileType = String(req?.user?.profileType || '').trim().toLowerCase()
  const newRole = cleanRole(req?.employee?.role)

  const isAuthorizedRole = 
    ['EMPLOYEE', 'ADMIN', 'SUPERADMIN', 'SUPPERADMIN'].includes(legacyRole) ||
    ['EMPLOYEE', 'ADMIN', 'SUPERADMIN', 'SUPPERADMIN'].includes(newRole)

  if (isAuthorizedRole || legacyProfileType === 'employee') {
    return next()
  }

  return res.status(403).json({ error: 'FORBIDDEN_QUICK_STOCK_ACCESS' })
}

// ===== Endpoints =====
router.get('/dropdowns', verifyToken, allowQuickStockForEmployeeContext, handleQuickReceiveDropdowns)

router.post('/quick-enroll', verifyToken, allowQuickStockForEmployeeContext, handleQuickEnroll)

// 🟢 [เพิ่มใหม่] เปิด Endpoint รับข้อมูลเพิ่มสินค้าด่วนออลอินวัน ผ่านด่านตรวจนิรภัยแบบ Hybrid Guard แน่นหนา
router.post('/all-in-one', verifyToken, allowQuickStockForEmployeeContext, handleQuickStockInAllInOne)

// รับสินค้าเข้าจาก Product เดิม: Recovery / Quick Receive / Manufacture
router.post('/existing', verifyToken, allowQuickStockForEmployeeContext, handleQuickStockExistingReceive)

module.exports = router
