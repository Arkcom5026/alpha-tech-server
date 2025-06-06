const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ✅ สร้างคำสั่งขายสินค้า
const createSaleOrder = async (req, res) => {
  try {
    const { branchId, employeeId, items } = req.body;

    if (!branchId || !employeeId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // ตรวจสอบว่า barcode ทั้งหมดอยู่ในสถานะ IN_STOCK
    const barcodeIds = items.map((i) => i.barcodeId);

    const validStockItems = await prisma.stockItem.findMany({
      where: {
        id: { in: barcodeIds },
        status: 'IN_STOCK',
      },
    });

    if (validStockItems.length !== items.length) {
      return res.status(400).json({ error: 'บางรายการไม่สามารถขายได้ (อาจขายไปแล้ว)' });
    }

    // สร้างเลขอ้างอิง
    const code = `SO-${Date.now()}`;

    // คำนวณยอดรวม
    const totalAmount = items.reduce((sum, i) => sum + i.price, 0);

    // บันทึก SaleOrder และ SaleOrderItem
    const createdOrder = await prisma.saleOrder.create({
      data: {
        code,
        branchId,
        employeeId,
        totalAmount,
        items: {
          createMany: {
            data: items.map((i) => ({
              barcodeId: i.barcodeId,
              price: i.price,
            })),
          },
        },
      },
    });

    // อัปเดตสถานะ stockItem ทั้งหมดเป็น SOLD
    await prisma.stockItem.updateMany({
      where: { id: { in: barcodeIds } },
      data: { status: 'SOLD' },
    });

    return res.status(201).json({ message: 'ขายสินค้าสำเร็จ', code });
  } catch (err) {
    console.error('❌ [createSaleOrder] error:', err);
    return res.status(500).json({ error: 'ไม่สามารถบันทึกการขายได้' });
  }
};


  
  module.exports = {

    createSaleOrder,
  };

  
