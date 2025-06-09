const { PrismaClient } = require('@prisma/client');
const dayjs = require('dayjs');
const prisma = new PrismaClient();

// 🔧 สร้างเลขที่ใบขายอัตโนมัติ
const generateSaleCode = async (branchId) => {
    const paddedBranch = String(branchId).padStart(2, '0'); // ✅ เติม 0 ด้านหน้า
    const now = dayjs();
    const prefix = `SL-${paddedBranch}${now.format('YYMM')}`;

    const count = await prisma.sale.count({
      where: {
        branchId: Number(branchId), // ✅ บังคับให้เป็นตัวเลข
        createdAt: {
          gte: now.startOf('month').toDate(),
          lt: now.endOf('month').toDate(),
        },
      },
    });
  
    const running = String(count + 1).padStart(4, '0');
   
    return `${prefix}-${running}`;
  };
  


// ✅ สร้างการขายใหม่ (ตามมาตรฐาน flow การขายที่ยืนยันแล้ว)
// ✅ แยกขั้นตอน: ไม่เปลี่ยนสถานะ stockItem ในขั้นตอนนี้
// ✅ จะเปลี่ยนสถานะ stockItem → 'SOLD' หลังจากบันทึก payment สำเร็จเท่านั้น ผ่าน markSaleAsPaid()
const createSale = async (req, res) => {
  try {
    const {
      customerId,     
      totalBeforeDiscount,
      totalDiscount,
      vat,
      vatRate,
      totalAmount,
      paymentMethod,
      paymentDetails,
      note,
      items, // [{ stockItemId, barcodeId, price, discount, basePrice, vatAmount, remark }]
    } = req.body;

    const branchId = req.user?.branchId;
    const employeeId = req.user?.employeeId;

    const barcodeIds = items
      .map((i) => i.barcodeId)
      .filter((id) => !!id);

    // ตรวจสอบว่า barcodeId เหล่านี้เป็นของสินค้าที่ยังไม่ได้ขาย
    const stockItems = await prisma.stockItem.findMany({
      where: {
        id: { in: barcodeIds },
        status: 'IN_STOCK',
      },
    });

    if (stockItems.length !== items.length) {
      return res.status(400).json({ error: 'บางรายการไม่พร้อมขาย หรือถูกขายไปแล้ว' });
    }

    // สร้างเลขที่ใบขาย
    const code = await generateSaleCode(branchId);
  
    const sale = await prisma.sale.create({
      data: {
        code, // ✅ เพิ่มเลขที่ใบขาย
        customerId,
        employeeId,
        branchId,
        totalBeforeDiscount,
        totalDiscount,
        vat,
        vatRate,
        totalAmount,
        paymentMethod,
        paymentDetails,
        note,
        items: {
          create: items.map((item) => ({
            stockItemId: item.stockItemId,
            basePrice: item.basePrice,
            vatAmount: item.vatAmount,
            price: item.price,
            discount: item.discount,
            remark: item.remark,
          })),
        },
      },
      include: { items: true },
    });

    const stockItemIds = sale.items.map((item) => item.stockItemId);

    return res.status(201).json({
      id: sale.id,      // ✅ ใช้ UUID จริงของ Prisma
      code: sale.code,  // ✅ สำหรับแสดงผลและอ้างอิงใบเสร็จ
      stockItemIds,     // ✅ คืนรายการ stockItemIds ที่ขายแล้ว
    });
  } catch (error) {
    console.error("❌ [createSale] Error:", error);
    return res.status(500).json({ error: "ไม่สามารถสร้างการขายได้" });
  }
};






// ✅ ดึงรายการขายทั้งหมด
const getAllSales = async (req, res) => {
  try {
    const sales = await prisma.sale.findMany({
      orderBy: { soldAt: "desc" },
      include: { items: true },
    });
    return res.json(sales);
  } catch (error) {
    console.error("❌ [getAllSales] Error:", error);
    return res.status(500).json({ error: "ไม่สามารถดึงรายการขายได้" });
  }
};







// ✅ ดึงข้อมูลการขายตาม ID
const getSaleById = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await prisma.sale.findUnique({
      where: { id: Number(id) },
      include: { items: true },
    });

    if (!sale) return res.status(404).json({ error: "ไม่พบรายการขายนี้" });
    return res.json(sale);
  } catch (error) {
    console.error("❌ [getSaleById] Error:", error);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการค้นหา" });
  }
};

const getSalesByBranchId = async (req, res) => {
  try {
    
    const branchId = req.user.branchId;
    

    if (!branchId) {
      return res.status(400).json({ error: "branchId ไม่ถูกต้อง" });
    }

    const sales = await prisma.sale.findMany({
      where: { branchId },
      orderBy: { soldAt: "desc" },
      include: {
        customer: true, // ต้อง include customer เพื่อใช้ชื่อ/เบอร์โทร
      },
    });

    const mapped = sales.map((sale) => ({
      id: sale.id,
      code: sale.code,
      totalAmount: sale.totalAmount,
      createdAt: sale.createdAt,
      customerName: sale.customer?.name || "-",
      customerPhone: sale.customer?.phone || "-",
    }));

    return res.json(mapped);
  } catch (error) {
    console.error("❌ [getSalesByBranchId] Error:", error);
    return res.status(500).json({ error: "ไม่สามารถโหลดข้อมูลใบเสร็จย้อนหลัง" });
  }
};   


const markSaleAsPaid = async (req, res) => {
  const saleId =  parseInt(req.params.id);
  const { branchId } = req.user;

  console.log('markSaleAsPaid saleId : ',saleId)
  console.log('markSaleAsPaid branchId : ',branchId)
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true },
    });

    if (!sale || sale.branchId !== branchId) {
      return res.status(404).json({ message: 'ไม่พบรายการขายนี้ในสาขาของคุณ' });
    }

    await prisma.$transaction([
      prisma.sale.update({
        where: { id: saleId },
        data: {
          paid: true,
          paidAt: new Date(),
        },
      }),
      ...sale.items.map((item) =>
        prisma.stockItem.update({
          where: { id: item.stockItemId },
          data: { status: 'SOLD' },
        })
      ),
    ]);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ [markSaleAsPaid]', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดขณะเปลี่ยนสถานะสินค้า' });
  }
};


module.exports = {
  createSale,
  getAllSales,
  getSaleById,
  getSalesByBranchId,
  markSaleAsPaid,
  
};

   
