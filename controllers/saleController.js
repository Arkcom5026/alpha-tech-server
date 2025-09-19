// saleController.js

const { prisma, Prisma } = require('../lib/prisma');
const dayjs = require('dayjs');

// --- Feature Flags (Backward-Compatible) ---
const ENABLE_PAYMENT_AUTOCREATE = process.env.ENABLE_PAYMENT_AUTOCREATE === '1'; // สร้าง Payment อัตโนมัติเมื่อขายสด
const NORMALIZE_DECIMAL_TO_NUMBER = process.env.NORMALIZE_DECIMAL_TO_NUMBER !== '0'; // ส่งเลขเป็น number ให้ FE เดิม (ค่าเริ่มต้น: เปิด)
const SALE_CODE_MAX_RETRY = Number(process.env.SALE_CODE_MAX_RETRY || 3);
const CREDIT_SALE_STATUS = process.env.CREDIT_SALE_STATUS || 'DRAFT'; // กรณีเครดิต: DRAFT/DELIVERED/FINALIZED
const STRICT_COMPLETED_REQUIRES_PAYMENT = process.env.STRICT_COMPLETED_REQUIRES_PAYMENT === '1'; // ถ้าเปิด: COMPLETED ได้ก็ต่อเมื่อมี Payment จริง

// --- Helpers ---
const D = (v) => new Prisma.Decimal(typeof v === 'string' ? v : Number(v));
const toNum = (v) => (v && typeof v === 'object' && 'toNumber' in v ? v.toNumber() : Number(v));
const isMoneyLike = (v) => (typeof v === 'number' && !isNaN(v)) || (typeof v === 'string' && /^\d+(\.\d{1,2})?$/.test(v));

const normalizePayment = (payment) => {
  if (!NORMALIZE_DECIMAL_TO_NUMBER || !payment) return payment;
  const cloned = { ...payment };
  if (Array.isArray(cloned.items)) {
    cloned.items = cloned.items.map((it) => ({
      ...it,
      amount: it?.amount != null ? toNum(it.amount) : it.amount,
    }));
  }
  return cloned;
};

const normalizeSaleMoney = (sale) => {
  if (!NORMALIZE_DECIMAL_TO_NUMBER || !sale) return sale;
  const moneyKeys = ['totalBeforeDiscount','totalDiscount','vat','vatRate','totalAmount'];
  for (const k of moneyKeys) if (k in sale && sale[k] != null) sale[k] = toNum(sale[k]);
  if (Array.isArray(sale.items)) {
    sale.items = sale.items.map((it) => {
      const cloned = { ...it };
      for (const k of ['basePrice','vatAmount','price','discount','refundedAmount'])
        if (k in cloned && cloned[k] != null) cloned[k] = toNum(cloned[k]);
      return cloned;
    });
  }
  if (Array.isArray(sale.payments)) {
    sale.payments = sale.payments.map((p) => normalizePayment(p));
  }
  return sale;
};

