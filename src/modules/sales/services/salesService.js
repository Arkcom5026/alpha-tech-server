// src/modules/sales/services/salesService.js
const salesRepository = require('../repositories/salesRepository');
const eventBus = require('../../../shared/events/eventBus');

class SalesService {
  async checkout(branchId, cashierId, payload, businessType) {
    const receipt = await salesRepository.processSaleTransaction(branchId, cashierId, payload, businessType);

    // แจ้งสัญญาณออกไปยังผู้ดักจับคีย์ส่วนกลางทันทีเพื่ออัปเดต WebSockets โดยไม่มีความยึดติดกัน
    eventBus.emit('stock_updated', {
      branchId,
      items: payload.items.map(item => ({
        productId: item.productId,
        qty: item.qty
      }))
    });

    return receipt;
  }
}

module.exports = new SalesService();