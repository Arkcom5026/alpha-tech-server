const express = require('express');
const router = express.Router();

const listPurchaseOrdersController = require('../query/list/listPurchaseOrdersSlice');
const createPurchaseOrderController = require('../create/createPurchaseOrderSlice');
const listPurchaseOrdersBySupplierController = require('../query/by-supplier/listPurchaseOrdersBySupplierSlice');
const createPurchaseOrderWithAdvanceController = require('../create-with-advance/createPurchaseOrderWithAdvanceSlice');
const updatePurchaseOrderController = require('../update/updatePurchaseOrderSlice');
const deletePurchaseOrderController = require('../delete/deletePurchaseOrderSlice');
const getPurchaseOrderController = require('../query/detail/getPurchaseOrderSlice');
const updatePurchaseOrderStatusController = require('../status/updatePurchaseOrderStatusSlice');
const { getPurchaseOrderPresentation } = require('../presentation/getPurchaseOrderPresentationController');
const {
  PURCHASE_ORDER_CAPABILITY,
  allowPurchaseOrderCapabilities,
} = require('../shared/purchaseOrderAuthorization');

const listEligiblePurchaseOrdersController = require('../../receipt/query/eligible-purchase-orders/listEligiblePurchaseOrdersController');
const getReceiptPurchaseOrderController = require('../../receipt/query/purchase-order-detail/getReceiptPurchaseOrderController');
const {
  PURCHASE_RECEIPT_CAPABILITY,
  allowPurchaseReceiptCapabilities,
} = require('../../receipt/shared/purchaseReceiptAuthorization');

const verifyToken = require('../../../../../middlewares/verifyToken');
router.use(verifyToken);

const allowPurchaseOrderAccess = allowPurchaseOrderCapabilities(PURCHASE_ORDER_CAPABILITY.ACCESS);
const allowPurchaseOrderControl = allowPurchaseOrderCapabilities(
  PURCHASE_ORDER_CAPABILITY.ACCESS,
  PURCHASE_ORDER_CAPABILITY.CONTROL,
);
const allowPurchaseReceiptAccess = allowPurchaseReceiptCapabilities(PURCHASE_RECEIPT_CAPABILITY.ACCESS);

router.get('/', allowPurchaseOrderAccess, listPurchaseOrdersController.handle);
router.post('/', allowPurchaseOrderAccess, createPurchaseOrderController.handle);
router.get('/by-supplier', allowPurchaseOrderAccess, listPurchaseOrdersBySupplierController.handle);
router.get('/by-supplier/:supplierId', allowPurchaseOrderAccess, listPurchaseOrdersBySupplierController.handle);
router.post('/with-advance', allowPurchaseOrderAccess, createPurchaseOrderWithAdvanceController.handle);

// Receipt-discovery endpoints belong to the Purchase Receipt boundary even though they are mounted here.
router.get('/eligible-for-receipt', allowPurchaseReceiptAccess, listEligiblePurchaseOrdersController.handle);
router.get('/:id/detail-for-receipt', allowPurchaseReceiptAccess, getReceiptPurchaseOrderController.handle);
router.get('/:id/presentation', allowPurchaseOrderAccess, getPurchaseOrderPresentation);
router.put('/:id', allowPurchaseOrderAccess, updatePurchaseOrderController.handle);
router.delete('/:id', allowPurchaseOrderControl, deletePurchaseOrderController.handle);
router.get('/:id', allowPurchaseOrderAccess, getPurchaseOrderController.handle);
router.patch('/:id/status', allowPurchaseOrderControl, updatePurchaseOrderStatusController.handle);

module.exports = router;
