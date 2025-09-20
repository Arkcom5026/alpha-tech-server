

  // ✅ server/controllers/productController.js (Production Standard)
  // CommonJS only; all endpoints wrapped in try/catch; BRANCH_SCOPE_ENFORCED.
  
  const { prisma, Prisma } = require('../lib/prisma');
  const { v2: cloudinary } = require('cloudinary');
  
  // ---------- Helpers ----------
  const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number.parseInt(v, 10));
  const normStr = (s) => (s == null ? '' : String(s)).trim();
  // Decimal normalizers to avoid Prisma decimal parsing errors on empty strings
  const toDec = (v, fallback = 0) => (v === '' || v === null || v === undefined ? fallback : Number(v));
  const toDecUndef = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v));
  
  
  const decideMode = ({ explicitMode, noSN, trackSerialNumber }) => {
    const exp = explicitMode ? String(explicitMode).toUpperCase() : undefined;
    const n = noSN === true || noSN === 'true' || noSN === 1 || noSN === '1';
    const t = trackSerialNumber === true || trackSerialNumber === 'true' || trackSerialNumber === 1 || trackSerialNumber === '1';
  
    if (exp === 'SIMPLE') return { mode: 'SIMPLE', noSN: true, trackSerialNumber: false };
    if (exp === 'STRUCTURED') return { mode: 'STRUCTURED', noSN: false, trackSerialNumber: true };
    if (t && !n) return { mode: 'STRUCTURED', noSN: false, trackSerialNumber: true };
    if (n && !t) return { mode: 'SIMPLE', noSN: true, trackSerialNumber: false };
    if (t && n)   return { mode: 'STRUCTURED', noSN: false, trackSerialNumber: true };
    return { mode: 'SIMPLE', noSN: true, trackSerialNumber: false };
  };
  

  const resolveTemplateHierarchy = async (db, templateId) => {
    if (!Number.isFinite(Number(templateId))) return null;
    const tpl = await db.productTemplate.findUnique({
      where: { id: Number(templateId) },
      select: {
        id: true,
        productProfile: { select: { id: true, productType: { select: { id: true, categoryId: true } } } },
      },
    });
    if (!tpl) return null;
    return {
      templateId: tpl.id,
      productProfileId: tpl.productProfile?.id ?? null,
      productTypeId: tpl.productProfile?.productType?.id ?? null,
      categoryId: tpl.productProfile?.productType?.categoryId ?? null,
    };
  };
    

  const createOrRepairStockBalance = async (tx, productId, branchId) => {
    if (!tx || !productId || !branchId) return;
    let qty = 0;
    try {
      qty = await tx.stockItem.count({
        where: { productId: Number(productId), branchId: Number(branchId), status: 'IN_STOCK' },
      });
    } catch (e) {
      console.warn('createOrRepairStockBalance: count stockItem failed → default 0');
      qty = 0;
    }
    await tx.stockBalance.upsert({
      where: { productId_branchId: { productId: Number(productId), branchId: Number(branchId) } },
      update: { quantity: qty },
      create: { productId: Number(productId), branchId: Number(branchId), quantity: qty, reserved: 0 },
    });
  };
 

