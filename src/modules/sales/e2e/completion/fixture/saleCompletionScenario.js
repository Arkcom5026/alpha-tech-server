/**
 * Sale Completion E2E Scenario Fixture
 *
 * This module intentionally starts as a contract boundary.
 * It must prepare or describe real Sale runtime inputs only.
 * No mocked sale completion is allowed.
 *
 * Future implementation should reuse existing domain factories when discovered.
 */

export function createSaleCompletionScenario() {
  return {
    branch: null,
    employee: null,
    customer: null,
    product: null,
    payment: null,
    expected: {
      saleCreated: true,
      inventoryChanged: true,
      receiptReady: true,
    },
  };
}
