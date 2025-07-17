const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const dayjs = require('dayjs');


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

const createSale = async (req, res) => {
  try {
    const {
      customerId,
      totalBeforeDiscount,
      totalDiscount,
      vat,
      vatRate,
      totalAmount,
      note,
      items, // [{ stockItemId, barcodeId, price, discount, basePrice, vatAmount, remark }]
      mode = 'CASH', // เพิ่ม mode จาก body, ค่าเริ่มต้นเป็น 'CASH'
    } = req.body;

    const branchId = req.user?.branchId;
    const employeeId = req.user?.employeeId;

    // --- Input Validation ---
    // ตรวจสอบว่ามี branchId และ employeeId จากข้อมูลผู้ใช้งานหรือไม่
    if (!branchId || !employeeId) {
      return res.status(401).json({ error: 'ไม่ได้รับข้อมูลสาขาหรือพนักงานที่ถูกต้อง' });
    }

    // ตรวจสอบว่ามีรายการสินค้าและเป็นอาร์เรย์ที่ไม่ว่างเปล่า
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'ต้องมีรายการสินค้าอย่างน้อยหนึ่งรายการ' });
    }

    // ตรวจสอบความถูกต้องของข้อมูลตัวเลขหลัก
    const numericFields = { totalBeforeDiscount, totalDiscount, vat, vatRate, totalAmount };
    for (const [key, value] of Object.entries(numericFields)) {
      if (typeof value !== 'number' || isNaN(value) || value < 0) {
        return res.status(400).json({ error: `ข้อมูล ${key} ไม่ถูกต้อง หรือเป็นค่าติดลบ` });
      }
    }

    // ตรวจสอบความถูกต้องของข้อมูลแต่ละรายการสินค้า
    for (const item of items) {
      if (!item.stockItemId || typeof item.stockItemId !== 'number') {
        return res.status(400).json({ error: 'รายการสินค้าต้องมี stockItemId ที่ถูกต้องและเป็นตัวเลข' });
      }
      const itemNumericFields = { price: item.price, discount: item.discount, basePrice: item.basePrice, vatAmount: item.vatAmount };
      for (const [key, value] of Object.entries(itemNumericFields)) {
        if (typeof value !== 'number' || isNaN(value) || value < 0) {
          return res.status(400).json({ error: `ข้อมูล ${key} ในรายการสินค้า (stockItemId: ${item.stockItemId}) ไม่ถูกต้อง หรือเป็นค่าติดลบ` });
        }
      }
    }

    let saleStatus;
    let isCreditSale = false;
    let paidStatus = false;
    let paidAtDate = null;
    let dueDate = null;
    let customerSaleType = 'NORMAL'; // Default saleType

    let customerProfile = null;
    if (customerId) {
      customerProfile = await prisma.customerProfile.findUnique({
        where: { id: customerId },
        select: { paymentTerms: true, type: true }, // Select type as well
      });

      if (customerProfile) {
        // Set saleType based on customer type
        if (customerProfile.type === 'ORGANIZATION') {
          customerSaleType = 'WHOLESALE'; // หรือ 'GOVERNMENT' ขึ้นอยู่กับว่าต้องการแยกอย่างไร
        } else if (customerProfile.type === 'GOVERNMENT') {
          customerSaleType = 'GOVERNMENT';
        }
      }
    }

    // กำหนดสถานะและข้อมูลที่เกี่ยวข้องกับการขายตามโหมด (เงินสด/เครดิต)
    if (mode === 'CREDIT') {
      if (!customerId) {
        return res.status(400).json({ error: 'กรณีขายเครดิต ต้องระบุลูกค้า (customerId)' });
      }
      isCreditSale = true;
      saleStatus = 'DRAFT'; // สำหรับการขายเครดิต เริ่มต้นที่สถานะ DRAFT
      paidStatus = false;

      // คำนวณวันครบกำหนดชำระ (dueDate) สำหรับการขายเครดิต
      if (customerProfile && typeof customerProfile.paymentTerms === 'number' && customerProfile.paymentTerms >= 0) {
        dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + customerProfile.paymentTerms);
      } else {
        // หากไม่พบ paymentTerms หรือไม่ถูกต้อง อาจจะกำหนดค่าเริ่มต้นหรือแจ้งข้อผิดพลาด
        console.warn(`[createSale] Customer ${customerId} has no valid paymentTerms. Due date not set.`);
      }
    } else { // mode === 'CASH' (โหมดเงินสด)
      saleStatus = 'COMPLETED'; // การขายเงินสดถือว่าเสร็จสมบูรณ์ทันที
      paidStatus = true;
      paidAtDate = new Date();
    }

    const stockItemIds = items
      .map((i) => i.stockItemId)
      .filter((id) => !!id);

    // ตรวจสอบว่า stockItemId เหล่านี้เป็นของสินค้าที่ยังไม่ได้ขายและอยู่ในสต็อก
    // การตรวจสอบนี้สำคัญสำหรับทุกโหมดการขาย
    const stockItems = await prisma.stockItem.findMany({
      where: {
        id: { in: stockItemIds },
        status: 'IN_STOCK',
      },
    });

    if (stockItems.length !== items.length) {
      // ระบุรายการที่ไม่พร้อมขายเพื่อช่วยในการแก้ไข
      const availableStockItemIds = new Set(stockItems.map(si => si.id));
      const unavailableItems = items.filter(item => !availableStockItemIds.has(item.stockItemId));
      const unavailableStockIds = unavailableItems.map(item => item.stockItemId);
      return res.status(400).json({
        error: 'บางรายการไม่พร้อมขาย หรือถูกขายไปแล้ว',
        unavailableStockItemIds: unavailableStockIds
      });
    }

    // สร้างเลขที่ใบขายที่ไม่ซ้ำกัน
    const code = await generateSaleCode(branchId);

    // เริ่มต้น Transaction เพื่อสร้างใบขายและอัปเดตสต็อกพร้อมกัน
    const transactionOps = [
      prisma.sale.create({
        data: {
          code,
          status: saleStatus, // ใช้สถานะที่กำหนดจาก mode (DRAFT หรือ COMPLETED)
          isCredit: isCreditSale, // กำหนดว่าเป็นลูกค้าเครดิตหรือไม่
          paid: paidStatus, // กำหนดสถานะการชำระเงิน
          paidAt: paidAtDate, // กำหนดวันที่ชำระเงิน (ถ้าชำระแล้ว)
          dueDate: dueDate, // กำหนดวันครบกำหนดชำระ (สำหรับเครดิต)
          customerId: customerId, // ใช้ customerId ที่รับมา (อาจเป็น null สำหรับเงินสด)
          employeeId,
          branchId,
          totalBeforeDiscount,
          totalDiscount,
          vat,
          vatRate,
          totalAmount,
          note,
          saleType: customerSaleType, // ✅ กำหนด saleType ตามประเภทลูกค้า
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
      }),
      // อัปเดตสถานะ StockItem เป็น 'SOLD' สำหรับสินค้าที่ขายไปแล้ว
      prisma.stockItem.updateMany({
        where: {
          id: { in: stockItemIds },
          status: 'IN_STOCK', // ตรวจสอบสถานะอีกครั้งเพื่อความปลอดภัยก่อนอัปเดต
        },
        data: {
          status: 'SOLD',
          soldAt: new Date(),
        },
      })
    ];

    // ดำเนินการ Transaction
    const [createdSale] = await prisma.$transaction(transactionOps);

    // ดึงข้อมูลใบขายที่สร้างขึ้นมาพร้อมกับข้อมูลที่เกี่ยวข้อง
    const sale = await prisma.sale.findUnique({
      where: { id: createdSale.id },
      include: {
        branch: true,
        customer: true,
        employee: true,
        items: {
          include: {
            stockItem: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    // ส่งคืนข้อมูลใบขายที่สร้างขึ้นพร้อมกับ stockItemIds ที่เกี่ยวข้อง
    return res.status(201).json({
      ...sale,
      stockItemIds, // ✅ แนบไปด้วยใน response เพื่อการตรวจสอบเพิ่มเติม
    });

  } catch (error) {
    console.error("❌ [createSale] Error:", error);
    // จัดการข้อผิดพลาดเฉพาะที่ทราบ
    if (error.code === 'P2002') { // Prisma error code สำหรับ unique constraint violation
      return res.status(409).json({ error: "ข้อมูลซ้ำซ้อน เช่น หมายเลขใบขายถูกใช้ไปแล้ว" });
    }
    // ข้อผิดพลาดทั่วไป
    return res.status(500).json({ error: "ไม่สามารถสร้างการขายได้ เนื่องจากเกิดข้อผิดพลาดภายในระบบ" });
  }
};


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

const getAllSalesReturn = async (req, res) => {
  try {
    const { branchId } = req.user;

    const sales = await prisma.sale.findMany({
      where: { branchId }, // ✅ เพิ่มเงื่อนไขสำคัญ
      orderBy: { soldAt: 'desc' },
      include: {
        customer: true,
        items: {
          include: {
            stockItem: {
              include: {
                product: true, // ✅ เพื่อให้แสดงชื่อสินค้าได้
              }
            }
          }
        }
      },
    });

    return res.json(sales);
  } catch (error) {
    console.error("❌ [getSalesByBranch] Error:", error);
    return res.status(500).json({ error: "ไม่สามารถดึงรายการขายได้" });
  }
};

const getSaleById = async (req, res) => {
  try {
    const { id } = req.params;
    const { branchId } = req.user; // ✅ ต้องได้จาก token/user context เท่านั้น

    const sale = await prisma.sale.findFirst({
      where: {
        id: Number(id),
        branchId: branchId, // ✅ กรองตามสาขาเพื่อความปลอดภัย
      },
      include: {
        customer: true,
        items: {
          include: {
            stockItem: {
              include: {
                product: true, // ✅ ดึงชื่อสินค้า
              },
            },
          },
        },
      },
    });

    if (!sale) return res.status(404).json({ error: "ไม่พบรายการขายนี้ หรือไม่อยู่ในสาขานี้" });
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
  const saleId = parseInt(req.params.id);
  const { branchId } = req.user;

  console.log('markSaleAsPaid saleId : ', saleId)
  console.log('markSaleAsPaid branchId : ', branchId)
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


const searchPrintableSales = async (req, res) => {
  try {
    const branchId = req.user.branchId;
    // ✅ รับ keyword, fromDate, toDate, limit จาก query parameters
    const { keyword, fromDate, toDate, limit } = req.query;

    const whereClause = {
      branchId,
      // Exclude cancelled sales for printable delivery notes
      status: {
        not: 'CANCELLED',
      },
    };

    // เพิ่มเงื่อนไขการค้นหาด้วย keyword
    if (keyword) {
      whereClause.OR = [
        {
          customer: {
            name: {
              contains: keyword,
              mode: 'insensitive',
            },
          },
        },
        {
          customer: {
            phone: {
              contains: keyword,
              mode: 'insensitive',
            },
          },
        },
        {
          code: {
            contains: keyword,
            mode: 'insensitive',
          },
        },
      ];
    }

    // เพิ่มเงื่อนไขการค้นหาด้วยช่วงวันที่
    if (fromDate || toDate) {
      whereClause.soldAt = {};
      if (fromDate) {
        whereClause.soldAt.gte = new Date(fromDate);
      }
      if (toDate) {
        // เพิ่ม 1 วันเพื่อให้ครอบคลุมถึงสิ้นสุดวันนั้นๆ
        const endDate = new Date(toDate);
        endDate.setDate(endDate.getDate() + 1);
        whereClause.soldAt.lte = endDate;
      }
    }

    const sales = await prisma.sale.findMany({
      where: whereClause,
      orderBy: { soldAt: 'desc' }, // Order by sale date
      // ✅ เพิ่ม take เพื่อจำกัดจำนวนผลลัพธ์
      ...(limit && { take: parseInt(limit, 10) }), // แปลง limit เป็นตัวเลข
      include: {
        branch: true,
        customer: true,
        employee: true, // Include employee who made the sale
        items: {
          include: {
            stockItem: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    console.log('searchPrintableSales:', sales);
    res.json(sales);
  } catch (error) {
    console.error('❌ [searchPrintableSales] error:', error);
    res.status(500).json({ message: 'ไม่สามารถโหลดข้อมูลใบส่งของได้' });
  }
};


module.exports = {
  createSale,
  getAllSales,
  getSaleById,
  getSalesByBranchId,
  markSaleAsPaid,
  getAllSalesReturn,
  searchPrintableSales,

};


