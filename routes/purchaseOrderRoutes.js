const express = require('express');
const router = express.Router();

const listPurchaseOrdersController = require('../src/modules/procurement/purchase-order/query/list/listPurchaseOrdersSlice');
const createPurchaseOrderController = require('../src/modules/procurement/purchase-order/create/createPurchaseOrderSlice');
const listPurchaseOrdersBySupplierController = require('../src/modules/procurement/purchase-order/query/by-supplier/listPurchaseOrdersBySupplierSlice');
const createPurchaseOrderWithAdvanceController = require('../src/modules/procurement/purchase-order/create-with-advance/createPurchaseOrderWithAdvanceSlice');
const updatePurchaseOrderController = require('../src/modules/procurement/purchase-order/update/updatePurchaseOrderSlice');
const deletePurchaseOrderController = require('../src/modules/procurement/purchase-order/delete/deletePurchaseOrderSlice');
const getPurchaseOrderController = require('../src/modules/procurement/purchase-order/query/detail/getPurchaseOrderSlice');
const updatePurchaseOrderStatusController = require('../src/modules/procurement/purchase-order/status/updatePurchaseOrderStatusSlice');

const listEligiblePurchaseOrdersController = require('../src/modules/procurement/receipt/query/eligible-purchase-orders/listEligiblePurchaseOrdersController');
const getReceiptPurchaseOrderController = require('../src/modules/procurement/receipt/query/purchase-order-detail/getReceiptPurchaseOrderController');

const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);

router.get('/', listPurchaseOrdersController.handle);
router.post('/', createPurchaseOrderController.handle);
router.get('/by-supplier', listPurchaseOrdersBySupplierController.handle);
router.get('/by-supplier/:supplierId', listPurchaseOrdersBySupplierController.handle);
router.post('/with-advance', createPurchaseOrderWithAdvanceController.handle);

router.get('/eligible-for-receipt', listEligiblePurchaseOrdersController.handle);
router.get('/:id/detail-for-receipt', getReceiptPurchaseOrderController.handle);
router.put('/:id', updatePurchaseOrderController.handle);
router.delete('/:id', deletePurchaseOrderController.handle);
router.get('/:id', getPurchaseOrderController.handle);
router.patch('/:id/status', updatePurchaseOrderStatusController.handle);

module.exports = router;
