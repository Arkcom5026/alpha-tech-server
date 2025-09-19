
// ==============================================
// server/routes/purchaseOrderReceiptSimpleRoutes.js
// Express routes for PO‑tied Simple receipts (no SN)
// Mount in app.js:
//   app.use('/api/po-receipts/simple', require('./routes/purchaseOrderReceiptSimpleRoutes'))
// ==============================================

const express = require("express");
const router = express.Router();

// Controller (merged service + controller)
const { create, preview } = require("../controllers/purchaseOrderReceiptSimpleController");

// 🔐 Auth middleware (align with saleRoutes.js)
const { verifyToken } = require("../middlewares/verifyToken");
router.use(verifyToken);

// Preview calculation (no persistence)
// POST /api/po-receipts/simple/preview
router.post("/preview", preview);

// Persist receipt (creates PO header + POR + inventory updates for Simple lines)
// POST /api/po-receipts/simple
router.post("/", create);

module.exports = router;

