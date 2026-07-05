// src/modules/product/quickStock/services/QuickStockService.js
// QuickStockService Runtime Trace Edition v2
// - Safe transaction
// - Trace every runtime step
// - No undefined trace variables
// - Designed for QuickStock / Recovery / Template Clone Runtime

const { PrismaClient } = require('@prisma/client');
const productTemplateEngine = require('../../services/productTemplateEngine')
const cloneProductFromTemplate =
  productTemplateEngine.cloneProductFromTemplate ||
  productTemplateEngine.default ||
  productTemplateEngine

class QuickStockService {
  constructor(prisma) {
    this.prisma = prisma || new PrismaClient();
  }

  makeTraceId(prefix = 'QS') {
    const rand = Math.random().toString(16).slice(2, 8);
    return `${prefix}-${Date.now()}-${rand}`;
  }

  trace(scope, step, data = {}) {
    if (process.env.NODE_ENV === 'production' && process.env.QS_TRACE !== '1') return;
    try {
      console.log(`[QS:${scope}] ${step}`, data);
    } catch (_e) {}
  }

  traceError(scope, step, error, data = {}) {
    try {
      console.error(`[QS:${scope}] ${step} FAILED`, {
        message: error?.message,
        code: error?.code,
        statusCode: error?.statusCode || error?.status,
        prismaCode: error?.code,
        meta: error?.meta,
        details: error?.details,
        data,
        stack: error?.stack,
      });
    } catch (_e) {
      console.error(`[QS:${scope}] ${step} FAILED`, error);
    }
  }

  async timed(scope, step, fn, data = {}) {
    const startedAt = Date.now();
    this.trace(scope, `${step}_BEGIN`, data);

    try {
      const result = await fn();
      this.trace(scope, `${step}_OK`, {
        ...data,
        elapsedMs: Date.now() - startedAt,
      });
      return result;
    } catch (error) {
      this.traceError(scope, step, error, {
        ...data,
        elapsedMs: Date.now() - startedAt,
      });
      throw error;
    }
  }

