const repairRepository = require('../repositories/repairRepository');
const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');

function requirePositiveInteger(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      `${fieldName} ต้องเป็นจำนวนเต็มบวก`,
      400,
      { field: fieldName }
    );
  }
  return parsed;
}

function addDays(dateValue, days) {
  if (!dateValue || !Number.isInteger(days) || days <= 0) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function resolveWarranty({ stockItem, product, soldAt }) {
  const stockDays = Number(stockItem?.warrantyDays);
  const productDays = Number(product?.warrantyDays);
  const days =
    Number.isInteger(stockDays) && stockDays > 0
      ? stockDays
      : Number.isInteger(productDays) && productDays > 0
        ? productDays
        : null;

  const explicitExpiry = stockItem?.expiredAt
    ? new Date(stockItem.expiredAt)
    : null;
  const calculatedExpiry = addDays(soldAt, days);
  const expiresAt =
    explicitExpiry && !Number.isNaN(explicitExpiry.getTime())
      ? explicitExpiry
      : calculatedExpiry;

  return {
    hasPolicy: Boolean(days || expiresAt),
    days,
    expiresAt,
    active: expiresAt ? expiresAt.getTime() >= Date.now() : Boolean(days),
    policySource:
      Number.isInteger(stockDays) && stockDays > 0
        ? 'STOCK_ITEM'
        : Number.isInteger(productDays) && productDays > 0
          ? 'PRODUCT'
          : explicitExpiry
            ? 'EXPLICIT_EXPIRY'
            : null,
  };
}

function mapProduct(product) {
  if (!product) return null;
  return {
    id: product.id,
    name: product.name,
    warrantyDays: product.warrantyDays,
    brand: product.brand?.name || null,
    model: product.productType?.name || null,
    productType: product.productType
      ? {
          id: product.productType.id,
          name: product.productType.name,
        }
      : null,
  };
}

function mapStructuredAsset(stockItem) {
  const latestSaleItem = stockItem.saleItems?.[0] || null;
  const latestSale = latestSaleItem?.sale || null;
  const product = mapProduct(stockItem.product);
  const warranty = resolveWarranty({
    stockItem,
    product: stockItem.product,
    soldAt: latestSale?.soldAt,
  });

  return {
    id: `stock:${stockItem.id}`,
    assetType: 'STOCK_ITEM',
    selectable: true,
    stockItemId: stockItem.id,
    stockItem: {
      id: stockItem.id,
      barcode: stockItem.barcode,
      serialNumber: stockItem.serialNumber,
      soldAt: stockItem.soldAt,
      product,
      warranty,
    },
    identity: {
      id: stockItem.id,
      barcode: stockItem.barcode,
      serialNumber: stockItem.serialNumber,
      soldAt: stockItem.soldAt,
      product,
      warranty,
    },
    product,
    warranty,
    latestSale: latestSale
      ? {
          id: latestSale.id,
          code: latestSale.code,
          soldAt: latestSale.soldAt,
          customerId: latestSale.customerId,
          branchId: latestSale.branchId,
          price: latestSaleItem.price,
          discount: latestSaleItem.discount,
        }
      : null,
  };
}

function mapSimpleAsset(item) {
  const product = mapProduct(item.product);
  const warranty = resolveWarranty({
    stockItem: null,
    product: item.product,
    soldAt: item.sale?.soldAt,
  });

  return {
    id: `simple:${item.id}`,
    assetType: 'SIMPLE_PRODUCT',
    selectable: true,
    stockItemId: null,
    identity: {
      id: null,
      barcode: null,
      serialNumber: null,
      product,
      warranty,
    },
    product,
    warranty,
    quantity: item.quantity,
    latestSale: item.sale
      ? {
          id: item.sale.id,
          code: item.sale.code,
          soldAt: item.sale.soldAt,
          customerId: item.sale.customerId,
          branchId: item.sale.branchId,
          price: item.price,
          discount: item.discount,
        }
      : null,
  };
}

class CustomerWarrantyAssetService {
  constructor(repository = repairRepository) {
    this.repository = repository;
  }

  async listForCustomer(actor, customerIdInput) {
    const customerId = requirePositiveInteger(customerIdInput, 'customerId');
    const customer = await this.repository.findCustomer(customerId);

    if (!customer) {
      throw new RepairError(
        RepairFailureCode.CUSTOMER_NOT_FOUND,
        'ไม่พบข้อมูลลูกค้าที่ต้องการค้นหาสินค้าประกัน',
        404,
        { customerId }
      );
    }

    const [stockItems, simpleItems] = await Promise.all([
      this.repository.findCustomerWarrantyStockItems(
        actor.branchId,
        customerId
      ),
      this.repository.findCustomerWarrantySimpleItems(
        actor.branchId,
        customerId
      ),
    ]);

    return [
      ...stockItems.map(mapStructuredAsset),
      ...simpleItems.map(mapSimpleAsset),
    ].sort((left, right) => {
      const leftTime = new Date(left.latestSale?.soldAt || 0).getTime();
      const rightTime = new Date(right.latestSale?.soldAt || 0).getTime();
      return rightTime - leftTime;
    });
  }
}

module.exports = new CustomerWarrantyAssetService();
module.exports.CustomerWarrantyAssetService = CustomerWarrantyAssetService;
