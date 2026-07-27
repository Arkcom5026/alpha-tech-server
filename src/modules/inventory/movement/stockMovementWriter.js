const RAW_STOCK_MOVEMENT_DELEGATE = Symbol.for('alpha-tech.inventory.raw-stock-movement-delegate');
const AUTHORIZED_STOCK_MOVEMENT_CLIENT = Symbol.for('alpha-tech.inventory.authorized-stock-movement-client');

class StockMovementWriter {
  constructor(client) {
    const delegate = client?.[RAW_STOCK_MOVEMENT_DELEGATE] || client?.stockMovement;
    if (!delegate) {
      throw new Error('[StockMovementWriter] Prisma stockMovement client is required');
    }
    this.delegate = delegate;
  }

  create(data) {
    return this.delegate.create({ data });
  }

  createMany(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return Promise.resolve({ count: 0 });
    }
    return this.delegate.createMany({ data });
  }
}

const createStockMovement = (client, data) => new StockMovementWriter(client).create(data);
const createStockMovements = (client, data) => new StockMovementWriter(client).createMany(data);

const authorizedClientCache = new WeakMap();

const isStockMovementAuthorizedClient = (client) =>
  Boolean(client?.[AUTHORIZED_STOCK_MOVEMENT_CLIENT]);

const authorizeStockMovementClient = (client) => {
  if (!client || (typeof client !== 'object' && typeof client !== 'function')) return client;
  if (isStockMovementAuthorizedClient(client)) return client;
  if (authorizedClientCache.has(client)) return authorizedClientCache.get(client);

  let authorizedClient;
  const stockMovementDelegate = client.stockMovement;
  const authorizedStockMovement = stockMovementDelegate
    ? new Proxy(stockMovementDelegate, {
        get(target, property, receiver) {
          if (property === 'create') {
            return (query = {}) => createStockMovement(authorizedClient, query.data);
          }
          if (property === 'createMany') {
            return (query = {}) => createStockMovements(authorizedClient, query.data);
          }
          const value = Reflect.get(target, property, receiver);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      })
    : null;

  authorizedClient = new Proxy(client, {
    get(target, property, receiver) {
      if (property === AUTHORIZED_STOCK_MOVEMENT_CLIENT) return true;
      if (property === RAW_STOCK_MOVEMENT_DELEGATE) return stockMovementDelegate;
      if (property === 'stockMovement' && authorizedStockMovement) return authorizedStockMovement;
      if (property === '$transaction' && typeof target.$transaction === 'function') {
        return (work, ...options) => {
          if (typeof work !== 'function') return target.$transaction(work, ...options);
          return target.$transaction(
            (transactionClient) => work(authorizeStockMovementClient(transactionClient)),
            ...options
          );
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  authorizedClientCache.set(client, authorizedClient);
  return authorizedClient;
};

module.exports = {
  RAW_STOCK_MOVEMENT_DELEGATE,
  AUTHORIZED_STOCK_MOVEMENT_CLIENT,
  StockMovementWriter,
  createStockMovement,
  createStockMovements,
  isStockMovementAuthorizedClient,
  authorizeStockMovementClient,
};
