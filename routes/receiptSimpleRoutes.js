

// ==============================================
// server/routes/receiptSimpleRoutes.js
// Express routes for Simple-only receipts (no SN)
// Mount in app.js:
//   app.use('/api/receipts/simple', require('./routes/receiptSimpleRoutes'))
// ==============================================

const express = require("express");
const router = express.Router();

// Controller (merged service + controller)
const {
    create,
    preview
} = require("../controllers/receiptSimpleController");

// 🔐 Auth middleware (align with saleRoutes.js)
const { verifyToken } = require("../middlewares/verifyToken");
router.use(verifyToken);

// Preview calculation (no persistence)
// POST /api/receipts/simple/preview
router.post("/preview", preview);

// Persist receipt (creates PO stub + POR + inventory updates)
// POST /api/receipts/simple
router.post("/", create);

module.exports = router;