const generateSaleCode = async (branchId, attempt = 0) => {
  const paddedBranch = String(branchId).padStart(2, '0');
  const now = dayjs();
  const prefix = `SL-${paddedBranch}${now.format('YYMM')}`;

  const count = await prisma.sale.count({
    where: {
      branchId: Number(branchId),
      createdAt: {
        gte: now.startOf('month').toDate(),
        lt: now.endOf('month').toDate(),
      },
    },
  });

  const running = String(count + 1 + attempt).padStart(4, '0');
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
      items, // [{ stockItemId, price, discount, basePrice, vatAmount, remark }]
      mode = 'CASH',
    } = req.body;

    const branchId = req.user?.branchId;
    const employeeId = req.user?.employeeId;

    if (!branchId || !employeeId) {
      return res.status(401).json({ error: 'ไม่ได้รับข้อมูลสาขาหรือพนักงานที่ถูกต้อง' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'ต้องมีรายการสินค้าอย่างน้อยหนึ่งรายการ' });
    }

    // Validate money fields (accept number or string)
    const moneyFields = { totalBeforeDiscount, totalDiscount, vat, vatRate, totalAmount };
    for (const [key, value] of Object.entries(moneyFields)) {
      if (!isMoneyLike(value) || (key !== 'totalDiscount' && Number(value) < 0)) {
        return res.status(400).json({ error: `ข้อมูล ${key} ไม่ถูกต้อง หรือเป็นค่าติดลบ` });
      }
    }

    for (const item of items) {
      if (!item.stockItemId || typeof item.stockItemId !== 'number') {
        return res.status(400).json({ error: 'รายการสินค้าต้องมี stockItemId ที่ถูกต้องและเป็นตัวเลข' });
      }
      const itemNumericFields = { price: item.price, discount: item.discount, basePrice: item.basePrice, vatAmount: item.vatAmount };
      for (const [key, value] of Object.entries(itemNumericFields)) {
        if (!isMoneyLike(value) || Number(value) < 0) {
          return res.status(400).json({ error: `ข้อมูล ${key} ในรายการสินค้า (stockItemId: ${item.stockItemId}) ไม่ถูกต้อง หรือเป็นค่าติดลบ` });
        }
      }
    }

    // Determine sale meta
    let saleStatus;
    let isCreditSale = false;
    let paidStatus = false;
    let paidAtDate = null;
    let dueDate = null;
    let customerSaleType = 'NORMAL';

    if (customerId) {
      const customerProfile = await prisma.customerProfile.findUnique({
        where: { id: customerId },
        select: { paymentTerms: true, type: true },
      });
      if (customerProfile) {
        if (customerProfile.type === 'ORGANIZATION') customerSaleType = 'WHOLESALE';
        else if (customerProfile.type === 'GOVERNMENT') customerSaleType = 'GOVERNMENT';
        if (mode === 'CREDIT' && typeof customerProfile.paymentTerms === 'number' && customerProfile.paymentTerms >= 0) {
          dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + customerProfile.paymentTerms);
        }
      }
    }

    if (mode === 'CREDIT') {
      isCreditSale = true;
      saleStatus = CREDIT_SALE_STATUS; // Backward-compatible default: DRAFT
      paidStatus = false;
    } else {
      if (STRICT_COMPLETED_REQUIRES_PAYMENT && !ENABLE_PAYMENT_AUTOCREATE) {
        // ยังไม่สร้าง Payment อัตโนมัติ → ยังไม่ควร mark เป็น COMPLETED
        saleStatus = 'FINALIZED';
        paidStatus = false;
        paidAtDate = null;
      } else {
        saleStatus = 'COMPLETED';
        paidStatus = true;
        paidAtDate = new Date();
      }
    }

    const stockItemIds = items.map((i) => i.stockItemId).filter(Boolean);
    // Prevent duplicate stock items in the same sale
    const dup = stockItemIds.find((id, i) => stockItemIds.indexOf(id) !== i);
    if (dup) {
      return res.status(400).json({ error: `ห้ามใส่สินค้าชิ้นเดียวกันซ้ำ (stockItemId=${dup})` });
    }

    const stockItems = await prisma.stockItem.findMany({
      where: { id: { in: stockItemIds }, status: 'IN_STOCK' },
      select: { id: true },
    });
    if (stockItems.length !== items.length) {
      const availableIds = new Set(stockItems.map((si) => si.id));
      const unavailable = items.filter((it) => !availableIds.has(it.stockItemId)).map((it) => it.stockItemId);
      return res.status(400).json({ error: 'บางรายการไม่พร้อมขาย หรือถูกขายไปแล้ว', unavailableStockItemIds: unavailable });
    }

    // Try create with retry on unique collision (code)
    let createdSale;
    for (let attempt = 0; attempt <= SALE_CODE_MAX_RETRY; attempt++) {
      const code = await generateSaleCode(branchId, attempt);
      try {
        createdSale = await prisma.$transaction(async (tx) => {
          const sale = await tx.sale.create({
            data: {
              code,
              status: saleStatus,
              isCredit: isCreditSale,
              paid: paidStatus,
              paidAt: paidAtDate,
              dueDate,
              customerId,
              employeeId,
              branchId,
              totalBeforeDiscount: D(totalBeforeDiscount),
              totalDiscount: D(totalDiscount),
              vat: D(vat),
              vatRate: D(vatRate),
              totalAmount: D(totalAmount),
              note,
              saleType: customerSaleType,
              items: {
                create: items.map((item) => ({
                  stockItemId: item.stockItemId,
                  basePrice: D(item.basePrice),
                  vatAmount: D(item.vatAmount),
                  price: D(item.price),
                  discount: D(item.discount),
                  remark: item.remark,
                })),
              },
            },
          });

          const upd = await tx.stockItem.updateMany({
            where: { id: { in: stockItemIds }, status: 'IN_STOCK' },
            data: { status: 'SOLD', soldAt: new Date() },
          });

          if (upd.count !== stockItemIds.length) {
            throw Object.assign(new Error('Some items already sold.'), { status: 409, code: 'STOCK_CONFLICT' });
          }

          if (ENABLE_PAYMENT_AUTOCREATE && !isCreditSale) {
            await tx.payment.create({
              data: {
                code: `PM-${sale.code}`,
                saleId: sale.id,
                branchId,
                employeeProfileId: employeeId,
                receivedAt: new Date(),
                items: { create: [{ paymentMethod: 'CASH', amount: D(totalAmount) }] },
              },
              include: { items: true },
            });
          }

          return sale;
        });
        break; // success
      } catch (err) {
        if (err?.code === 'P2002' && /code/.test(String(err?.meta?.target))) {
          if (attempt < SALE_CODE_MAX_RETRY) continue; // retry with next running
        }
        throw err; // unknown error or max retry reached
      }
    }

    const sale = await prisma.sale.findUnique({
      where: { id: createdSale.id },
      include: {
        branch: true,
        customer: true,
        employee: true,
        items: { include: { stockItem: { include: { product: true } } } },
      },
    });

    // Fetch payments separately to avoid include name differences across schemas
    const payments = await prisma.payment.findMany({
      where: { saleId: sale.id },
      include: { items: true },
      orderBy: { receivedAt: 'asc' },
    });

    const response = normalizeSaleMoney({ ...sale, payments, stockItemIds });
    return res.status(201).json(response);
  } catch (error) {
    console.error('❌ [createSale] Error:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'ข้อมูลซ้ำซ้อน เช่น หมายเลขใบขายถูกใช้ไปแล้ว' });
    }
    return res.status(500).json({ error: 'ไม่สามารถสร้างการขายได้ เนื่องจากเกิดข้อผิดพลาดภายในระบบ' });
  }
};

