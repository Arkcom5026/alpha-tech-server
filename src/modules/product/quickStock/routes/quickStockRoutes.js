// src/modules/product/quickStock/routes/quickStockRoutes.js
const express = require('express')
const router = express.Router()

const quickStockController = require('../controllers/quickStockController')
const quickReceiveDropdownController = require('../controllers/quickReceiveDropdownController')
const quickReceiptSessionController = require('../controllers/quickReceiptSessionController')
const {
  QUICK_STOCK_CAPABILITY,
  allowQuickStockCapabilities,
} = require('../shared/quickStockAuthorization')
const {
  QUICK_RECEIPT_CAPABILITY,
  allowQuickReceiptCapabilities,
} = require('../shared/quickReceiptAuthorization')

const handleQuickEnroll = quickStockController?.handleQuickEnroll
  ? quickStockController.handleQuickEnroll.bind(quickStockController)
  : null
const handleQuickStockInAllInOne = quickStockController?.quickStockInAllInOne
  ? quickStockController.quickStockInAllInOne.bind(quickStockController)
  : null
const handleQuickStockExistingReceive = quickStockController?.quickStockExistingReceive
  ? quickStockController.quickStockExistingReceive.bind(quickStockController)
  : null
const handleQuickReceiveDropdowns = quickReceiveDropdownController?.getQuickReceiveDropdowns
  ? quickReceiveDropdownController.getQuickReceiveDropdowns.bind(quickReceiveDropdownController)
  : null

const verifyToken = require('../../../../../middlewares/verifyToken')

if (typeof verifyToken !== 'function') throw new Error('[quickStockRoutes] verifyToken middleware is not a function')
if (typeof handleQuickEnroll !== 'function') throw new Error('[quickStockRoutes] handleQuickEnroll is not a function')
if (typeof handleQuickStockInAllInOne !== 'function') throw new Error('[quickStockRoutes] handleQuickStockInAllInOne is not a function')
if (typeof handleQuickStockExistingReceive !== 'function') throw new Error('[quickStockRoutes] handleQuickStockExistingReceive is not a function')
if (typeof handleQuickReceiveDropdowns !== 'function') throw new Error('[quickStockRoutes] handleQuickReceiveDropdowns is not a function')

const cleanRole = (r) => String(r || '').trim().toUpperCase()
const allowQuickStockForEmployeeContext = (req, res, next) => {
  const legacyRole = cleanRole(req?.user?.role)
  const legacyProfileType = String(req?.user?.profileType || '').trim().toLowerCase()
  const newRole = cleanRole(req?.employee?.role)
  const isAuthorizedRole =
    ['EMPLOYEE', 'ADMIN', 'SUPERADMIN', 'SUPPERADMIN'].includes(legacyRole) ||
    ['EMPLOYEE', 'ADMIN', 'SUPERADMIN', 'SUPPERADMIN'].includes(newRole)

  if (isAuthorizedRole || legacyProfileType === 'employee') return next()
  return res.status(403).json({ error: 'FORBIDDEN_QUICK_STOCK_ACCESS' })
}

router.use(verifyToken, allowQuickStockForEmployeeContext)

const allowQuickStockMutation = allowQuickStockCapabilities(QUICK_STOCK_CAPABILITY.MUTATE)
const allowQuickReceiptAccess = allowQuickReceiptCapabilities(QUICK_RECEIPT_CAPABILITY.ACCESS)
const allowQuickReceiptFinalize = allowQuickReceiptCapabilities(
  QUICK_RECEIPT_CAPABILITY.ACCESS,
  QUICK_RECEIPT_CAPABILITY.FINALIZE,
)

router.get('/dropdowns', handleQuickReceiveDropdowns)
router.post('/quick-enroll', allowQuickStockMutation, handleQuickEnroll)
router.post('/all-in-one', allowQuickStockMutation, handleQuickStockInAllInOne)
router.post('/existing', allowQuickStockMutation, handleQuickStockExistingReceive)

// Quick Receipt Session: draft/read work is distinct from actions that close the session.
router.get('/receipts', allowQuickReceiptAccess, quickReceiptSessionController.list)
router.post('/receipts', allowQuickReceiptAccess, quickReceiptSessionController.create)
router.post('/receipts/complete', allowQuickReceiptFinalize, quickReceiptSessionController.complete)
router.get('/receipts/:id', allowQuickReceiptAccess, quickReceiptSessionController.detail)
router.patch('/receipts/:id', allowQuickReceiptAccess, quickReceiptSessionController.update)
router.post('/receipts/:id/items', allowQuickReceiptAccess, quickReceiptSessionController.addItem)
router.delete('/receipts/:id/items/:itemId', allowQuickReceiptAccess, quickReceiptSessionController.deleteItem)
router.post('/receipts/:id/finalize', allowQuickReceiptFinalize, quickReceiptSessionController.finalize)
router.post('/receipts/:id/cancel', allowQuickReceiptFinalize, quickReceiptSessionController.cancel)

module.exports = router