const getAllProducts = async (req, res) => {
  const {
    search = '',
    take = 100,
    page = 1,
    categoryId,
    productTypeId,
    productProfileId,
    productTemplateId,
    templateId, // alias
    activeOnly = 'true',
  } = req.query;

  const takeNum = Math.max(1, Math.min(toInt(take) ?? 100, 200));
  const skipNum = Math.max(0, (toInt(page) ? (toInt(page) - 1) * takeNum : 0));
  const tplId = toInt(templateId ?? productTemplateId);
  const activeFilter = (String(activeOnly).toLowerCase() === 'false') ? undefined : true;

  

  try {
    const products = await prisma.product.findMany({
      where: {
        ...(activeFilter === undefined ? {} : { active: true }),
        ...(search ? {
          OR: [
            { name: { contains: String(search), mode: 'insensitive' } },
            { description: { contains: String(search), mode: 'insensitive' } },
            { spec: { contains: String(search), mode: 'insensitive' } },
            { sku: String(search) },
            { barcode: String(search) },
          ],
        } : {}),
        ...(toInt(categoryId) ? { categoryId: toInt(categoryId) } : {}),
        ...(toInt(productTypeId) ? { productTypeId: toInt(productTypeId) } : {}),
        ...(toInt(productProfileId) ? { productProfileId: toInt(productProfileId) } : {}),
        ...(tplId ? { OR: [{ templateId: tplId }, { template: { id: tplId } }] } : {}),
      },
      select: {
        id: true,
        name: true,
        model: true,
        description: true,
        mode: true,
        spec: true,

        // ✅ scalar ids used by FE filters
        categoryId: true,
        productTypeId: true,
        productProfileId: true,
        templateId: true,

        category: { select: { id: true, name: true } },
        productType: { select: { id: true, name: true, category: { select: { id: true, name: true } } } },
        productProfile: { select: { id: true, name: true, productType: { select: { id: true, name: true, category: { select: { id: true, name: true } } } } } },
        template: {
          select: {
            id: true, name: true,
            productProfile: {
              select: {
                id: true, name: true,
                productType: { select: { id: true, name: true, category: { select: { id: true, name: true } } } },
              },
            },
          },
        },
      },
      take: takeNum,
      skip: skipNum,
      orderBy: { id: 'desc' },
    });

    const mapped = products.map((p) => {
      const catName = p.category?.name
        ?? p.productType?.category?.name
        ?? p.productProfile?.productType?.category?.name
        ?? p.template?.productProfile?.productType?.category?.name
        ?? '-';
      const typeName = p.productType?.name
        ?? p.productProfile?.productType?.name
        ?? p.template?.productProfile?.productType?.name
        ?? '-';
      const profileName = p.productProfile?.name
        ?? p.template?.productProfile?.name
        ?? '-';
      const tplName = p.template?.name ?? '-';

      return {
        id: p.id,
        name: p.name,
        model: p.model ?? null,
        description: p.description,

        // ✅ include mode for FE
        mode: p.mode,

        // ✅ ids + mode for FE filter compatibility
        categoryId: (p.categoryId ?? p.productType?.category?.id ?? null),
        productTypeId: (p.productTypeId ?? p.productProfile?.productType?.id ?? null),
        productProfileId: (p.productProfileId ?? p.template?.productProfile?.id ?? null),
        templateId: (p.templateId ?? p.template?.id ?? null),
        productTemplateId: (p.templateId ?? p.template?.id ?? null),

        category: catName,
        productType: typeName,
        productProfile: profileName,
        productTemplate: tplName,

        categoryName: catName,
        productTypeName: typeName,
        productProfileName: profileName,
        productTemplateName: tplName,

        imageUrl: null,
      };
    });

    return res.json(mapped);
  } catch (error) {
    console.error('❌ getAllProducts error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


const getProductsForPos = async (req, res) => {
  const branchId = Number(req.user?.branchId);
  if (!branchId) return res.status(401).json({ error: 'unauthorized' });

  const {
    search = '',
    take = 50,
    page = 1,
    categoryId,
    productTypeId,
    productProfileId,
    // ⬇️ scoped add: accept brand/template filters from FE (safe)
    brandId,
    templateId,
    productTemplateId,
    readyOnly = 'false',
    hasPrice = 'false',
    activeOnly = 'true',
  } = req.query;

  // Optional filter to return only SIMPLE products for Quick Receive (Simple)
  const queryMode = (req?.query?.mode || '').toString().toUpperCase();
  const simpleOnly = req?.query?.simpleOnly === '1' || queryMode === 'SIMPLE';

  const takeNum = Math.max(1, Math.min(toInt(take) ?? 50, 200));
  const skipNum = Math.max(0, (toInt(page) ? (toInt(page) - 1) * takeNum : 0));
  const activeFilter = (String(activeOnly).toLowerCase() === 'false') ? undefined : true;
  const tplId = toInt(templateId ?? productTemplateId);

  const where = {
    ...(simpleOnly ? { mode: 'SIMPLE' } : {}),
    ...(activeFilter === undefined ? {} : { active: true }),
    ...(search ? {
      OR: [
        { name: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } },
        { spec: { contains: String(search), mode: 'insensitive' } },
        { sku: String(search) },
        { barcode: String(search) },
      ],
    } : {}),
    ...(toInt(categoryId) ? { categoryId: toInt(categoryId) } : {}),
    ...(toInt(productTypeId) ? { productTypeId: toInt(productTypeId) } : {}),
    ...(toInt(productProfileId) ? { productProfileId: toInt(productProfileId) } : {}),
        ...(tplId ? { OR: [{ templateId: tplId }, { template: { id: tplId } }] } : {}),

    ...(toInt(brandId) ? { OR: [{ template: { brandId: toInt(brandId) } }, { brandId: toInt(brandId) }] } : {}),
  };

  try {
    console.log('[POS SEARCH] where:', JSON.stringify(where));

    const items = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        model: true,
        description: true,
        mode: true,
        noSN: true,
        trackSerialNumber: true,

        // ✅ scalar ids used by FE filters
        categoryId: true,
        productTypeId: true,
        productProfileId: true,
        templateId: true,

        category: { select: { id: true, name: true } },
        productType: { select: { id: true, name: true, category: { select: { id: true, name: true } } } },
        productProfile: { select: { id: true, name: true, productType: { select: { id: true, name: true, category: { select: { id: true, name: true } } } } } },

        template: {
          select: {
            id: true, name: true,
            productProfile: {
              select: {
                id: true, name: true,
                productType: {
                  select: { id: true, name: true, category: { select: { id: true, name: true } } },
                },
              },
            },
          },
        },

        branchPrice: { where: { branchId }, take: 1, select: { costPrice: true, priceRetail: true, priceOnline: true, priceWholesale: true, priceTechnician: true, isActive: true } },
        stockItems: { where: { branchId, status: 'IN_STOCK' }, select: { id: true }, take: 1 },
        stockBalances: { where: { branchId }, take: 1, select: { quantity: true, reserved: true, lastReceivedCost: true } },
      },
      take: takeNum,
      skip: skipNum,
      orderBy: { id: 'desc' },
    });

    let mapped = items.map((p) => {
      const bp = p.branchPrice?.[0];
      const sb = p.stockBalances?.[0];
      const qty = Number(sb?.quantity ?? 0);
      const reserved = Number(sb?.reserved ?? 0);
      const available = Math.max(0, qty - reserved);
      const isSimple = p.mode === 'SIMPLE' || p.noSN === true;
      const isReady = isSimple ? available > 0 : ((p.stockItems?.length ?? 0) > 0);
      const lastCost = sb?.lastReceivedCost != null ? Number(sb.lastReceivedCost)
        : (bp?.costPrice != null ? Number(bp.costPrice) : null);

      const catName = p.category?.name
        ?? p.productType?.category?.name
        ?? p.productProfile?.productType?.category?.name
        ?? p.template?.productProfile?.productType?.category?.name
        ?? '-';
      const typeName = p.productType?.name
        ?? p.productProfile?.productType?.name
        ?? p.template?.productProfile?.productType?.name
        ?? '-';
      const profileName = p.productProfile?.name
        ?? p.template?.productProfile?.name
        ?? '-';
      const tplName = p.template?.name ?? '-';

      return {
        id: p.id,
        name: p.name,
        model: p.model ?? null,
        description: p.description,

        // ✅ ids + mode for FE filter compatibility
        mode: p.mode,
        categoryId: (p.categoryId ?? p.productType?.category?.id ?? null),
        productTypeId: (p.productTypeId ?? p.productProfile?.productType?.id ?? null),
        productProfileId: (p.productProfileId ?? p.template?.productProfile?.id ?? null),
        templateId: (p.templateId ?? p.template?.id ?? null),
        productTemplateId: (p.templateId ?? p.template?.id ?? null),

        category: catName,
        productType: typeName,
        productProfile: profileName,
        productTemplate: tplName,

        categoryName: catName,
        productTypeName: typeName,
        productProfileName: profileName,
        productTemplateName: tplName,

        noSN: p.noSN,
        trackSerialNumber: p.trackSerialNumber,
        priceRetail: bp?.priceRetail ?? 0,
        priceWholesale: bp?.priceWholesale ?? 0,
        priceTechnician: bp?.priceTechnician ?? 0,
        priceOnline: bp?.priceOnline ?? 0,
        branchPriceActive: bp?.isActive ?? true,
        available,
        isReady,
        lastCost,
        costPrice: lastCost,
        hasPrice: !!bp,
      };
    });

    if (String(readyOnly).toLowerCase() === 'true') {
      mapped = mapped.filter((x) => x.isReady === true);
    }
    if (String(hasPrice).toLowerCase() === 'true') {
      mapped = mapped.filter((x) => x.hasPrice === true && x.branchPriceActive !== false);
    }

    return res.json(mapped);
  } catch (error) {
    console.error('❌ getProductsForPos error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


const getProductsForOnline = async (req, res) => {
  const branchId = Number(req.user?.branchId) || toInt(req.query.branchId);
  if (!branchId) return res.status(400).json({ error: 'BRANCH_REQUIRED' });

  const {
    search: q1 = '',
    searchText: q2 = '',
    take = 50,
    size,
    page = 1,
    categoryId,
    productTypeId,
    productProfileId,
    productTemplateId,
    templateId,
    brandId,
    activeOnly = 'true',
    readyOnly = 'false',
    hasPrice = 'false',
  } = req.query;

  const queryMode = (req?.query?.mode || '').toString().toUpperCase();
  const simpleOnly = req?.query?.simpleOnly === '1' || queryMode === 'SIMPLE';

  const search = normStr(q1 || q2);
  const takeNum = Math.max(1, Math.min((toInt(size) ?? toInt(take) ?? 50), 200));
  const skipNum = Math.max(0, (toInt(page) ? (toInt(page) - 1) * takeNum : 0));
  const activeFilter = (String(activeOnly).toLowerCase() === 'false') ? undefined : true;
  const tplId = toInt(templateId ?? productTemplateId);

  try {
    const whereAND = [];

    if (activeFilter !== undefined) whereAND.push({ active: true });
    if (simpleOnly) whereAND.push({ mode: 'SIMPLE' });

    if (search) {
      whereAND.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { spec: { contains: search, mode: 'insensitive' } },
          { sku: search },
          { barcode: search },
        ],
      });
    }

    const catId  = toInt(categoryId);
    const typeId = toInt(productTypeId);
    const profId = toInt(productProfileId);
    const tmplId = tplId;
    const brId   = toInt(brandId);

    if (catId) {
      whereAND.push({
        OR: [
          { categoryId: catId },
          { productType: { category: { id: catId } } },
          { productProfile: { productType: { category: { id: catId } } } },
          { template: { productProfile: { productType: { category: { id: catId } } } } },
        ],
      });
    }

    if (typeId) {
      whereAND.push({
        OR: [
          { productTypeId: typeId },
          { productProfile: { productType: { id: typeId } } },
          { template: { productProfile: { productType: { id: typeId } } } },
        ],
      });
    }

    if (profId) {
      whereAND.push({
        OR: [
          { productProfileId: profId },
          { template: { productProfile: { id: profId } } },
        ],
      });
    }

    if (tmplId) {
      whereAND.push({
        OR: [
          { templateId: tmplId },
          { template: { id: tmplId } },
        ],
      });
    }

    if (brId) {
      whereAND.push({
        OR: [
          { brandId: brId },
          { template: { brandId: brId } },
        ],
      });
    }

    const where = whereAND.length ? { AND: whereAND } : {};

    const items = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        mode: true,
        noSN: true,
        categoryId: true,
        productTypeId: true,
        productProfileId: true,
        templateId: true,
        category:      { select: { id: true, name: true } },
        productType:   { select: { id: true, name: true, category: { select: { id: true, name: true } } } },
        productProfile:{ select: { id: true, name: true, productType: { select: { id: true, name: true, category: { select: { id: true, name: true } } } } } },
        template: {
          select: {
            id: true, name: true,
            productProfile: {
              select: {
                id: true, name: true,
                productType: { select: { id: true, name: true, category: { select: { id: true, name: true } } } },
              },
            },
          },
        },
        productImages: { where: { isCover: true, active: true }, take: 1, select: { secure_url: true } },
        branchPrice:   { where: { branchId }, take: 1, select: { priceOnline: true, isActive: true } },
        stockItems:    { where: { branchId, status: 'IN_STOCK' }, select: { id: true }, take: 1 },
        stockBalances: { where: { branchId }, take: 1, select: { quantity: true, reserved: true } },
      },
      take: takeNum,
      skip: skipNum,
      orderBy: { id: 'desc' },
    });

    let mapped = items.map((p) => {
      const bp = p.branchPrice?.[0];
      const sb = p.stockBalances?.[0];
      const qty = Number(sb?.quantity ?? 0);
      const reserved = Number(sb?.reserved ?? 0);
      const available = Math.max(0, qty - reserved);
      const isSimple = p.mode === 'SIMPLE' || p.noSN === true;
      const isReady  = isSimple ? available > 0 : ((p.stockItems?.length ?? 0) > 0);

      return {
        id: p.id,
        name: p.name,
        description: p.description,
        mode: p.mode,
        categoryId:       (p.categoryId       ?? p.productType?.category?.id                 ?? null),
        productTypeId:    (p.productTypeId    ?? p.productProfile?.productType?.id           ?? null),
        productProfileId: (p.productProfileId ?? p.template?.productProfile?.id              ?? null),
        templateId:       (p.templateId       ?? p.template?.id                              ?? null),
        productTemplateId:(p.templateId       ?? p.template?.id                              ?? null),
        imageUrl: p.productImages?.[0]?.secure_url || null,
        priceOnline: Number(bp?.priceOnline ?? 0),
        readyPickupAtBranch: isReady,
        isReady,
        category:        p.category?.name
                        ?? p.productType?.category?.name
                        ?? p.productProfile?.productType?.category?.name
                        ?? p.template?.productProfile?.productType?.category?.name
                        ?? undefined,
        productType:     p.productType?.name
                        ?? p.productProfile?.productType?.name
                        ?? p.template?.productProfile?.productType?.name
                        ?? undefined,
        productProfile:  p.productProfile?.name
                        ?? p.template?.productProfile?.name
                        ?? undefined,
        productTemplate: p.template?.name ?? undefined,
        hasPrice: !!bp,
        branchPriceActive: bp?.isActive ?? true,
      };
    });

    if (String(readyOnly).toLowerCase() === 'true') {
      mapped = mapped.filter((x) => x.isReady === true);
    }
    if (String(hasPrice).toLowerCase() === 'true') {
      mapped = mapped.filter((x) => x.hasPrice === true && x.branchPriceActive !== false);
    }

    return res.json(mapped);
  } catch (error) {
    console.error('❌ getProductsForOnline error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


const getProductPosById = async (req, res) => {
  const branchId = Number(req.user?.branchId);
  if (!branchId) return res.status(401).json({ error: 'unauthorized' });
  const id = toInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'INVALID_ID' });
  try {
    const p = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        model: true,
        description: true,
        spec: true,
        mode: true,
        noSN: true,
        trackSerialNumber: true,

        // ✅ scalar ids used by FE filters
        categoryId: true,
        productTypeId: true,
        productProfileId: true,
        templateId: true,
        unitName: true,
        // ✅ add hierarchy ids + names for FE preselect (align with schema: templateId + template relation)
        productType: { select: { id: true, name: true, categoryId: true, category: { select: { id: true, name: true } } } },
        productProfile: { select: { id: true, name: true, productTypeId: true } },
        template: { select: { id: true, name: true, productProfileId: true, productProfile: { select: { id: true, name: true, productTypeId: true, productType: { select: { id: true, name: true, categoryId: true, category: { select: { id: true, name: true } } } } } } } },
        productImages: { where: { active: true }, orderBy: [{ isCover: 'desc' }, { id: 'asc' }], select: { id: true, url: true, secure_url: true, caption: true, isCover: true } },
        branchPrice: { where: { branchId }, take: 1, select: { costPrice: true, priceWholesale: true, priceTechnician: true, priceRetail: true, priceOnline: true, isActive: true } },
        stockBalances: { where: { branchId }, take: 1, select: { quantity: true, reserved: true, lastReceivedCost: true } },
      },
    });
    if (!p) return res.status(404).json({ error: 'NOT_FOUND' });

    const bp = p.branchPrice?.[0];
    const sb = p.stockBalances?.[0];
    const qty = Number(sb?.quantity ?? 0);
    const reserved = Number(sb?.reserved ?? 0);
    const available = Math.max(0, qty - reserved);
    const isSimple = p.mode === 'SIMPLE' || p.noSN === true;
    const isReady = isSimple ? available > 0 : false; // not eager-loading stockItems here
    const lastCost = sb?.lastReceivedCost != null ? Number(sb.lastReceivedCost) : (bp?.costPrice != null ? Number(bp.costPrice) : null);

    const branchPriceObj = {
      costPrice: Number(bp?.costPrice ?? 0),
      priceWholesale: Number(bp?.priceWholesale ?? 0),
      priceTechnician: Number(bp?.priceTechnician ?? 0),
      priceRetail: Number(bp?.priceRetail ?? 0),
      priceOnline: Number(bp?.priceOnline ?? 0),
    };

    // ✅ mode fallback ถ้า backend ไม่มีค่า จะ derive จาก noSN
    const mode = p.mode ?? (p.noSN ? 'SIMPLE' : 'STRUCTURED');

    return res.json({
      id: p.id,
      name: p.name,
      model: p.model ?? null,
      description: p.description,

        // ✅ ids + mode for FE filter compatibility
        mode: p.mode,
        categoryId: (p.categoryId ?? p.productType?.category?.id ?? null),
        productTypeId: (p.productTypeId ?? p.productProfile?.productType?.id ?? null),
        productProfileId: (p.productProfileId ?? p.template?.productProfile?.id ?? null),
        templateId: (p.templateId ?? p.template?.id ?? null),
        productTemplateId: (p.templateId ?? p.template?.id ?? null),
      spec: p.spec ?? null,
      mode, // ใช้ค่าที่ normalize แล้ว
      noSN: p.noSN,
      trackSerialNumber: p.trackSerialNumber,
      unitId: null,
      unitName: p.unitName ?? null,
      // ✅ echo back hierarchy for FE dropdown preselects
      categoryId: p.productType?.categoryId ?? p.productType?.category?.id ?? p.template?.productProfile?.productType?.categoryId ?? null,
      productTypeId: p.productType?.id ?? p.productProfile?.productTypeId ?? p.template?.productProfile?.productTypeId ?? null,
      productProfileId: p.productProfile?.id ?? p.template?.productProfileId ?? null,
      productTemplateId: p.templateId ?? p.template?.id ?? null,
      categoryName: p.productType?.category?.name ?? p.template?.productProfile?.productType?.category?.name ?? null,
      productTypeName: p.productType?.name ?? p.template?.productProfile?.productType?.name ?? null,
      productProfileName: p.productProfile?.name ?? p.template?.productProfile?.name ?? null,
      productTemplateName: p.template?.name ?? null,
      images: (p.productImages || [])
        .map(im => ({ id: im.id, url: im.secure_url || im.url, caption: im.caption ?? '', isCover: Boolean(im.isCover) }))
        .filter(im => !!im.url),
      costPrice: branchPriceObj.costPrice,
      priceWholesale: branchPriceObj.priceWholesale,
      priceTechnician: branchPriceObj.priceTechnician,
      priceRetail: branchPriceObj.priceRetail,
      priceOnline: branchPriceObj.priceOnline,
      branchPriceActive: bp?.isActive ?? true,
      available,
      isReady,
      lastCost,
      branchPrice: branchPriceObj,
    });
  } catch (error) {
    console.error('❌ getProductPosById error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


const getProductOnlineById = async (req, res) => {
  // ✅ Public endpoint: allow branchId from token or query
  const branchIdFromUser = Number(req.user?.branchId);
  const branchIdFromQuery = toInt(req.query.branchId);
  const branchId = branchIdFromUser || branchIdFromQuery;
  if (!branchId) return res.status(400).json({ error: 'BRANCH_REQUIRED' });
  const id = toInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'INVALID_ID' });
  try {
    const p = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        mode: true,
        noSN: true,
        productImages: { where: { isCover: true, active: true }, take: 1, select: { secure_url: true } },
        branchPrice: { where: { branchId, isActive: true }, take: 1, select: { priceOnline: true } },
        stockItems: { where: { branchId, status: 'IN_STOCK' }, select: { id: true }, take: 1 },
        stockBalances: { where: { branchId }, take: 1, select: { quantity: true, reserved: true } },
      },
    });
    if (!p) return res.status(404).json({ error: 'NOT_FOUND' });

    const bp = p.branchPrice?.[0];
    const sb = p.stockBalances?.[0];
    const qty = Number(sb?.quantity ?? 0);
    const reserved = Number(sb?.reserved ?? 0);
    const available = Math.max(0, qty - reserved);
    const isSimple = p.mode === 'SIMPLE' || p.noSN === true;
    const isReady = isSimple ? available > 0 : ((p.stockItems?.length ?? 0) > 0);

    return res.json({
      id: p.id,
      name: p.name,
      description: p.description,

        // ✅ ids + mode for FE filter compatibility
        mode: p.mode,
        categoryId: (p.categoryId ?? p.productType?.category?.id ?? null),
        productTypeId: (p.productTypeId ?? p.productProfile?.productType?.id ?? null),
        productProfileId: (p.productProfileId ?? p.template?.productProfile?.id ?? null),
        templateId: (p.templateId ?? p.template?.id ?? null),
        productTemplateId: (p.templateId ?? p.template?.id ?? null),
      imageUrl: p.productImages?.[0]?.secure_url || null,
      priceOnline: bp?.priceOnline ?? 0,
      readyPickupAtBranch: isReady,
    });
  } catch (error) {
    console.error('❌ getProductOnlineById error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


const getProductDropdowns = async (req, res) => {
  try {
    // หมายเหตุ: ไม่ใส่เงื่อนไข active เพื่อหลีกเลี่ยงกรณีสคีมาใช้ isActive/active แตกต่างกัน
    // และเพื่อให้แก้ไขสินค้าที่อ้างอิงหมวด/ชนิด/โปรไฟล์/เทมเพลตที่ปิดการใช้งานแล้วได้
    const [cats, types, profiles, templatesRaw] = await Promise.all([
      prisma.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      prisma.productType.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, categoryId: true } }),
      prisma.productProfile.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, productTypeId: true } }),
      prisma.productTemplate.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, productProfileId: true } }),
    ]);

    const categories = cats.map((c) => ({ id: Number(c.id), name: c.name }));
    const productTypes = types.map((t) => ({ id: Number(t.id), name: t.name, categoryId: Number(t.categoryId) }));
    const productProfiles = profiles.map((p) => ({ id: Number(p.id), name: p.name, productTypeId: Number(p.productTypeId) }));
    const productTemplates = templatesRaw.map((tp) => ({ id: Number(tp.id), name: tp.name, productProfileId: Number(tp.productProfileId) }));

    // ✅ FE dropdown for product mode
    const productModes = [
      { code: 'SIMPLE', name: 'Simple' },
      { code: 'STRUCTURED', name: 'Structure' },
    ];

    return res.json({
      categories,
      productTypes,
      productProfiles,
      productTemplates,
      productModes,
      // เพื่อความเข้ากันได้ย้อนหลัง (เผื่อ FE เดิมอ่าน key `templates`)
      templates: productTemplates,
    });
  } catch (error) {
    console.error('❌ getProductDropdowns error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
  }
};


