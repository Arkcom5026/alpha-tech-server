// ✅ controllers/stockController.js
// Dashboard เป็น subset ของ Stock (manual-load per block)
// Endpoints:
//   GET /api/stock/dashboard/overview
//   GET /api/stock/dashboard/audit-in-progress
//   GET /api/stock/dashboard/risk

// ✅ ตามมาตรฐาน: import prisma จาก lib/prisma เท่านั้น (รองรับทั้ง export แบบ module.exports = prisma และ module.exports = { prisma })
const prismaModule = require('../lib/prisma');
const prisma = prismaModule?.prisma || prismaModule;

const getBranchIdFromReq = (req) => {
  // ✅ สำคัญ: branch scope enforced
  // ปรับตามโปรเจกต์จริงของคุณ:
  // - บางโปรเจกต์ใช้ req.user.branchId
  // - บางโปรเจกต์ใช้ req.branchId
  return req?.user?.branchId || req?.branchId || null;
};

const sendError = (res, err, fallbackMsg) => {
  console.error('❌ stockController error:', err);
  const msg =
    err?.message ||
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    fallbackMsg ||
    'เกิดข้อผิดพลาด';
  return res.status(500).json({ ok: false, error: msg });
};

// -----------------------------
// Helpers
// -----------------------------
const sumStatuses = (statusCountMap, statuses) =>
  (statuses || []).reduce((sum, s) => sum + Number(statusCountMap?.[s] || 0), 0);

const buildStatusCountMap = (groupByRows) =>
  (groupByRows || []).reduce((acc, row) => {
    const k = row?.status;
    if (!k) return acc;
    acc[k] = Number(row?._count?._all || 0);
    return acc;
  }, {});

// -----------------------------
// GET /api/stock/dashboard/overview
// -----------------------------
exports.getStockDashboardOverview = async (req, res) => {
  try {
    const branchIdRaw = getBranchIdFromReq(req);
    const branchId = Number(branchIdRaw);
    if (!branchIdRaw || Number.isNaN(branchId)) {
      return res.status(400).json({ ok: false, error: 'ไม่พบ branchId' });
    }

    // ✅ ภาพรวมงานสต๊อก (manual-load per block)
    // เป้าหมาย: API เดียวให้ "ภาพรวมสต๊อก" ครบที่สุด โดยยึดข้อมูลจริงใน DB
    // - STRUCTURED (มี SN): StockItem
    // - SIMPLE (ไม่มี SN): StockBalance (คงเหลือระดับสาขา)
    // - LOT (SimpleLot): คงเหลือในล็อต

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfNextDay = new Date(startOfDay);
    startOfNextDay.setDate(startOfNextDay.getDate() + 1);

    // -----------------------------
    // 1) STRUCTURED (StockItem)
    // -----------------------------
    const structuredByStatusPromise = (async () => {
      try {
        if (!prisma?.stockItem?.groupBy) return [];
        return prisma.stockItem.groupBy({
          by: ['status'],
          where: { branchId },
          _count: { _all: true },
        });
      } catch (e) {
        console.warn('⚠️ stockDashboard structuredByStatus skipped:', e?.message || e);
        return [];
      }
    })();

    // ✅ SOLD วันนี้: ใช้ soldAt เป็นหลัก
    // แต่เพื่อกันเคสข้อมูลเก่าไม่มี soldAt (หรือไม่ set) ให้ fallback ใช้ updatedAt ของสถานะ SOLD
    const soldTodayPromise = (async () => {
      try {
        if (!prisma?.stockItem?.count) return 0;

        // primary: soldAt
        const bySoldAt = await prisma.stockItem.count({
          where: {
            branchId,
            status: 'SOLD',
            soldAt: { gte: startOfDay, lt: startOfNextDay },
          },
        });
        if (bySoldAt > 0) return bySoldAt;

        // fallback: updatedAt
        return prisma.stockItem.count({
          where: {
            branchId,
            status: 'SOLD',
            updatedAt: { gte: startOfDay, lt: startOfNextDay },
          },
        });
      } catch (e) {
        console.warn('⚠️ stockDashboard soldToday skipped:', e?.message || e);
        return 0;
      }
    })();

    // -----------------------------
    // 2) SIMPLE (StockBalance)
    // -----------------------------
    // หมายเหตุ: ถ้าโปรเจกต์/สคีมายังไม่มีโมเดลนี้ จะคืน null อย่างปลอดภัย
    const simpleSummaryPromise = (async () => {
      try {
        if (!prisma?.stockBalance?.aggregate) return null;

        // sum(quantity) + sum(reserved)
        const agg = await prisma.stockBalance.aggregate({
          where: { branchId },
          _sum: { quantity: true, reserved: true },
          _count: { _all: true },
        });

        const qtyOnHand = Number(agg?._sum?.quantity || 0);
        const qtyReserved = Number(agg?._sum?.reserved || 0);
        return {
          productCount: agg?._count?._all || 0,
          qtyOnHand,
          qtyReserved,
          netAvailable: qtyOnHand - qtyReserved,
        };
      } catch (e) {
        // อย่าให้ dashboard ล่มเพราะ SIMPLE summary
        console.warn('⚠️ stockDashboard simpleSummary skipped:', e?.message || e);
        return null;
      }
    })();

    // -----------------------------
    // 3) LOT (SimpleLot)
    // -----------------------------
    const lotSummaryPromise = (async () => {
      try {
        if (!prisma?.simpleLot?.aggregate) return null;

        // นับล็อตที่ยัง ACTIVE และรวม qtyRemaining
        const agg = await prisma.simpleLot.aggregate({
          where: {
            branchId,
            status: 'ACTIVE',
          },
          _count: { _all: true },
          _sum: { qtyRemaining: true },
        });

        return {
          activeLotCount: agg?._count?._all || 0,
          qtyRemaining: Number(agg?._sum?.qtyRemaining || 0),
        };
      } catch (e) {
        // อย่าให้ dashboard ล่มเพราะ LOT summary
        console.warn('⚠️ stockDashboard lotSummary skipped:', e?.message || e);
        return null;
      }
    })();

    const [structuredByStatus, soldToday, simpleSummary, lotSummary] = await Promise.all([
      structuredByStatusPromise,
      soldTodayPromise,
      simpleSummaryPromise,
      lotSummaryPromise,
    ]);

    const statusCountMap = buildStatusCountMap(structuredByStatus);

    // ✅ Total structured items (all statuses) — useful for future KPIs / sanity checks
    const totalStructured = Object.values(statusCountMap).reduce(
      (sum, n) => sum + Number(n || 0),
      0
    );

    // ✅ IMPORTANT: สถานะอาจมีชื่อแตกต่างกันตามช่วงเวลาพัฒนา/การ migrate
    // เราจึงสรุปแบบ “tolerant mapping” เพื่อไม่ให้ dashboard แสดง 0 ผิด ๆ
    // ✅ Prisma enum ตาม schema จริง: StockStatus = IN_STOCK | SOLD | RETURNED | DAMAGED | LOST | CLAIMED | USED | MISSING_PENDING_REVIEW
    // ดังนั้น dashboard ต้องยึดค่าเหล่านี้เท่านั้น (ไม่ใช้ READY/AVAILABLE/RESERVED ฯลฯ)
    const inStock = sumStatuses(statusCountMap, ['IN_STOCK']);
    const claimed = sumStatuses(statusCountMap, ['CLAIMED']);
    const missingPendingReview = sumStatuses(statusCountMap, ['MISSING_PENDING_REVIEW']);

    const structured = {
      total: totalStructured,
      inStock,
      claimed,
      missingPendingReview,
      soldToday: Number(soldToday || 0),
      // เผื่อใช้ต่อในอนาคต: map สถานะทั้งหมด
      statusCounts: statusCountMap,
    };

    return res.json({
      ok: true,
      data: {
        // ✅ Legacy shape (backward compatible)
        // FE บางหน้าจะอ่าน data.inStock/data.claimed/... โดยตรง
        inStock: structured.inStock,
        claimed: structured.claimed,
        soldToday: structured.soldToday,
        missingPendingReview: structured.missingPendingReview,

        // ✅ New shape (richer)
        structured,
        simple: simpleSummary,
        lot: lotSummary,
        asOf: now.toISOString(),

        // debug footprint (ปลอดภัย ไม่มี PII)
        branchId,
      },
    });
  } catch (err) {
    return sendError(res, err, 'ไม่สามารถโหลดข้อมูลภาพรวมงานสต๊อกได้');
  }
};

