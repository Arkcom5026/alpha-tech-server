const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const dayjs = require('dayjs');

// ✅ ฟังก์ชันสร้างเลข Combined Billing Document อัตโนมัติ พร้อมเลขสาขา แบบปลอดภัยไม่ซ้ำ
const generateCombinedBillingCode = async (branchId) => {
  const paddedBranch = String(branchId).padStart(2, '0');
  const now = dayjs();
  const yearMonth = (now.year() + 543).toString().slice(-2) + now.format('MM'); // YYMM แบบ พ.ศ.
  const prefix = `CBL-${paddedBranch}${yearMonth}`;

  const lastCode = await prisma.combinedBillingDocument.findFirst({
    where: {
      branchId,
      code: { startsWith: prefix },
    },
    orderBy: { code: 'desc' },
    select: { code: true },
  });

  const nextNumber = lastCode
    ? parseInt(lastCode.code.split('-')[2], 10) + 1
    : 1;

  const code = `${prefix}-${String(nextNumber).padStart(4, '0')}`;
  return code;
};

// ✅ สร้าง Combined Billing Document ใหม่ และอัปเดตสถานะ Sale เป็น FINALIZED
const createCombinedBillingDocument = async (req, res) => {
  try {
    const { branchId, id: employeeId } = req.user;
    const { saleIds, note } = req.body;

    const sales = await prisma.sale.findMany({
      where: { id: { in: saleIds }, branchId },
      include: { customer: true },
    });

    if (sales.length === 0) return res.status(400).json({ error: 'ไม่พบรายการขายที่เลือก' });

    const customerId = sales[0].customerId;
    const allSameCustomer = sales.every((s) => s.customerId === customerId);
    if (!allSameCustomer) return res.status(400).json({ error: 'ใบส่งของต้องเป็นลูกค้ารายเดียวกัน' });

    const code = await generateCombinedBillingCode(branchId);

    const totalBeforeVat = sales.reduce((sum, s) => sum + s.totalBeforeDiscount, 0);
    const vatAmount = sales.reduce((sum, s) => sum + s.vat, 0);
    const totalAmount = sales.reduce((sum, s) => sum + s.totalAmount, 0);

    const document = await prisma.combinedBillingDocument.create({
      data: {
        code,
        note,
        createdBy: employeeId,
        customerId,
        branchId,
        totalBeforeVat,
        vatAmount,
        totalAmount,
        sales: {
          connect: saleIds.map((id) => ({ id })),
        },
      },
    });

    // ✅ อัปเดตสถานะ Sale → FINALIZED
    await prisma.sale.updateMany({
      where: { id: { in: saleIds }, branchId },
      data: { status: 'FINALIZED' },
    });

    res.status(201).json(document);
  } catch (error) {
    console.error('createCombinedBillingDocument error:', error);
    res.status(500).json({ error: 'ไม่สามารถสร้างเอกสารรวมได้' });
  }
};


// ✅ ดึงรายการ Sale ที่รวมบิลได้ (status = DELIVERED เท่านั้น)
const getCombinableSales = async (req, res) => {
  try {
    const { branchId } = req.user;
    const sales = await prisma.sale.findMany({
      where: {
        branchId,
        status: 'DELIVERED',
        combinedBillingId: null,
        customerId: { not: null },
      },
      include: {
        customer: true,
      },
      orderBy: { soldAt: 'desc' },
    });
    res.json(sales);
  } catch (error) {
    console.error('getCombinableSales error:', error);
    res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลได้' });
  }
};


// ✅ ดึง CombinedBillingDocument รายตัว
const getCombinedBillingById = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await prisma.combinedBillingDocument.findUnique({
      where: { id: Number(id) },
      include: {
        customer: true,
        employee: true,
        sales: true,
      },
    });

    if (!document) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    res.json(document);
  } catch (error) {
    console.error('getCombinedBillingById error:', error);
    res.status(500).json({ error: 'ไม่สามารถโหลดเอกสารได้' });
  }
};

// ✅ ดึงลูกค้าที่มีใบส่งของค้างรวมบิล (status = DELIVERED เท่านั้น)
const getCustomersWithPendingSales = async (req, res) => {
  try {
    const { branchId } = req.user;
    const sales = await prisma.sale.findMany({
      where: {
        branchId,
        status: 'DELIVERED',
        combinedBillingId: null,
        customerId: { not: null },
      },
      include: {
        customer: true,
      },
      orderBy: { soldAt: 'asc' },
    });

    const customerMap = new Map();

    sales.forEach((sale) => {
      const customerId = sale.customerId;
      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          id: sale.customer.id,
          name: sale.customer.name,
          phone: sale.customer.phone,
          email: sale.customer.email,
          address: sale.customer.address,
          customerType: sale.customer.customerType,
          sales: [],
        });
      }
      customerMap.get(customerId).sales.push({
        id: sale.id,
        code: sale.code,
        soldAt: sale.soldAt,
        totalBeforeDiscount: sale.totalBeforeDiscount,
        totalDiscount: sale.totalDiscount,
        totalAfterDiscount: sale.totalAfterDiscount,
      });
    });

    const customersWithSales = Array.from(customerMap.values());
    res.json(customersWithSales);
  } catch (error) {
    console.error('getCustomersWithPendingSales error:', error);
    res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลลูกค้าได้' });
  }
};


module.exports = {
  getCombinableSales,
  createCombinedBillingDocument,
  getCombinedBillingById,
  getCustomersWithPendingSales,
};
