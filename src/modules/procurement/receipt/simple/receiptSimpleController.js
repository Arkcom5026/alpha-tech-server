const legacyReceiptSimpleRuntime = require('../../../../../controllers/receiptSimpleController');

// Transitional module-owned HTTP boundary.
// The canonical route imports this controller while the high-risk transaction
// implementation is migrated in a later, separately verified increment.
const create = (req, res) => legacyReceiptSimpleRuntime.create(req, res);
const preview = (req, res) => legacyReceiptSimpleRuntime.preview(req, res);

module.exports = { create, preview };