// -----------------------------
// GET /api/stock/dashboard/audit-in-progress
// -----------------------------
exports.getStockDashboardAuditInProgress = async (req, res) => {
  try {
    const branchIdRaw = getBranchIdFromReq(req);
    const branchId = Number(branchIdRaw);
    if (!branchIdRaw || Number.isNaN(branchId)) {
      return res.status(400).json({ ok: false, error: 'ไม่พบ branchId' });
    }

    if (!prisma?.stockAuditSession?.findFirst) {
      return res.json({ ok: true, data: null });
    }

    // ✅ รอบตรวจนับที่กำลังทำอยู่ (ให้ FE ไปต่อได้ทันที)
    // นิยาม: สถานะ DRAFT / IN_PROGRESS เท่านั้น
    const session = await prisma.stockAuditSession.findFirst({
      where: {
        branchId,
        status: { in: ['DRAFT', 'IN_PROGRESS'] },
      },
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        mode: true,
        status: true,
        expectedCount: true,
        scannedCount: true,
        startedAt: true,
        confirmedAt: true,
        cancelledAt: true,
        note: true,
        employee: { select: { id: true, name: true, phone: true } },
      },
    });

    return res.json({ ok: true, data: session || null });
  } catch (err) {
    return sendError(res, err, 'ไม่สามารถโหลดข้อมูลการตรวจนับได้');
  }
};

// -----------------------------
// GET /api/stock/dashboard/risk
// -----------------------------
exports.getStockDashboardRisk = async (req, res) => {
  try {
    const branchIdRaw = getBranchIdFromReq(req);
    const branchId = Number(branchIdRaw);
    if (!branchIdRaw || Number.isNaN(branchId)) {
      return res.status(400).json({ ok: false, error: 'ไม่พบ branchId' });
    }

    if (!prisma?.stockItem?.groupBy) {
      return res.json({
        ok: true,
        data: {
          lost: 0,
          damaged: 0,
          used: 0,
          returned: 0,
          asOf: new Date().toISOString(),
        },
      });
    }

    // ✅ Risk statuses ที่เราจะนับ: LOST / DAMAGED / USED / RETURNED
    const riskStatuses = ['LOST', 'DAMAGED', 'USED', 'RETURNED'];

    const byStatus = await prisma.stockItem.groupBy({
      by: ['status'],
      where: {
        branchId,
        status: { in: riskStatuses },
      },
      _count: { _all: true },
    });

    const map = buildStatusCountMap(byStatus);

    return res.json({
      ok: true,
      data: {
        lost: map.LOST || 0,
        damaged: map.DAMAGED || 0,
        used: map.USED || 0,
        returned: map.RETURNED || 0,
        asOf: new Date().toISOString(),
      },
    });
  } catch (err) {
    return sendError(res, err, 'ไม่สามารถโหลดข้อมูลความเสี่ยงสต๊อกได้');
  }
};
