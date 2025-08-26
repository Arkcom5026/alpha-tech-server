// controllers/combinedBillingController.js — Prisma singleton, Decimal-safe, BRANCH_SCOPE_ENFORCED
const { prisma, Prisma } = require('../lib/prisma');
const dayjs = require('dayjs');

// Helpers
const D = (v) => (v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v ?? 0));
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));

// ✅ ฟังก์ชันสร้างเลข Combined Billing Document อัตโนมัติ (รหัสสาขา + YYMM แบบ พ.ศ.)
// ทำใน transaction เพื่อความอะตอมมิก
const generateCombinedBillingCode = async (tx, branchId) => {
  const paddedBranch = String(branchId).padStart(2, '0');
  const now = dayjs();
  const yearMonth = (now.year() + 543).toString().slice(-2) + now.format('MM'); // YYMM แบบ พ.ศ.
  const prefix = `CBL-${paddedBranch}${yearMonth}`;

  const count = await tx.combinedBillingDocument.count({
    where: { branchId, code: { startsWith: prefix } },
  });
  const running = String(count + 1).padStart(4, '0');
  return `${prefix}-${running}`;
};

// ✅ สร้าง Combined Billing Document ใหม่ และอัปเดตสถานะ Sale เป็น FINALIZED (อะตอมมิก)
const createCombinedBillingDocument = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    const employeeId = toInt(req.user?.employeeId || req.user?.id);
    const saleIds = Array.isArray(req.body?.saleIds) ? req.body.saleIds.map((x) => Number(x)).filter(Number.isFinite) : [];
    const note = (req.body?.note || '').toString();

    if (!branchId || !employeeId) {
      return res.status(401).json({ error: 'Unauthorized: missing branch/employee context' });
    }
    if (saleIds.length === 0) {
      return res.status(400).json({ error: 'กรุณาเลือกรายการขายอย่างน้อย 1 รายการ' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1) ดึงรายการขายภายใต้สาขาปัจจุบัน และอยู่ในสถานะที่รวมบิลได้
      const sales = await tx.sale.findMany({
        where: {
          id: { in: saleIds },
          branchId,
          status: 'DELIVERED',
          combinedBillingId: null,
          customerId: { not: null },
        },
        include: { customer: true },
        orderBy: { soldAt: 'asc' },
      });

      if (sales.length === 0) throw new Error('ไม่พบรายการขายที่เลือกหรือไม่สามารถรวมบิลได้');

      // 2) ตรวจว่าลูกค้าคนเดียวกันทั้งหมด
      const customerId = sales[0].customerId;
      const allSameCustomer = sales.every((s) => s.customerId === customerId);
      if (!allSameCustomer) throw new Error('ใบส่งของต้องเป็นลูกค้ารายเดียวกัน');

      // 3) ตรวจว่ามีใบขายที่ไม่ได้เข้าเงื่อนไขไหม เพื่อรายงานกลับ
      const eligibleIds = new Set(sales.map((s) => s.id));
      const invalidIds = saleIds.filter((id) => !eligibleIds.has(id));
      if (invalidIds.length > 0) {
        throw new Error(`มีใบขายบางรายการไม่สามารถรวมได้: ${invalidIds.join(', ')}`);
      }

      // 4) คำนวณยอดแบบ Decimal-safe
      const totalBeforeVatDec = sales.reduce((sum, s) => sum.plus(D(s.totalBeforeDiscount)), new Prisma.Decimal(0));
      const vatAmountDec = sales.reduce((sum, s) => sum.plus(D(s.vat)), new Prisma.Decimal(0));
      const totalAmountDec = sales.reduce((sum, s) => sum.plus(D(s.totalAmount)), new Prisma.Decimal(0));

      // 5) สร้างเลขที่เอกสาร + บันทึกเอกสาร + ผูกใบขาย
      const code = await generateCombinedBillingCode(tx, branchId);

      const document = await tx.combinedBillingDocument.create({
        data: {
          code,
          note,
          createdBy: employeeId,
          customerId,
          branchId,
          totalBeforeVat: totalBeforeVatDec,
          vatAmount: vatAmountDec,
          totalAmount: totalAmountDec,
          sales: { connect: sales.map((s) => ({ id: s.id })) },
        },
      });

      // 6) อัปเดตสถานะใบขาย → FINALIZED และอ้างอิงเอกสารรวม
      await tx.sale.updateMany({
        where: { id: { in: sales.map((s) => s.id) } },
        data: { status: 'FINALIZED' },
      });

      return document;
    }, { timeout: 30000 });

    return res.status(201).json(result);
  } catch (error) {
    console.error('❌ [createCombinedBillingDocument] error:', error);
    return res.status(500).json({ error: error?.message || 'ไม่สามารถสร้างเอกสารรวมได้' });
  }
};