  /**
   * ดึงรายการสินค้าประเภทเปิดใช้งานปัจจุบัน (ฟังก์ชันเดิมในระบบ)
   */
  async getActiveProducts() {
    return await this.prisma.product.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        productTypeId: true,
        brandId: true,
        trackSerialNumber: true,
        brand: {
          select: {
            id: true,
            name: true,
            normalizedName: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * ดึงรายการประเภทสินค้าทั้งหมด (ฟังก์ชันเดิมในระบบ)
   */
  async getProductTypes() {
    return await this.prisma.productType.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * ดึงรายการคลังสินค้าแยกสาขา (ฟังก์ชันเดิมในระบบ)
   */
  async getStockByBranch(branchId) {
    return await this.prisma.stockItem.findMany({
      where: { branchId: parseInt(branchId) },
      include: {
        product: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Quick Stock All-in-One
   *
   * หมายเหตุ:
   * ฟังก์ชันนี้ยังคง behavior เดิมไว้ แต่ปรับ Trace ให้ไม่ใช้ตัวแปรที่ไม่มีจริง
   */
  async quickStockInAllInOne(data, currentBranchId, employeeId) {
    const traceScope = 'quickStockInAllInOne';
    const traceId = this.makeTraceId('QS-AIO');
    const startedAt = Date.now();

    const branchId = parseInt(currentBranchId);
    const empId = employeeId ? parseInt(employeeId) : null;

    this.trace(traceScope, 'START', {
      traceId,
      branchId,
      employeeId: empId,
      productName: data?.productName,
      productTypeId: data?.productTypeId,
      itemCount: Array.isArray(data?.items) ? data.items.length : 0,
    });

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        let brandId = data.brandId ? parseInt(data.brandId) : null;

        if (data.isNewBrand && data.brandName) {
          const normalizedName = data.brandName.toLowerCase().trim().replace(/\s+/g, '');

          const existingBrand = await this.timed(traceScope, 'AIO_01_FIND_BRAND', () =>
            tx.brand.findFirst({ where: { normalizedName } }),
            { traceId, normalizedName }
          );

          if (existingBrand) {
            brandId = existingBrand.id;
          } else {
            const newBrand = await this.timed(traceScope, 'AIO_02_CREATE_BRAND', () =>
              tx.brand.create({
                data: {
                  name: data.brandName.trim(),
                  normalizedName,
                  active: true,
                },
              }),
              { traceId, normalizedName }
            );
            brandId = newBrand.id;
          }
        }

        const isSN = data.trackSerialNumber === true || data.trackSerialNumber === 'true';

        const product = await this.timed(traceScope, 'AIO_03_CREATE_PRODUCT', () =>
          tx.product.create({
            data: {
              name: data.productName.trim(),
              productTypeId: parseInt(data.productTypeId),
              brandId,
              mode: isSN ? 'STRUCTURED' : 'SIMPLE',
              trackSerialNumber: isSN,
              noSN: !isSN,
              active: true,
            },
          }),
          { traceId, branchId, isSN }
        );

        await this.timed(traceScope, 'AIO_04_CREATE_BRANCH_PRICE', () =>
          tx.branchPrice.create({
            data: {
              productId: product.id,
              branchId,
              costPrice: 0,
              priceRetail: data.priceRetail ? parseInt(data.priceRetail) : null,
              priceWholesale: data.priceWholesale ? parseInt(data.priceWholesale) : null,
              priceTechnician: data.priceTechnician ? parseInt(data.priceTechnician) : null,
              priceOnline: data.priceOnline ? parseInt(data.priceOnline) : null,
              isActive: true,
            },
          }),
          { traceId, productId: product.id, branchId }
        );

        let totalAddedQty = 0;
        let lastCost = 0;

        if (isSN) {
          if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
            throw Object.assign(new Error('กรุณาส่งข้อมูลรายการคีย์สแกน Serial Number และราคาทุนรายชิ้น'), {
              statusCode: 400,
              code: 'ITEMS_REQUIRED',
            });
          }

          totalAddedQty = data.items.length;
          lastCost = data.items[0]?.costPrice ? parseFloat(data.items[0].costPrice) : 0;

          const now = new Date();
          const stockItemsData = data.items.map((item, index) => ({
            barcode: (item.barcode || data.productBarcode || `BAR-${product.id}-${Date.now()}-${index + 1}`).trim(),
            serialNumber: item.serialNumber ? item.serialNumber.trim() : null,
            costPrice: item.costPrice ? parseFloat(item.costPrice) : 0,
            productId: product.id,
            branchId,
            status: 'IN_STOCK',
            scannedByEmployeeId: empId,
            receivedAt: now,
            scannedAt: now,
          }));

          await this.timed(traceScope, 'AIO_05_CREATE_STOCK_ITEMS', () =>
            tx.stockItem.createMany({ data: stockItemsData }),
            { traceId, productId: product.id, branchId, count: stockItemsData.length }
          );

          await this.timed(traceScope, 'AIO_06_CREATE_STOCK_MOVEMENTS', () =>
            tx.stockMovement.createMany({
              data: stockItemsData.map((item) => ({
                productId: product.id,
                branchId,
                qty: 1,
                type: 'RECEIVE',
                note: `นำเข้าด่วน (โหมดระบุเลข SN): ${item.serialNumber || item.barcode || 'ไม่มี'}`,
                createdAt: now,
              })),
            }),
            { traceId, productId: product.id, branchId, count: stockItemsData.length }
          );
        } else {
          const qty = parseInt(data.lotQuantity);

          if (!qty || qty <= 0) {
            throw Object.assign(new Error('กรุณาระบุจำนวนสินค้าที่ต้องการรับเข้าสต๊อกสำหรับสินค้าประเภทไม่มี SN'), {
              statusCode: 400,
              code: 'LOT_QUANTITY_REQUIRED',
            });
          }

          totalAddedQty = qty;
          const costPerUnit = parseFloat(data.lotCostPrice || 0);
          lastCost = costPerUnit;

          const rawBarcode = (data.productBarcode || `LOT-${product.id}`).trim();
          const isolatedBarcode = `${rawBarcode}-B${branchId}`;

          const quickLot = await this.timed(traceScope, 'AIO_05_CREATE_SIMPLE_LOT', () =>
            tx.simpleLot.create({
              data: {
                productId: product.id,
                branchId,
                barcode: isolatedBarcode,
                qtyInitial: qty,
                qtyRemaining: qty,
                unitCost: costPerUnit,
                status: 'ACTIVE',
                receivedAt: new Date(),
              },
            }),
            { traceId, productId: product.id, branchId, qty, costPerUnit }
          );

          const now = new Date();
          const stockItemsData = Array.from({ length: qty }).map((_, idx) => ({
            barcode: `${isolatedBarcode}-${idx + 1}`,
            serialNumber: null,
            costPrice: costPerUnit,
            productId: product.id,
            branchId,
            status: 'IN_STOCK',
            scannedByEmployeeId: empId,
            receivedAt: now,
            scannedAt: now,
          }));

          await this.timed(traceScope, 'AIO_06_CREATE_STOCK_ITEMS_FOR_SIMPLE', () =>
            tx.stockItem.createMany({ data: stockItemsData }),
            { traceId, productId: product.id, branchId, count: stockItemsData.length }
          );

          await this.timed(traceScope, 'AIO_07_CREATE_STOCK_MOVEMENT', () =>
            tx.stockMovement.create({
              data: {
                productId: product.id,
                branchId,
                qty,
                type: 'RECEIVE',
                simpleLotId: quickLot.id,
                note: `นำเข้าล็อตสินค้าด่วน (SIMPLE Mode) รหัสอ้างอิงคลัง: ${isolatedBarcode}`,
              },
            }),
            { traceId, productId: product.id, branchId, qty, simpleLotId: quickLot.id }
          );
        }

        await this.timed(traceScope, 'AIO_08_UPSERT_STOCK_BALANCE', () =>
          tx.stockBalance.upsert({
            where: {
              productId_branchId: {
                productId: product.id,
                branchId,
              },
            },
            update: {
              quantity: { increment: totalAddedQty },
              lastReceivedCost: lastCost,
            },
            create: {
              productId: product.id,
              branchId,
              quantity: totalAddedQty,
              reserved: 0,
              lastReceivedCost: lastCost,
              avgCost: lastCost,
            },
          }),
          { traceId, productId: product.id, branchId, totalAddedQty, lastCost }
        );

        return { success: true, productId: product.id, productName: product.name };
      }, { timeout: 20000 });

      this.trace(traceScope, 'TX_COMMIT', {
        traceId,
        elapsedMs: Date.now() - startedAt,
        result,
      });

      return result;
    } catch (error) {
      this.traceError(traceScope, 'TX_ROLLBACK', error, {
        traceId,
        elapsedMs: Date.now() - startedAt,
        branchId,
      });
      throw error;
    }
  }

  /**
   * รับสินค้าเข้า Stock Runtime จาก Product เดิม / Template Product
   * Runtime Trace Edition v2:
   * - Validate barcode/serial duplicate ก่อนเปิด transaction
   * - ถ้า Product ไม่อยู่ใน Branch ปัจจุบัน จะ Auto Clone จาก T01
   * - Trace ทุกขั้นสำคัญใน Transaction
   */
  async quickReceiveExistingProduct(data, currentBranchId, employeeId) {
    const traceScope = 'quickReceiveExistingProduct';
    const traceId = this.makeTraceId('QS-EXIST');
    const startedAt = Date.now();

    const branchId = parseInt(currentBranchId);
    const empId = employeeId ? parseInt(employeeId) : null;
    const productId = parseInt(data?.productId);

    this.trace(traceScope, 'START', {
      traceId,
      currentBranchId,
      branchId,
      employeeId: empId,
      productId,
      movementType: data?.movementType || data?.source,
      itemCount: Array.isArray(data?.items)
        ? data.items.length
        : Array.isArray(data?.barcodes)
          ? data.barcodes.length
          : 0,
    });

    if (!branchId) {
      const err = new Error('ไม่พบรหัสสาขาสำหรับทำรายการรับสินค้า');
      err.statusCode = 401;
      err.code = 'BRANCH_ID_MISSING';
      throw err;
    }

    if (!productId) {
      const err = new Error('ไม่พบรหัสสินค้า');
      err.statusCode = 400;
      err.code = 'PRODUCT_ID_MISSING';
      throw err;
    }

    const rawItems = Array.isArray(data?.barcodes)
      ? data.barcodes
      : Array.isArray(data?.items)
        ? data.items
        : [];

    const normalizedItems = rawItems
      .map((item) => {
        if (typeof item === 'string') {
          return { barcode: item.trim(), serialNumber: null };
        }

        const barcode = String(item?.barcode || item?.code || '').trim();
        const serialNumber = item?.serialNumber || item?.sn || null;

        return {
          barcode,
          serialNumber: serialNumber ? String(serialNumber).trim() : null,
        };
      })
      .filter((item) => item.barcode);

    this.trace(traceScope, 'STEP_00_NORMALIZE_ITEMS', {
      traceId,
      rawItemCount: rawItems.length,
      normalizedItemCount: normalizedItems.length,
      barcodes: normalizedItems.map((item) => item.barcode),
    });

    if (!normalizedItems.length) {
      const err = new Error('ยังไม่มีรายการบาร์โค้ดสำหรับรับเข้า');
      err.statusCode = 400;
      err.code = 'BARCODE_QUEUE_EMPTY';
      throw err;
    }

    const seen = new Set();
    const duplicatedInPayload = [];

    for (const item of normalizedItems) {
      const key = item.barcode.toLowerCase();
      if (seen.has(key)) duplicatedInPayload.push(item.barcode);
      seen.add(key);
    }

    if (duplicatedInPayload.length) {
      const err = new Error(`พบ Barcode ซ้ำใน Queue: ${duplicatedInPayload.join(', ')}`);
      err.statusCode = 409;
      err.code = 'DUPLICATE_BARCODE_IN_QUEUE';
      err.details = { duplicatedBarcodes: duplicatedInPayload };
      throw err;
    }

    const barcodes = normalizedItems.map((item) => item.barcode);

    // Runtime Intake v2:
    // UI no longer sends movementType. Quick Receive always records RECEIVE internally.
    const movementSource = 'MANUAL';
    const dbMovementType = 'RECEIVE';

    // Runtime Session Price is the single source of truth.
    // Queue items no longer carry costPrice.
    const unitCost = Number.isFinite(Number(data?.costPrice))
      ? Number(data.costPrice)
      : 0;

    // Runtime Pricing Source of Truth
    // ราคาที่มากับ Quick Receive form ต้องถูกใช้สร้าง/อัปเดต BranchPrice ของร้าน
    // โดยไม่ดึงราคาเดิมจาก Template Product มาใช้แทน
    const runtimePricePayload = {
      costPrice: Number.isFinite(Number(data?.costPrice)) ? Number(data.costPrice) : unitCost,
      priceRetail: Number.isFinite(Number(data?.priceRetail)) ? Number(data.priceRetail) : null,
      priceWholesale: Number.isFinite(Number(data?.priceWholesale)) ? Number(data.priceWholesale) : null,
      priceTechnician: Number.isFinite(Number(data?.priceTechnician)) ? Number(data.priceTechnician) : null,
      priceOnline: Number.isFinite(Number(data?.priceOnline)) ? Number(data.priceOnline) : null,
    };

    if (!Number.isFinite(runtimePricePayload.costPrice) || runtimePricePayload.costPrice <= 0) {
      const err = new Error('ข้อมูลไม่สมบูรณ์: จำเป็นต้องกำหนดราคาทุน');
      err.statusCode = 400;
      err.code = 'COST_PRICE_REQUIRED';
      throw err;
    }

    if (!Number.isFinite(runtimePricePayload.priceRetail) || runtimePricePayload.priceRetail <= 0) {
      const err = new Error('ข้อมูลไม่สมบูรณ์: จำเป็นต้องกำหนดราคาขายปลีก');
      err.statusCode = 400;
      err.code = 'PRICE_RETAIL_REQUIRED';
      throw err;
    }


    const baseNote = String(data?.note || '').trim();
    const now = new Date();

    try {
      await this.timed(traceScope, 'STEP_01_PRE_VALIDATE_BARCODES', async () => {
        const [existingStockItems, existingSimpleLots] = await Promise.all([
          this.prisma.stockItem.findMany({
            where: { barcode: { in: barcodes } },
            select: { barcode: true },
          }),
          this.prisma.simpleLot.findMany({
            where: { barcode: { in: barcodes } },
            select: { barcode: true },
          }),
        ]);

        const existingBarcodeSet = new Set([
          ...existingStockItems.map((row) => String(row.barcode).toLowerCase()),
          ...existingSimpleLots.map((row) => String(row.barcode).toLowerCase()),
        ]);

        if (existingBarcodeSet.size) {
          const duplicated = barcodes.filter((code) => existingBarcodeSet.has(code.toLowerCase()));
          const err = new Error(`Barcode นี้มีอยู่ในระบบแล้ว: ${duplicated.join(', ')}`);
          err.statusCode = 409;
          err.code = 'BARCODE_ALREADY_EXISTS';
          err.details = { duplicatedBarcodes: duplicated };
          throw err;
        }

        return true;
      }, { traceId, barcodes });

      const serialNumbers = normalizedItems
        .map((item) => item.serialNumber)
        .filter((serialNumber) => serialNumber && String(serialNumber).trim())
        .map((serialNumber) => String(serialNumber).trim());

      if (serialNumbers.length) {
        await this.timed(traceScope, 'STEP_02_PRE_VALIDATE_SERIALS', async () => {
          const seenSerialNumbers = new Set();
          const duplicatedSerialNumbersInPayload = [];

          for (const serialNumber of serialNumbers) {
            const key = serialNumber.toLowerCase();
            if (seenSerialNumbers.has(key)) duplicatedSerialNumbersInPayload.push(serialNumber);
            seenSerialNumbers.add(key);
          }

          if (duplicatedSerialNumbersInPayload.length) {
            const err = new Error(
              `พบ Serial Number ซ้ำใน Queue: ${duplicatedSerialNumbersInPayload.join(', ')}`
            );
            err.statusCode = 409;
            err.code = 'DUPLICATE_SERIAL_NUMBER_IN_QUEUE';
            err.details = { duplicatedSerialNumbers: duplicatedSerialNumbersInPayload };
            throw err;
          }

          const existingSerialNumbers = await this.prisma.stockItem.findMany({
            where: { serialNumber: { in: serialNumbers } },
            select: { serialNumber: true },
          });

          if (existingSerialNumbers.length) {
            const duplicatedSerialNumbers = existingSerialNumbers
              .map((row) => row.serialNumber)
              .filter(Boolean);

            const err = new Error(
              `Serial Number นี้มีอยู่ในระบบแล้ว: ${duplicatedSerialNumbers.join(', ')}`
            );
            err.statusCode = 409;
            err.code = 'SERIAL_NUMBER_ALREADY_EXISTS';
            err.details = { duplicatedSerialNumbers };
            throw err;
          }

          return true;
        }, { traceId, serialNumbers });
      }

      this.trace(traceScope, 'TX_BEGIN', {
        traceId,
        branchId,
        productId,
        qty: normalizedItems.length,
        movementSource,
        dbMovementType,
        unitCost: runtimePricePayload.costPrice,
      });

      const result = await this.prisma.$transaction(async (tx) => {
        let operationalProductId = productId;

        let product = await this.timed(traceScope, 'STEP_03_FIND_OPERATIONAL_PRODUCT', () =>
          tx.product.findFirst({
            where: {
              id: operationalProductId,
              active: true,
              productType: { branchId },
            },
            select: {
              id: true,
              name: true,
              mode: true,
              noSN: true,
              trackSerialNumber: true,
              productTypeId: true,
              templateProductId: true,
            },
          }),
          { traceId, operationalProductId, branchId }
        );

        if (!product) {
          const cloneResult = await this.timed(traceScope, 'STEP_04_CLONE_TEMPLATE_PRODUCT', () =>
            cloneProductFromTemplate({
              templateProductId: productId,
              targetBranchId: branchId,
              updatedBy: empId,
              tx,
            }),
            { traceId, templateProductId: productId, targetBranchId: branchId }
          );

          operationalProductId = cloneResult.productId;

          product = await this.timed(traceScope, 'STEP_05_FIND_CLONED_PRODUCT', () =>
            tx.product.findFirst({
              where: {
                id: operationalProductId,
                active: true,
                productType: { branchId },
              },
              select: {
                id: true,
                name: true,
                mode: true,
                noSN: true,
                trackSerialNumber: true,
                productTypeId: true,
                templateProductId: true,
              },
            }),
            { traceId, operationalProductId, branchId }
          );
        }

        if (!product) {
          const err = new Error('ไม่พบสินค้าในสาขาปัจจุบัน และไม่สามารถ Clone จาก Template ได้');
          err.statusCode = 404;
          err.code = 'PRODUCT_NOT_FOUND_OR_TEMPLATE_CLONE_FAILED';
          throw err;
        }

        // Runtime Pricing Default / Override
        // เมื่อสินค้าเป็น Operational Product แล้ว ไม่ว่าจะมาจากการ Clone ใหม่หรือมีอยู่แล้ว
        // ให้ใช้ราคาจาก Runtime Form เป็น Source of Truth ของ BranchPrice
        const branchPriceUpdateData = {
          costPrice: runtimePricePayload.costPrice,
          isActive: true,
        };

        if (runtimePricePayload.priceRetail != null) {
          branchPriceUpdateData.priceRetail = runtimePricePayload.priceRetail;
        }
        if (runtimePricePayload.priceWholesale != null) {
          branchPriceUpdateData.priceWholesale = runtimePricePayload.priceWholesale;
        }
        if (runtimePricePayload.priceTechnician != null) {
          branchPriceUpdateData.priceTechnician = runtimePricePayload.priceTechnician;
        }
        if (runtimePricePayload.priceOnline != null) {
          branchPriceUpdateData.priceOnline = runtimePricePayload.priceOnline;
        }

        await this.timed(traceScope, 'STEP_06_UPSERT_BRANCH_PRICE', async () => {
          const existingBranchPrice = await tx.branchPrice.findFirst({
            where: {
              productId: product.id,
              branchId,
            },
            select: { id: true },
          });

          if (existingBranchPrice) {
            await tx.branchPrice.update({
              where: { id: existingBranchPrice.id },
              data: branchPriceUpdateData,
            });
            return { action: 'updated', branchPriceId: existingBranchPrice.id };
          }

          const createdBranchPrice = await tx.branchPrice.create({
            data: {
              productId: product.id,
              branchId,
              ...branchPriceUpdateData,
            },
            select: { id: true },
          });

          return { action: 'created', branchPriceId: createdBranchPrice.id };
        }, {
          traceId,
          productId: product.id,
          branchId,
          runtimePricePayload,
        });

        const isStructured =
          product.trackSerialNumber === true ||
          product.mode === 'STRUCTURED' ||
          product.noSN === false;

        let createdStockItems = 0;
        let createdSimpleLotId = null;
        const qty = normalizedItems.length;

        this.trace(traceScope, 'STEP_06_PRODUCT_RUNTIME_MODE', {
          traceId,
          productId: product.id,
          branchId,
          isStructured,
          mode: product.mode,
          noSN: product.noSN,
          trackSerialNumber: product.trackSerialNumber,
          qty,
        });

        if (isStructured) {
          const stockItemsData = normalizedItems.map((item) => ({
            barcode: item.barcode,
            serialNumber:
              item.serialNumber && String(item.serialNumber).trim()
                ? String(item.serialNumber).trim()
                : null,
            costPrice: runtimePricePayload.costPrice,
            productId: product.id,
            branchId,
            status: 'IN_STOCK',
            scannedByEmployeeId: empId,
            receivedAt: now,
            scannedAt: now,
            source: movementSource,
            remark: baseNote || `Stock intake existing product: ${movementSource}`,
          }));

          await this.timed(traceScope, 'STEP_07_CREATE_STOCK_ITEMS', () =>
            tx.stockItem.createMany({ data: stockItemsData }),
            { traceId, productId: product.id, branchId, count: stockItemsData.length }
          );

          createdStockItems = stockItemsData.length;
        } else {
          const lotBarcode = String(
            data?.lotBarcode || `${movementSource}-${product.id}-${Date.now()}`
          ).trim();

          const quickLot = await this.timed(traceScope, 'STEP_07_CREATE_SIMPLE_LOT', () =>
            tx.simpleLot.create({
              data: {
                productId: product.id,
                branchId,
                barcode: lotBarcode,
                qtyInitial: qty,
                qtyRemaining: qty,
                unitCost: runtimePricePayload.costPrice,
                status: 'ACTIVE',
                receivedAt: now,
              },
            }),
            { traceId, productId: product.id, branchId, qty, unitCost: runtimePricePayload.costPrice, lotBarcode }
          );

          createdSimpleLotId = quickLot.id;
        }

        const barcodePreview = barcodes.slice(0, 50).join(', ');
        const extraCount = Math.max(0, barcodes.length - 50);
        const noteParts = [
          baseNote,
          'Stock intake existing product',
          `source=${movementSource}`,
          `barcodes=${barcodePreview}${extraCount ? ` ...(+${extraCount})` : ''}`,
        ].filter(Boolean);

        await this.timed(traceScope, 'STEP_08_CREATE_STOCK_MOVEMENT', () =>
          tx.stockMovement.create({
            data: {
              productId: product.id,
              branchId,
              qty,
              type: dbMovementType,
              refType: movementSource,
              refId: null,
              simpleLotId: createdSimpleLotId,
              note: noteParts.join(' | '),
              createdAt: now,
            },
          }),
          {
            traceId,
            productId: product.id,
            branchId,
            qty,
            dbMovementType,
            movementSource,
            createdSimpleLotId,
          }
        );

        await this.timed(traceScope, 'STEP_09_UPSERT_STOCK_BALANCE', () =>
          tx.stockBalance.upsert({
            where: {
              productId_branchId: {
                productId: product.id,
                branchId,
              },
            },
            update: {
              quantity: { increment: qty },
              lastReceivedCost: runtimePricePayload.costPrice,
              avgCost: runtimePricePayload.costPrice,
            },
            create: {
              productId: product.id,
              branchId,
              quantity: qty,
              reserved: 0,
              lastReceivedCost: runtimePricePayload.costPrice,
              avgCost: runtimePricePayload.costPrice,
            },
          }),
          { traceId, productId: product.id, branchId, qty, unitCost: runtimePricePayload.costPrice }
        );

        return {
          success: true,
          productId: product.id,
          productName: product.name,
          mode: isStructured ? 'STRUCTURED' : 'SIMPLE',
          movementType: movementSource,
          dbMovementType,
          qty,
          createdStockItems,
          createdSimpleLotId,
          traceId,
        };
      }, { timeout: 20000 });

      this.trace(traceScope, 'TX_COMMIT', {
        traceId,
        elapsedMs: Date.now() - startedAt,
        result,
      });

      return result;
    } catch (error) {
      this.traceError(traceScope, 'TX_ROLLBACK_OR_PREVALIDATION_FAIL', error, {
        traceId,
        elapsedMs: Date.now() - startedAt,
        branchId,
        productId,
        barcodes,
      });

      if (error?.statusCode || error?.status) throw error;

      const wrapped = new Error(error?.message || 'รับสินค้าเข้าไม่สำเร็จ');
      wrapped.statusCode = 500;
      wrapped.code = error?.code || 'QUICK_STOCK_EXISTING_FAILED';
      wrapped.cause = error;
      throw wrapped;
    }
  }
}

module.exports = QuickStockService;
