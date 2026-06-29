// src/modules/quickStock/services/QuickStockService.js
const { PrismaClient } = require('@prisma/client');

class QuickStockService {
  constructor(prisma) {
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * ดึงรายการสินค้า active เฉพาะสาขาปัจจุบัน
   * Product ผูก Branch ผ่าน ProductType.branchId
   */
  async getActiveProducts(branchId) {
    return await this.prisma.product.findMany({
      where: {
        active: true,
        productType: {
          branchId: parseInt(branchId)
        }
      },
      select: {
        id: true,
        name: true,
        productTypeId: true,
        brandId: true,
        unitId: true,
        mode: true,
        trackSerialNumber: true,
        noSN: true,
        brand: {
          select: {
            id: true,
            name: true,
            normalizedName: true
          }
        },
        unit: {
          select: {
            id: true,
            name: true
          }
        },
        productType: {
          select: {
            id: true,
            name: true,
            branchId: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  /**
   * ดึง ProductType เฉพาะสาขาปัจจุบัน
   */
  async getProductTypes(branchId) {
    return await this.prisma.productType.findMany({
      where: {
        active: true,
        branchId: parseInt(branchId)
      },
      orderBy: { name: 'asc' }
    });
  }

  /**
   * ดึง StockItem เฉพาะสาขาปัจจุบัน
   * ใช้สำหรับสินค้า SN / Serialized เท่านั้น
   */
  async getStockByBranch(branchId) {
    return await this.prisma.stockItem.findMany({
      where: {
        branchId: parseInt(branchId)
      },
      include: {
        product: {
          include: {
            brand: true,
            unit: true,
            productType: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Quick Stock All-in-One
   *
   * Runtime Rule:
   * - SN / STRUCTURED product:
   *   Product + BranchPrice + StockItem + StockMovement + StockBalance
   *
   * - SIMPLE product:
   *   Product + BranchPrice + SimpleLot + StockMovement + StockBalance
   *   ห้ามสร้าง StockItem เปล่าใน SIMPLE mode
   */
  async quickStockInAllInOne(data, currentBranchId, employeeId) {
    const branchId = parseInt(currentBranchId);
    const empId = employeeId ? parseInt(employeeId) : null;

    if (!branchId) {
      throw new Error('ไม่พบรหัสสาขาสำหรับทำรายการ Quick Stock');
    }

    return await this.prisma.$transaction(async (tx) => {
      /**
       * 1. Brand Runtime
       * ใช้ normalizedName กัน Brand ซ้ำ เช่น Logitech / logitech / LOGITECH
       */
      let brandId = data.brandId ? parseInt(data.brandId) : null;

      if (data.isNewBrand && data.brandName) {
        const normalizedName = data.brandName
          .toLowerCase()
          .trim()
          .replace(/\s+/g, '');

        const existingBrand = await tx.brand.findFirst({
          where: { normalizedName }
        });

        if (existingBrand) {
          brandId = existingBrand.id;
        } else {
          const newBrand = await tx.brand.create({
            data: {
              name: data.brandName.trim(),
              normalizedName,
              active: true
            }
          });

          brandId = newBrand.id;
        }
      }

      /**
       * 2. ตรวจ ProductType ว่าอยู่ใน branch ปัจจุบันจริง
       */
      const productTypeId = parseInt(data.productTypeId);

      const productType = await tx.productType.findFirst({
        where: {
          id: productTypeId,
          branchId,
          active: true
        }
      });

      if (!productType) {
        throw new Error('ProductType นี้ไม่อยู่ในสาขาปัจจุบัน หรือไม่สามารถใช้งานได้');
      }

      /**
       * 3. Product Master
       */
      const isSN = data.trackSerialNumber === true || data.trackSerialNumber === 'true';

      const product = await tx.product.create({
        data: {
          name: data.productName.trim(),
          productTypeId,
          brandId,
          unitId: data.unitId ? parseInt(data.unitId) : null,
          mode: isSN ? 'STRUCTURED' : 'SIMPLE',
          trackSerialNumber: isSN,
          noSN: !isSN,
          active: true
        }
      });

      /**
       * 4. BranchPrice
       */
      await tx.branchPrice.create({
        data: {
          productId: product.id,
          branchId,
          costPrice: 0,
          priceRetail: data.priceRetail ? parseFloat(data.priceRetail) : null,
          priceWholesale: data.priceWholesale ? parseFloat(data.priceWholesale) : null,
          priceTechnician: data.priceTechnician ? parseFloat(data.priceTechnician) : null,
          priceOnline: data.priceOnline ? parseFloat(data.priceOnline) : null,
          isActive: true
        }
      });

      let totalAddedQty = 0;
      let lastCost = 0;

      /**
       * 5A. SN / STRUCTURED Runtime
       */
      if (isSN) {
        if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
          throw new Error('กรุณาส่งข้อมูลรายการ Serial Number และราคาทุนรายชิ้น');
        }

        totalAddedQty = data.items.length;
        lastCost = data.items[0]?.costPrice ? parseFloat(data.items[0].costPrice) : 0;

        const now = new Date();

        const stockItemsData = data.items.map((item, index) => {
          const fallbackBarcode = `BAR-${product.id}-${Date.now()}-${index + 1}`;

          return {
            barcode: (item.barcode || data.productBarcode || fallbackBarcode).trim(),
            serialNumber: item.serialNumber ? item.serialNumber.trim() : null,
            costPrice: item.costPrice ? parseFloat(item.costPrice) : 0,
            productId: product.id,
            branchId,
            status: 'IN_STOCK',
            scannedByEmployeeId: empId,
            receivedAt: now,
            scannedAt: now
          };
        });

        await tx.stockItem.createMany({
          data: stockItemsData
        });

        await tx.stockMovement.createMany({
          data: stockItemsData.map((item) => ({
            productId: product.id,
            branchId,
            qty: 1,
            type: 'RECEIVE',
            note: `นำเข้าด่วน (โหมดระบุเลข SN): ${item.serialNumber || item.barcode || 'ไม่มีข้อมูลอ้างอิง'}`,
            createdAt: now
          }))
        });
      }

      /**
       * 5B. SIMPLE Runtime
       * ใช้ SimpleLot + StockMovement + StockBalance เท่านั้น
       * ไม่สร้าง StockItem รายชิ้น
       */
      if (!isSN) {
        const qty = parseInt(data.lotQuantity);

        if (!qty || qty <= 0) {
          throw new Error('กรุณาระบุจำนวนสินค้าที่ต้องการรับเข้าสต๊อกสำหรับสินค้าประเภทไม่มี SN');
        }

        totalAddedQty = qty;

        const costPerUnit = parseFloat(data.lotCostPrice || 0);
        lastCost = costPerUnit;

        const rawBarcode = (data.productBarcode || `LOT-${product.id}`).trim();

        const quickLot = await tx.simpleLot.create({
          data: {
            productId: product.id,
            branchId,
            barcode: rawBarcode,
            qtyInitial: qty,
            qtyRemaining: qty,
            unitCost: costPerUnit,
            status: 'ACTIVE',
            receivedAt: new Date()
          }
        });

        await tx.stockMovement.create({
          data: {
            productId: product.id,
            branchId,
            qty,
            type: 'RECEIVE',
            simpleLotId: quickLot.id,
            note: `นำเข้าล็อตสินค้าด่วน (SIMPLE Mode): ${rawBarcode}`
          }
        });
      }

      /**
       * 6. StockBalance
       */
      await tx.stockBalance.upsert({
        where: {
          productId_branchId: {
            productId: product.id,
            branchId
          }
        },
        update: {
          quantity: {
            increment: totalAddedQty
          },
          lastReceivedCost: lastCost
        },
        create: {
          productId: product.id,
          branchId,
          quantity: totalAddedQty,
          reserved: 0,
          lastReceivedCost: lastCost,
          avgCost: lastCost
        }
      });

      return {
        success: true,
        productId: product.id,
        productName: product.name
      };
    });
  }

  /**
   * รับสินค้าเข้า Stock Runtime จาก Product เดิม
   * ใช้กับ Recovery / Quick Receive / Manufacture โดยไม่สร้าง Product ซ้ำ
   *
   * Runtime Rule:
   * - STRUCTURED/SN  → create StockItem รายบาร์โค้ด + Movement + Balance
   * - SIMPLE         → create SimpleLot 1 lot ต่อ Queue + Movement + Balance
   *
   * หมายเหตุ:
   * Prisma enum StockMovementType ตอนนี้ยังไม่มี RECOVERY_RECEIVE / MANUFACTURE
   * จึงเก็บ type = RECEIVE และเก็บ movement source จริงไว้ใน refType/note
   */
  async quickReceiveExistingProduct(data, currentBranchId, employeeId) {
    const branchId = parseInt(currentBranchId);
    const empId = employeeId ? parseInt(employeeId) : null;
    const productId = parseInt(data?.productId);

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
      throw err;
    }

    const barcodes = normalizedItems.map((item) => item.barcode);
    const movementSource = String(data?.movementType || data?.source || 'RECOVERY_RECEIVE')
      .trim()
      .toUpperCase();

    const allowedDbMovementTypes = new Set([
      'RECEIVE',
      'SALE',
      'ADJUST',
      'TRANSFER',
      'RESERVE',
      'UNRESERVE',
      'RETURN',
      'LOSS',
    ]);

    const dbMovementType = allowedDbMovementTypes.has(movementSource)
      ? movementSource
      : 'RECEIVE';

    const unitCost = Number.isFinite(Number(data?.unitCost))
      ? Number(data.unitCost)
      : Number.isFinite(Number(data?.costPrice))
        ? Number(data.costPrice)
        : 0;

    const baseNote = String(data?.note || '').trim();
    const now = new Date();

    return await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: {
          id: productId,
          active: true,
          productType: {
            branchId,
          },
        },
        select: {
          id: true,
          name: true,
          mode: true,
          noSN: true,
          trackSerialNumber: true,
          productTypeId: true,
        },
      });

      if (!product) {
        const err = new Error('ไม่พบสินค้าในสาขาปัจจุบัน หรือสินค้าไม่ได้เปิดใช้งาน');
        err.statusCode = 404;
        err.code = 'PRODUCT_NOT_FOUND_IN_BRANCH';
        throw err;
      }

      const [existingStockItems, existingSimpleLots] = await Promise.all([
        tx.stockItem.findMany({
          where: { barcode: { in: barcodes } },
          select: { barcode: true },
        }),
        tx.simpleLot.findMany({
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
        throw err;
      }

      const isStructured =
        product.trackSerialNumber === true ||
        product.mode === 'STRUCTURED' ||
        product.noSN === false;

      let createdStockItems = 0;
      let createdSimpleLotId = null;
      const qty = normalizedItems.length;

      if (isStructured) {
        const serialNumbers = normalizedItems
          .map((item) => item.serialNumber)
          .filter((serialNumber) => serialNumber && String(serialNumber).trim())
          .map((serialNumber) => String(serialNumber).trim());

        if (serialNumbers.length) {
          const seenSerialNumbers = new Set();
          const duplicatedSerialNumbersInPayload = [];

          for (const serialNumber of serialNumbers) {
            const key = serialNumber.toLowerCase();
            if (seenSerialNumbers.has(key)) {
              duplicatedSerialNumbersInPayload.push(serialNumber);
            }
            seenSerialNumbers.add(key);
          }

          if (duplicatedSerialNumbersInPayload.length) {
            const err = new Error(
              `พบ Serial Number ซ้ำใน Queue: ${duplicatedSerialNumbersInPayload.join(', ')}`
            );
            err.statusCode = 409;
            err.code = 'DUPLICATE_SERIAL_NUMBER_IN_QUEUE';
            throw err;
          }

          const existingSerialNumbers = await tx.stockItem.findMany({
            where: {
              serialNumber: {
                in: serialNumbers,
              },
            },
            select: {
              serialNumber: true,
            },
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
            throw err;
          }
        }

        const stockItemsData = normalizedItems.map((item) => {
          const serialNumber =
            item.serialNumber && String(item.serialNumber).trim()
              ? String(item.serialNumber).trim()
              : null;

          return {
            barcode: item.barcode,
            serialNumber,
            costPrice: unitCost,
            productId: product.id,
            branchId,
            status: 'IN_STOCK',
            scannedByEmployeeId: empId,
            receivedAt: now,
            scannedAt: now,
            source: movementSource,
            remark: baseNote || `Stock intake existing product: ${movementSource}`,
          };
        });

        await tx.stockItem.createMany({ data: stockItemsData });
        createdStockItems = stockItemsData.length;
      } else {
        const lotBarcode = String(
          data?.lotBarcode || `${movementSource}-${product.id}-${Date.now()}`
        ).trim();

        const quickLot = await tx.simpleLot.create({
          data: {
            productId: product.id,
            branchId,
            barcode: lotBarcode,
            qtyInitial: qty,
            qtyRemaining: qty,
            unitCost,
            status: 'ACTIVE',
            receivedAt: now,
          },
        });

        createdSimpleLotId = quickLot.id;
      }

      const barcodePreview = barcodes.slice(0, 50).join(', ');
      const extraCount = Math.max(0, barcodes.length - 50);
      const noteParts = [
        baseNote,
        `Stock intake existing product`,
        `source=${movementSource}`,
        `barcodes=${barcodePreview}${extraCount ? ` ...(+${extraCount})` : ''}`,
      ].filter(Boolean);

      await tx.stockMovement.create({
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
      });

      await tx.stockBalance.upsert({
        where: {
          productId_branchId: {
            productId: product.id,
            branchId,
          },
        },
        update: {
          quantity: { increment: qty },
          lastReceivedCost: unitCost,
          avgCost: unitCost,
        },
        create: {
          productId: product.id,
          branchId,
          quantity: qty,
          reserved: 0,
          lastReceivedCost: unitCost,
          avgCost: unitCost,
        },
      });

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
      };
    });
  }

}

module.exports = QuickStockService;