const createProduct = async (req, res) => {
  try {
    const data = req.body;
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ error: 'unauthorized' });

    const { mode, noSN, trackSerialNumber } = decideMode({ explicitMode: data.mode, noSN: data.noSN, trackSerialNumber: data.trackSerialNumber });
    const templateIdNum = toInt(data.templateId);
    const resolved = templateIdNum ? await resolveTemplateHierarchy(prisma, templateIdNum) : null;
    if (!resolved) return res.status(400).json({ error: 'PRODUCT_TEMPLATE_REQUIRED' });

    const newProduct = await prisma.product.create({
      data: {
        name: normStr(data.name),
        description: normStr(data.description),
        spec: normStr(data.spec),
        mode,
        trackSerialNumber,
        noSN,
        active: data.active ?? true,
        templateId: resolved.templateId,
        categoryId: resolved.categoryId,
        productTypeId: resolved.productTypeId,
        productProfileId: resolved.productProfileId,
        productImages: Array.isArray(data.images) && data.images.length > 0 ? {
          create: data.images.map((img) => ({
            url: img.url,
            public_id: img.public_id,
            secure_url: img.secure_url,
            caption: img.caption || null,
            isCover: !!img.isCover,
            active: true,
          })),
        } : undefined,
      },
    });

    const bp = data.branchPrice || {};
    await prisma.branchPrice.upsert({
      where: { productId_branchId: { productId: newProduct.id, branchId } },
      update: {
        costPrice: toDecUndef(bp.costPrice),
        priceWholesale: toDecUndef(bp.priceWholesale),
        priceTechnician: toDecUndef(bp.priceTechnician),
        priceRetail: toDecUndef(bp.priceRetail),
        priceOnline: toDecUndef(bp.priceOnline),
        isActive: (typeof bp.isActive === 'boolean' ? bp.isActive : undefined),
      },
      create: {
        productId: newProduct.id,
        branchId,
        costPrice: toDec(bp.costPrice, 0),
        priceWholesale: toDec(bp.priceWholesale, 0),
        priceTechnician: toDec(bp.priceTechnician, 0),
        priceRetail: toDec(bp.priceRetail, 0),
        priceOnline: toDec(bp.priceOnline, 0),
        isActive: (typeof bp.isActive === 'boolean' ? bp.isActive : true),
      },
    });

    return res.status(201).json(newProduct);
  } catch (error) {
    console.error('❌ createProduct error:', error);
    return res.status(error.status || 500).json({ error: error.code || error.message || 'Failed to create product' });
  }
};


