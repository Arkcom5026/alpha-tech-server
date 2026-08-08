'use strict';

const repairRoutes = require('../../modules/repair/routes/repairRoutes');
const purchaseOrderRoutes = require('../../modules/procurement/purchase-order/routes/purchaseOrderRoutes');
const purchaseOrderReceiptRoutes = require('../../modules/procurement/receipt/routes/purchaseOrderReceiptRoutes');
const purchaseOrderReceiptItemRoutes = require('../../modules/procurement/receipt/routes/purchaseOrderReceiptItemRoutes');
const stockItemRoutes = require('../../modules/inventory/stock-item/routes/stockItemRoutes');
const barcodeRoutes = require('../../modules/inventory/barcode/routes/barcodeRoutes');

const registerServiceProcurementInventoryRoutes = (app) => {
  app.use('/api/repairs', repairRoutes);
  app.use('/api/repair', repairRoutes);
  app.use('/api/purchase-orders', purchaseOrderRoutes);
  app.use('/api/purchase-order-receipts', purchaseOrderReceiptRoutes);
  app.use('/api/purchase-order-receipt-items', purchaseOrderReceiptItemRoutes);
  app.use('/api/stock-items', stockItemRoutes);
  app.use('/api/barcodes', barcodeRoutes);
};

module.exports = { registerServiceProcurementInventoryRoutes };
