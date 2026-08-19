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

const listEligiblePurchaseOrdersController = require('../../receipt/query/eligible-purchase-orders/listEligiblePurchaseOrdersController');
const getReceiptPurchaseOrderController = require('../../receipt/query/purchase-order-detail/getReceiptPurchaseOrderController');

const verifyToken = require('../../../../../middlewares/verifyToken');
router.use(verifyToken);

router.get('/', listPurchaseOrdersController.handle);
router.post('/', createPurchaseOrderController.handle);
router.get('/by-supplier', listPurchaseOrdersBySupplierController.handle);
router.get('/by-supplier/:supplierId', listPurchaseOrdersBySupplierController.handle);
router.post('/with-advance', createPurchaseOrderWithAdvanceController.handle);

router.get('/eligible-for-receipt', listEligiblePurchaseOrdersController.handle);
router.get('/:id/detail-for-receipt', getReceiptPurchaseOrderController.handle);
router.get('/:id/presentation', getPurchaseOrderPresentation);
router.put('/:id', updatePurchaseOrderController.handle);
router.delete('/:id', deletePurchaseOrderController.handle);
router.get('/:id', getPurchaseOrderController.handle);
router.patch('/:id/status', updatePurchaseOrderStatusController.handle);

module.exports = router;