const updateProduct = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'INVALID_ID' });
    const data = req.body;
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ error: 'unauthorized' });

    const partialMode = decideMode({ explicitMode: data.mode, noSN: data.noSN, trackSerialNumber: data.trackSerialNumber });
    const templateIdNum = toInt(data.productTemplateId ?? data.templateId);
    const resolvedHierarchy = templateIdNum ? await resolveTemplateHierarchy(prisma, templateIdNum) : null;
    const bodyCategoryId = toInt(data.categoryId);
    const bodyProductTypeId = toInt(data.productTypeId);
    const bodyProductProfileId = data.productProfileId === null ? null : toInt(data.productProfileId);

    const result = await prisma.$transaction(async (tx) => {
      const toMode = partialMode.mode;
      const isSwitchToSimple = toMode === 'SIMPLE';
      const resolved = resolvedHierarchy || {};
      const finalCategoryId = resolved.categoryId ?? (bodyCategoryId ?? undefined);
      const finalProductTypeId = resolved.productTypeId ?? (bodyProductTypeId ?? undefined);
      const finalProductProfileId = resolved.productProfileId ?? (bodyProductProfileId === null ? null : (bodyProductProfileId ?? undefined));

      const saved = await tx.product.update({
        where: { id },
        data: {
          name: data.name != null ? normStr(data.name) : undefined,
          description: data.description != null ? normStr(data.description) : undefined,
          spec: data.spec != null ? normStr(data.spec) : undefined,
          mode: toMode,
          trackSerialNumber: partialMode.trackSerialNumber,
          noSN: partialMode.noSN,
          active: typeof data.active === 'boolean' ? data.active : undefined,
          templateId: (resolved.templateId ?? undefined),
          categoryId: finalCategoryId,
          productTypeId: finalProductTypeId,
          productProfileId: finalProductProfileId,
        },
        select: { id: true },
      });

      if (data.branchPrice) {
        const bp = data.branchPrice || {};
        await tx.branchPrice.upsert({
          where: { productId_branchId: { productId: id, branchId } },
          update: {
            costPrice: toDecUndef(bp.costPrice),
            priceWholesale: toDecUndef(bp.priceWholesale),
            priceTechnician: toDecUndef(bp.priceTechnician),
            priceRetail: toDecUndef(bp.priceRetail),
            priceOnline: toDecUndef(bp.priceOnline),
            isActive: typeof bp.isActive === 'boolean' ? bp.isActive : undefined,
          },
          create: {
            productId: id,
            branchId,
            costPrice: toDec(bp.costPrice, 0),
            priceWholesale: toDec(bp.priceWholesale, 0),
            priceTechnician: toDec(bp.priceTechnician, 0),
            priceRetail: toDec(bp.priceRetail, 0),
            priceOnline: toDec(bp.priceOnline, 0),
            isActive: typeof bp.isActive === 'boolean' ? bp.isActive : true,
          },
        });
      }

      if (isSwitchToSimple) {
        try {
          await createOrRepairStockBalance(tx, id, branchId);
        } catch (e) {
          console.warn('⚠️ createOrRepairStockBalance failed (non-fatal):', e?.message || e);
        }
      }

      return saved;
    });

    return res.json(result);
  } catch (error) {
    console.error('❌ updateProduct error:', error);
    if (error.status === 409 && (error.message === 'MODE_SWITCH_REQUIRES_CONVERSION' || error.message === 'MODE_SWITCH_REQUIRES_EMPTY_BALANCE')) {
      return res.status(409).json({ error: error.message });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return res.status(409).json({ error: 'DUPLICATE_CONSTRAINT' });
      if (error.code === 'P2025') return res.status(404).json({ error: 'NOT_FOUND' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
};


const deleteProduct = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'INVALID_ID' });
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ error: 'unauthorized' });

    // Soft-archive instead of hard delete for safety
    const result = await prisma.product.update({ where: { id }, data: { active: false } });
    return res.json({ success: true, id: result.id, archived: true });
  } catch (error) {
    console.error('❌ deleteProduct error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


const deleteProductImage = async (req, res) => {
  try {
    const productId = toInt(req.params.id);
    const { public_id } = req.body;
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ error: 'unauthorized' });
    if (!productId || !public_id) return res.status(400).json({ error: 'INVALID_PARAMS' });

    // Remove from Cloudinary first (best effort)
    try {
      await cloudinary.uploader.destroy(public_id);
    } catch (e) {
      console.warn('⚠️ cloudinary destroy failed:', e?.message || e);
    }

    await prisma.productImage.updateMany({ where: { productId, public_id }, data: { active: false, isCover: false } });

    return res.json({ success: true });
  } catch (error) {
    console.error('❌ deleteProductImage error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


const migrateSnToSimple = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'INVALID_ID' });

    // authorize presence of branch context (consistent with other endpoints)
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ error: 'unauthorized' });

    const product = await prisma.product.findUnique({ where: { id }, select: { id: true, mode: true } });
    if (!product) return res.status(404).json({ error: 'NOT_FOUND' });
    if (product.mode === 'SIMPLE') {
      return res.status(409).json({ error: 'ALREADY_SIMPLE' });
    }

    // Group SN-in-stock by branch
    const groups = await prisma.stockItem.groupBy({
      by: ['branchId'],
      where: { productId: id, status: 'IN_STOCK' },
      _count: { _all: true },
    });

    let migratedQty = 0;

    await prisma.$transaction(async (tx) => {
      for (const g of groups) {
        const qty = g._count?._all ?? 0;
        if (!qty) continue;
        migratedQty += qty;

        await tx.stockBalance.upsert({
          where: { productId_branchId: { productId: id, branchId: g.branchId } },
          update: { quantity: { increment: qty } },
          create: { productId: id, branchId: g.branchId, quantity: qty, reserved: 0 },
        });

        await tx.stockItem.updateMany({
          where: { productId: id, branchId: g.branchId, status: 'IN_STOCK' },
          data: { status: 'CONVERTED' },
        });
      }

      // Switch product mode to SIMPLE
      await tx.product.update({
        where: { id },
        data: { mode: 'SIMPLE', noSN: true, trackSerialNumber: false },
      });
    });

    return res.json({ success: true, migratedQty, branches: groups.length });
  } catch (error) {
    console.error('❌ migrateSnToSimple error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getAllProducts,
  createProduct,
  updateProduct,
  getProductPosById,
  deleteProduct,
  deleteProductImage,
  getProductDropdowns,
  getProductsForOnline,
  getProductOnlineById,  
  getProductsForPos,
  migrateSnToSimple,
};