// ✅ ดึงรายการ Sale ที่รวมบิลได้ (status = DELIVERED, ยังไม่ถูกผูกเอกสาร)
const getCombinableSales = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    if (!branchId) return res.status(401).json({ error: 'unauthorized' });

    const sales = await prisma.sale.findMany({
      where: {
        branchId,
        status: 'DELIVERED',
        combinedBillingId: null,
        customerId: { not: null },
      },
      include: { customer: true },
      orderBy: { soldAt: 'desc' },
    });
    return res.json(sales);
  } catch (error) {
    console.error('❌ [getCombinableSales] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลได้' });
  }
};

// ✅ ดึง CombinedBillingDocument รายตัว (บังคับ branch scope)
const getCombinedBillingById = async (req, res) => {
  try {
    const id = toInt(req.params?.id);
    const branchId = toInt(req.user?.branchId);
    if (!id || !branchId) return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });

    const document = await prisma.combinedBillingDocument.findFirst({
      where: { id, branchId },
      include: {
        customer: true,
        employee: true,
        sales: true,
      },
    });

    if (!document) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    return res.json(document);
  } catch (error) {
    console.error('❌ [getCombinedBillingById] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถโหลดเอกสารได้' });
  }
};

// ✅ ดึงลูกค้าที่มีใบส่งของค้างรวมบิล (status = DELIVERED, ยังไม่ถูกผูกเอกสาร)
const getCustomersWithPendingSales = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    const keyword = (req.query?.keyword || '').toString().trim();
    if (!branchId) return res.status(401).json({ error: 'unauthorized' });

    const sales = await prisma.sale.findMany({
      where: {
        branchId,
        status: 'DELIVERED',
        combinedBillingId: null,
        customerId: { not: null },
        customer: keyword
          ? {
              OR: [
                { name: { contains: keyword, mode: 'insensitive' } },
                { phone: { contains: keyword, mode: 'insensitive' } },
                { companyName: { contains: keyword, mode: 'insensitive' } },
              ],
            }
          : undefined,
      },
      include: { customer: true },
      orderBy: { soldAt: 'asc' },
    });

    const customerMap = new Map();

    for (const sale of sales) {
      const cId = sale.customerId;
      if (!customerMap.has(cId)) {
        customerMap.set(cId, {
          id: sale.customer.id,
          name: sale.customer.name,
          phone: sale.customer.phone,
          email: sale.customer.email,
          address: sale.customer.address,
          customerType: sale.customer.customerType,
          companyName: sale.customer.companyName,
          sales: [],
        });
      }
      customerMap.get(cId).sales.push({
        id: sale.id,
        code: sale.code,
        soldAt: sale.soldAt,
        totalBeforeDiscount: sale.totalBeforeDiscount,
        totalDiscount: sale.totalDiscount,
        totalAfterDiscount: sale.totalAfterDiscount,
      });
    }

    return res.json(Array.from(customerMap.values()));
  } catch (error) {
    console.error('❌ [getCustomersWithPendingSales] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลลูกค้าได้' });
  }
};

module.exports = {
  getCombinableSales,
  createCombinedBillingDocument,
  getCombinedBillingById,
  getCustomersWithPendingSales,
};