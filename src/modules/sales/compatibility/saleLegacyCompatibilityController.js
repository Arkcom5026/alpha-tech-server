// Public compatibility surface. Implementations are owned by workflow modules.
module.exports = {
  ...require('../create/controllers/saleLegacyCreateController'),
  ...require('../documents/controllers/saleDocumentController'),
  ...require('../history/controllers/saleHistoryController'),
  ...require('../settlement/controllers/saleSettlementController'),
};