const getAllSales = async (req, res) => {
  try {
    const branchId = req.user?.branchId;
    const sales = await prisma.sale.findMany({
      where: { branchId: Number(branchId) },
      orderBy: { soldAt: 'desc' },
      include: { items: true },
    });
    const normalized = NORMALIZE_DECIMAL_TO_NUMBER ? sales.map((s) => normalizeSaleMoney(s)) : sales;
    return res.json(normalized);
  } catch (error) {
    console.error('❌ [getAllSales] Error:', error);
    return res.status(500).json({ error: 'ไม่สามารถดึงรายการขายได้' });
  }
};

const getAllSalesReturn = async (req, res) => {
  try {
    const branchId = req.user?.branchId;

    if (!branchId) return res.status(401).json({ error: 'unauthorized' });

    const sales = await prisma.sale.findMany({
      where: { branchId: Number(branchId) },
      orderBy: { soldAt: 'desc' },
      include: {
        customer: true,
        items: {
          include: { stockItem: { include: { product: true } } },
        },
      },
    });

    const normalized = NORMALIZE_DECIMAL_TO_NUMBER ? sales.map((s) => normalizeSaleMoney(s)) : sales;
    return res.json(normalized);
  } catch (error) {
    console.error('❌ [getAllSalesReturn] Error:', error);
    return res.status(500).json({ error: 'ไม่สามารถดึงรายการขายได้' });
  }
};

