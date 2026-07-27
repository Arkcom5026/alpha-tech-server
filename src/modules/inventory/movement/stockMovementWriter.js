class StockMovementWriter {
  constructor(client) {
    if (!client?.stockMovement) {
      throw new Error('[StockMovementWriter] Prisma stockMovement client is required');
    }
    this.client = client;
  }

  create(data) {
    return this.client.stockMovement.create({ data });
  }

  createMany(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return Promise.resolve({ count: 0 });
    }
    return this.client.stockMovement.createMany({ data });
  }
}

const createStockMovement = (client, data) => new StockMovementWriter(client).create(data);
const createStockMovements = (client, data) => new StockMovementWriter(client).createMany(data);

module.exports = {
  StockMovementWriter,
  createStockMovement,
  createStockMovements,
};
