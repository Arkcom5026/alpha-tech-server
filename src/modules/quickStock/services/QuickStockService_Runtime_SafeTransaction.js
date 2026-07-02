// src/modules/quickStock/services/QuickStockService.js
const { PrismaClient } = require('@prisma/client');
const { cloneProductFromTemplate } = require('../../product/services/productTemplateEngine');

class QuickStockService {
  constructor(prisma) {
    this.prisma = prisma || new PrismaClient();
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
            normalizedName: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  /**
   * ดึงรายการประเภทสินค้าทั้งหมด (ฟังก์ชันเดิมในระบบ)
   */
  async getProductTypes() {
    return await this.prisma.productType.findMany({
      where: { active: true },
      orderBy: { name: 'asc' }
    });
  }

  /**
   * ดึงรายการคลังสินค้าแยกสาขา (ฟังก์ชันเดิมในระบบ)
   */
  async getStockByBranch(branchId) {
    return await this.prisma.stockItem.findMany({
      where: { branchId: parseInt(branchId) },
      include: {
        product: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * 🟢 [เวอร์ชันสมบูรณ์] ฟังก์ชันด่วนแบบ All-in-One คุมเข้มระบบ Multi-Branch แยกขาด 100%
   * เพิ่มแบรนด์ + เพิ่มสินค้าแม่ + ผูกราคาขายสาขา + บันทึกเม็ดสต๊อก + อัปเดตยอดคงเหลือสาขา + ลง Log การเดินสต๊อก
   */
  async quickStockInAllInOne(data, currentBranchId, employeeId) {
    const branchId = parseInt(currentBranchId);
    const empId = employeeId ? parseInt(employeeId) : null;

    return await this.prisma.$transaction(async (tx) => {
      
      // 1. ตรวจสอบและจัดการข้อมูลแบรนด์สินค้า (Brand)
      let brandId = data.brandId ? parseInt(data.brandId) : null;
      if (data.isNewBrand && data.brandName) {
        const newBrand = await tx.brand.create({
          data: {
            name: data.brandName.trim(),
            normalizedName: data.brandName.toLowerCase().trim().replace(/\s+/g, ''),
            active: true
          }
        });
        brandId = newBrand.id;
      }

      // 2. สร้างข้อมูลสินค้าแม่ (Product Master) และผูกตามโหมดจริงใน Schema (SIMPLE / STRUCTURED)
      const isSN = data.trackSerialNumber === true || data.trackSerialNumber === 'true';
      const product = await tx.product.create({
        data: {
          name: data.productName.trim(),
          productTypeId: parseInt(data.productTypeId),
          brandId: brandId,
          mode: isSN ? 'STRUCTURED' : 'SIMPLE', 
          trackSerialNumber: isSN,
          noSN: !isSN,
          active: true
        }
      });

      // 3. ผูกราคาขายรายสาขาที่ตาราง BranchPrice (ราคาทุนกลางเป็น 0.00 เนื่องจากทุนจริงจะกระจายตัวฝั่งเม็ดสต๊อก)
      await tx.branchPrice.create({
        data: {
          productId: product.id,
          branchId: branchId,
          costPrice: 0.00, 
          priceRetail: data.priceRetail ? parseInt(data.priceRetail) : null,
          priceWholesale: data.priceWholesale ? parseInt(data.priceWholesale) : null,
          priceTechnician: data.priceTechnician ? parseInt(data.priceTechnician) : null,
          priceOnline: data.priceOnline ? parseInt(data.priceOnline) : null,
          isActive: true
        }
      });

      let totalAddedQty = 0;
      let lastCost = 0;

      // 4. บันทึกข้อมูลเม็ดสต๊อกแยกเงื่อนไขตามประเภทของสินค้า (มี SN / ไม่มี SN)
      if (isSN) {
        if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
          throw new Error('กรุณาส่งข้อมูลรายการคีย์สแกน Serial Number และราคาทุนรายชิ้น');
        }

        totalAddedQty = data.items.length;
        lastCost = data.items[0]?.costPrice ? parseFloat(data.items[0].costPrice) : 0;

        const stockItemsData = data.items.map(item => ({
          barcode: (item.barcode || data.productBarcode || `BAR-${product.id}-${Date.now()}`).trim(),
          serialNumber: item.serialNumber ? item.serialNumber.trim() : null,
          costPrice: item.costPrice ? parseFloat(item.costPrice) : 0, 
          productId: product.id,
          branchId: branchId,
          status: 'IN_STOCK',
          scannedByEmployeeId: empId,
          receivedAt: new Date(),
          scannedAt: new Date()
        }));

        // บันทึกเม็ดสินค้าทีละชิ้นลงสต๊อกจริง
        await tx.stockItem.createMany({ data: stockItemsData });

        // บันทึกประวัติการรับสินค้ารายตัวลง Log ขาเดินสินค้าประจำสาขา (StockMovement)
        await tx.stockMovement.createMany({
          data: stockItemsData.map(item => ({
            productId: product.id,
            branchId: branchId,
            qty: 1.00,
            type: 'RECEIVE',
            note: `นำเข้าด่วน (โหมดระบุเลข SN): ${item.serialNumber || 'ไม่มี'}`,
            createdAt: new Date()
          }))
        });

      } else {
        // 🔸 กรณีสินค้าไม่มี SN (SIMPLE Mode)
        const qty = parseInt(data.lotQuantity);
        if (!qty || qty <= 0) {
          throw new Error('กรุณาระบุจำนวนสินค้าที่ต้องการรับเข้าสต๊อกสำหรับสินค้าประเภทไม่มี SN');
        }

        totalAddedQty = qty;
        const costPerUnit = parseFloat(data.lotCostPrice || 0);
        lastCost = costPerUnit;

        // แก้ปัญหาบาร์โค้ดชนกันข้ามร้าน โดยการแนบรหัสสาขา (Suffix Branch ID) ต่อท้ายบาร์โค้ดหลัก
        const rawBarcode = (data.productBarcode || `LOT-${product.id}`).trim();
        const isolatedBarcode = `${rawBarcode}-B${branchId}`;

        // บันทึกกลุ่มล็อตด่วนตามฟิลด์ใหม่ใน Schema (qtyInitial, qtyRemaining, status)
        const quickLot = await tx.simpleLot.create({
          data: {
            productId: product.id,
            branchId: branchId,
            barcode: isolatedBarcode,
            qtyInitial: qty,
            qtyRemaining: qty,
            unitCost: costPerUnit,
            status: 'ACTIVE',
            receivedAt: new Date()
          }
        });

        // กระจายเม็ด StockItem เข้าชั้นวางตามจำนวน
        const stockItemsData = Array.from({ length: qty }).map((_, idx) => ({
          barcode: `${isolatedBarcode}-${idx + 1}`,
          serialNumber: null,
          costPrice: costPerUnit,
          productId: product.id,
          branchId: branchId,
          status: 'IN_STOCK',
          scannedByEmployeeId: empId,
          receivedAt: new Date(),
          scannedAt: new Date()
        }));

        await tx.stockItem.createMany({ data: stockItemsData });

        // บันทึกประวัติภาพรวมของล็อตลง Log (StockMovement)
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            branchId: branchId,
            qty: qty,
            type: 'RECEIVE',
            simpleLotId: quickLot.id,
            note: `นำเข้าล็อตสินค้าด่วน (SIMPLE Mode) รหัสอ้างอิงคลัง: ${isolatedBarcode}`
          }
        });
      }

      // 5. 🛡️ อัปเดตยอดคงเหลือสะสมรายสาขา (StockBalance) เพื่อให้ระบบขาย POS หน้าร้านมองเห็นจำนวนสินค้าทันที
      await tx.stockBalance.upsert({
        where: {
          productId_branchId: {
            productId: product.id,
            branchId: branchId
          }
        },
        update: {
          quantity: { increment: totalAddedQty },
          lastReceivedCost: lastCost
        },
        create: {
          productId: product.id,
          branchId: branchId,
          quantity: totalAddedQty,
          reserved: 0,
          lastReceivedCost: lastCost,
          avgCost: lastCost
        }
      });

      return { success: true, productId: product.id, productName: product.name };
    });
  }

  /**
   * รับสินค้าเข้า Stock Runtime จาก Product เดิม / Template Product
   * Safe Transaction Edition:
   * - Validate barcode/serial duplicate ก่อนเปิด transaction
   * - ถ้า Product ไม่อยู่ใน Branch ปัจจุบัน จะ Auto Clone จาก T01
   * - ลดปัญหา Postgres 25P02 current transaction is aborted
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
          return { barcode: item.trim(), serialNumber: null, costPrice: null };
        }

        const barcode = String(item?.barcode || item?.code || '').trim();
        const serialNumber = item?.serialNumber || item?.sn || null;
        const costPrice = Number.isFinite(Number(item?.costPrice))
          ? Number(item.costPrice)
          : Number.isFinite(Number(item?.unitCost))
            ? Number(item.unitCost)
            : null;

        return {
          barcode,
          serialNumber: serialNumber ? String(serialNumber).trim() : null,
          costPrice,
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
      err.details = { duplicatedBarcodes: duplicatedInPayload };
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
        : Number.isFinite(Number(normalizedItems[0]?.costPrice))
          ? Number(normalizedItems[0].costPrice)
          : 0;

    const baseNote = String(data?.note || '').trim();
    const now = new Date();

    // ==================================================
    // PRE-VALIDATION OUTSIDE TRANSACTION
    // ==================================================
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

    const serialNumbers = normalizedItems
      .map((item) => item.serialNumber)
      .filter((serialNumber) => serialNumber && String(serialNumber).trim())
      .map((serialNumber) => String(serialNumber).trim());

    if (serialNumbers.length) {
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
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        let operationalProductId = productId;

        let product = await tx.product.findFirst({
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
        });

        if (!product) {
          const cloneResult = await cloneProductFromTemplate({
            templateProductId: productId,
            targetBranchId: branchId,
            updatedBy: empId,
            tx,
          });

          operationalProductId = cloneResult.productId;

          product = await tx.product.findFirst({
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
          });
        }

        if (!product) {
          const err = new Error('ไม่พบสินค้าในสาขาปัจจุบัน และไม่สามารถ Clone จาก Template ได้');
          err.statusCode = 404;
          err.code = 'PRODUCT_NOT_FOUND_OR_TEMPLATE_CLONE_FAILED';
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
          const stockItemsData = normalizedItems.map((item) => ({
            barcode: item.barcode,
            serialNumber:
              item.serialNumber && String(item.serialNumber).trim()
                ? String(item.serialNumber).trim()
                : null,
            costPrice: Number.isFinite(Number(item.costPrice)) ? Number(item.costPrice) : unitCost,
            productId: product.id,
            branchId,
            status: 'IN_STOCK',
            scannedByEmployeeId: empId,
            receivedAt: now,
            scannedAt: now,
            source: movementSource,
            remark: baseNote || `Stock intake existing product: ${movementSource}`,
          }));

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
          'Stock intake existing product',
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
      }, { timeout: 20000 });
    } catch (error) {
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