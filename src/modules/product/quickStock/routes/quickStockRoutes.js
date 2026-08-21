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

router.get('/dropdowns', handleQuickReceiveDropdowns)
router.post('/quick-enroll', allowQuickStockMutation, handleQuickEnroll)
router.post('/all-in-one', allowQuickStockMutation, handleQuickStockInAllInOne)
router.post('/existing', allowQuickStockMutation, handleQuickStockExistingReceive)

// Quick Receipt Session: one delivery note, many product types, resumable or one-shot.
// Its authority remains separate and is intentionally not migrated in Wave 2F.
router.get('/receipts', quickReceiptSessionController.list)
router.post('/receipts', quickReceiptSessionController.create)
router.post('/receipts/complete', quickReceiptSessionController.complete)
router.get('/receipts/:id', quickReceiptSessionController.detail)
router.patch('/receipts/:id', quickReceiptSessionController.update)
router.post('/receipts/:id/items', quickReceiptSessionController.addItem)
router.delete('/receipts/:id/items/:itemId', quickReceiptSessionController.deleteItem)
router.post('/receipts/:id/finalize', quickReceiptSessionController.finalize)
router.post('/receipts/:id/cancel', quickReceiptSessionController.cancel)

module.exports = router