const getSaleById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid sale ID' });
    }

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        branch: true,
        customer: true,
        employee: true,
        items: { include: { stockItem: { include: { product: true } } } },
      },
    });

    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    if (sale.branchId !== req.user?.branchId) return res.status(404).json({ error: 'ไม่พบรายการขายนี้ในสาขาของคุณ' });

    // Fetch payments separately (schema-safe)
    const payments = await prisma.payment.findMany({ where: { saleId: id }, include: { items: true }, orderBy: { receivedAt: 'asc' } });

    const response = normalizeSaleMoney({ ...sale, payments });
    res.json(response);
  } catch (error) {
    console.error('❌ [getSaleById] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getSalesByBranchId = async (req, res) => {
  try {
    const branchId = req.user?.branchId;

    if (!branchId) {
      return res.status(400).json({ error: 'branchId ไม่ถูกต้อง' });
    }

    const sales = await prisma.sale.findMany({
      where: { branchId: Number(branchId) },
      orderBy: { soldAt: 'desc' },
      include: {
        customer: true,
      },
    });

    const mapped = sales.map((sale) => ({
      id: sale.id,
      code: sale.code,
      totalAmount: NORMALIZE_DECIMAL_TO_NUMBER ? toNum(sale.totalAmount) : sale.totalAmount,
      createdAt: sale.createdAt,
      customerName: sale.customer?.name || '-',
      customerPhone: sale.customer?.phone || '-',
    }));

    return res.json(mapped);
  } catch (error) {
    console.error('❌ [getSalesByBranchId] Error:', error);
    return res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลใบเสร็จย้อนหลัง' });
  }
};

const markSaleAsPaid = async (req, res) => {
  const saleId = parseInt(req.params.id, 10);
  const { branchId } = req.user;

  try {
    const sale = await prisma.sale.findUnique({ where: { id: saleId }, include: { items: true } });

    if (!sale || sale.branchId !== branchId) {
      return res.status(404).json({ message: 'ไม่พบรายการขายนี้ในสาขาของคุณ' });
    }

    // รวมยอดชำระจาก PaymentItem (ไม่รวมที่ถูกยกเลิก)
    const agg = await prisma.paymentItem.aggregate({
      _sum: { amount: true },
      where: { payment: { saleId, isCancelled: false } },
    });
    const paidSum = agg._sum.amount || new Prisma.Decimal(0);

    const isFullyPaid = paidSum.greaterThanOrEqualTo ? paidSum.greaterThanOrEqualTo(sale.totalAmount) : toNum(paidSum) >= toNum(sale.totalAmount);

    if (sale.paid && isFullyPaid) {
      return res.status(200).json({ success: true }); // idempotent
    }

    if (!isFullyPaid) {
      return res.status(409).json({ message: 'ยอดชำระยังไม่ครบ ไม่สามารถปิดบิลได้' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.sale.update({ where: { id: saleId }, data: { paid: true, paidAt: new Date() } });
      for (const it of sale.items) {
        await tx.stockItem.update({ where: { id: it.stockItemId }, data: { status: 'SOLD', soldAt: new Date() } });
      }
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ [markSaleAsPaid]', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดขณะเปลี่ยนสถานะสินค้า' });
  }
};

const searchPrintableSales = async (req, res) => {
  try {
    const branchId = req.user?.branchId;
    const { keyword, fromDate, toDate, limit } = req.query;

    const whereClause = {
      branchId,
      status: { not: 'CANCELLED' },
    };

    if (keyword) {
      whereClause.OR = [
        { customer: { is: { name: { contains: keyword, mode: 'insensitive' } } } },
        { customer: { is: { phone: { contains: keyword, mode: 'insensitive' } } } },
        { code: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    if (fromDate || toDate) {
      whereClause.soldAt = {};
      if (fromDate) whereClause.soldAt.gte = new Date(fromDate);
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setDate(endDate.getDate() + 1);
        whereClause.soldAt.lte = endDate;
      }
    }

    if (!branchId) return res.status(401).json({ message: 'unauthorized' });

    whereClause.branchId = Number(branchId);

    const sales = await prisma.sale.findMany({
      where: whereClause,
      orderBy: { soldAt: 'desc' },
      ...(limit ? { take: parseInt(limit, 10) } : {}),
      include: {
        branch: true,
        customer: true,
        employee: true,
        items: { include: { stockItem: { include: { product: true } } } },
      },
    });

    const normalized = NORMALIZE_DECIMAL_TO_NUMBER ? sales.map((s) => normalizeSaleMoney(s)) : sales;
    res.json(normalized);
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





