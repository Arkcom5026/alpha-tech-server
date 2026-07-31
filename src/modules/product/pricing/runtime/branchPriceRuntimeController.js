const service = require('./branchPriceRuntimeService');
const { Prisma } = require('./branchPriceRuntimeRepository');

const getBranchId = (req) => service.toInt(req.user?.branchId);
const getEmployeeId = (req) => service.toInt(req.user?.employeeId);

const requireWriteActor = (req, res) => {
  const branchId = getBranchId(req);
  const employeeId = getEmployeeId(req);

  if (!branchId) {
    res.status(403).json({
      code: 'BRANCH_CONTEXT_REQUIRED',
      error: 'ไม่พบสาขาของพนักงานผู้ทำรายการ',
    });
    return null;
  }

  if (!employeeId) {
    res.status(403).json({
      code: 'EMPLOYEE_CONTEXT_REQUIRED',
      error: 'ไม่พบข้อมูลพนักงานผู้ทำรายการ',
    });
    return null;
  }

  return { branchId, employeeId };
};

const getActiveBranchPrice = async (req, res) => {
  try {
    const productId = service.toInt(req.params?.productId);
    const branchId = getBranchId(req);
    if (!productId || !branchId) {
      return res.status(400).json({ message: 'productId หรือ branchId ไม่ถูกต้อง' });
    }

    const price = await service.getActiveBranchPrice({ branchId, productId });
    if (!price) return res.status(404).json({ message: 'ไม่พบราคาที่ใช้งานได้' });
    return res.json(price);
  } catch (error) {
    console.error('❌ getActiveBranchPrice error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const upsertBranchPrice = async (req, res) => {
  try {
    const actor = requireWriteActor(req, res);
    if (!actor) return undefined;

    const input = req.body || {};
    const productId = service.toInt(input.productId);
    if (!productId) return res.status(400).json({ error: 'productId ไม่ถูกต้อง' });
    if (input.costPrice === undefined || input.costPrice === null || Number(input.costPrice) <= 0) {
      return res.status(400).json({ error: 'กรุณาระบุราคาทุน' });
    }

    const retailValue = input.retailPrice ?? input.priceRetail;
    if (retailValue === undefined || retailValue === null || Number(retailValue) <= 0) {
      return res.status(400).json({ error: 'กรุณาระบุราคาขายปลีก' });
    }

    if (!service.validateDateOrder(input.effectiveDate, input.expiredDate).valid) {
      return res.status(400).json({ error: 'expiredDate ต้องไม่เร็วกว่าหรือก่อน effectiveDate' });
    }

    return res.json(await service.upsertBranchPrice({ actor, input }));
  } catch (error) {
    console.error('❌ upsertBranchPrice error:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return res.status(400).json({ error: 'อ้างอิง product/branch/employee ไม่ถูกต้อง' });
    }
    return res.status(500).json({ error: 'ไม่สามารถบันทึกราคาได้' });
  }
};

const getBranchPricesByBranch = async (req, res) => {
  try {
    const branchId = getBranchId(req);
    if (!branchId) return res.status(401).json({ error: 'unauthorized' });

    const hasFilter = req.query?.searchText
      || req.query?.categoryId
      || req.query?.productTypeId
      || req.query?.templateId
      || req.query?.productTemplateId;
    if (!hasFilter) return res.json([]);

    const result = await service.getBranchPricesByBranch({ branchId, query: req.query || {} });
    if (result.error) return res.status(400).json(result.error);
    return res.json(result.items);
  } catch (error) {
    console.error('❌ getBranchPricesByBranch error:', error);
    return res.status(500).json({ error: 'ไม่สามารถโหลดรายการราคาได้' });
  }
};

const getAllProductsWithBranchPrice = async (req, res) => {
  try {
    const branchId = getBranchId(req);
    if (!branchId) return res.status(401).json({ error: 'unauthorized' });

    const { page, pageSize, ...filters } = req.query || {};
    const hasAnyFilter = filters.searchText
      || filters.q
      || filters.categoryId
      || filters.productTypeId
      || filters.templateId
      || filters.productTemplateId
      || filters.productId;
    if (!hasAnyFilter && !page && !pageSize) return res.json([]);

    const result = await service.getAllProductsWithBranchPrice({ branchId, query: req.query || {} });
    if (result.error) return res.status(400).json(result.error);
    if (result.usePaging && typeof result.total === 'number') {
      res.set('X-Total-Count', String(result.total));
    }
    if (result.wantMeta && result.usePaging) {
      return res.json({
        items: result.items,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      });
    }
    return res.json(result.items);
  } catch (error) {
    console.error('❌ getAllProductsWithBranchPrice error:', error);
    return res.status(500).json({ error: 'ไม่สามารถโหลดรายการสินค้าได้' });
  }
};

const updateMultipleBranchPrices = async (req, res) => {
  try {
    const actor = requireWriteActor(req, res);
    if (!actor) return undefined;

    const updates = Array.isArray(req.body) ? req.body : [];
    if (updates.length === 0) return res.status(400).json({ error: 'ไม่มีข้อมูลอัปเดต' });

    const updated = await service.updateMultipleBranchPrices({ actor, updates });
    return res.json({ updated });
  } catch (error) {
    console.error('❌ updateMultipleBranchPrices error:', error);
    return res.status(500).json({ error: 'อัปเดตราคาไม่สำเร็จ' });
  }
};

module.exports = {
  getActiveBranchPrice,
  upsertBranchPrice,
  getBranchPricesByBranch,
  getAllProductsWithBranchPrice,
  updateMultipleBranchPrices,
};
