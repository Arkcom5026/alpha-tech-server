'use strict';

const { prisma } = require('../../../../../lib/prisma');
const { asPositiveInt, branchIdFromToken, sendError } = require('../../shared/taxExpenseContext');

class ExpensePayeeSetupService {
  constructor(client = prisma) { this.prisma = client; }

  listCandidates(branchId, q = '') {
    return this.prisma.supplier.findMany({
      where: {
        branchId,
        active: true,
        ...(q ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { taxId: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
          ],
        } : {}),
      },
      select: {
        id: true,
        name: true,
        taxId: true,
        phone: true,
        contactPerson: true,
        capabilities: { select: { capability: true } },
      },
      orderBy: { name: 'asc' },
      take: 100,
    });
  }

  async enable(branchId, supplierId) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, branchId, active: true },
      select: { id: true, name: true, taxId: true, phone: true, contactPerson: true },
    });
    if (!supplier) {
      const error = new Error('ไม่พบ Supplier ที่ใช้งานได้สำหรับร้านนี้');
      error.statusCode = 404;
      error.code = 'TAX_EXPENSE_SUPPLIER_NOT_FOUND';
      throw error;
    }

    await this.prisma.supplierCapabilityAssignment.upsert({
      where: { supplierId_capability: { supplierId, capability: 'EXPENSE_PAYEE' } },
      create: { supplierId, capability: 'EXPENSE_PAYEE' },
      update: {},
    });

    return { ...supplier, capability: 'EXPENSE_PAYEE' };
  }
}

class ExpensePayeeSetupController {
  constructor(service = new ExpensePayeeSetupService()) {
    this.service = service;
    this.list = this.list.bind(this);
    this.enable = this.enable.bind(this);
  }

  async list(req, res) {
    try {
      const q = String(req.query?.q || '').trim();
      const data = await this.service.listCandidates(branchIdFromToken(req), q);
      return res.json({ ok: true, data });
    } catch (error) {
      return sendError(res, error, 'ไม่สามารถโหลด Supplier สำหรับตั้งค่าผู้รับเงินได้');
    }
  }

  async enable(req, res) {
    try {
      const supplierId = asPositiveInt(req.params?.supplierId);
      if (!supplierId) {
        const error = new Error('supplierId ไม่ถูกต้อง');
        error.statusCode = 400;
        error.code = 'TAX_EXPENSE_VALIDATION_ERROR';
        throw error;
      }
      const data = await this.service.enable(branchIdFromToken(req), supplierId);
      return res.json({ ok: true, data });
    } catch (error) {
      return sendError(res, error, 'ไม่สามารถกำหนดผู้รับเงินค่าใช้จ่ายได้');
    }
  }
}

const controller = new ExpensePayeeSetupController();
module.exports = controller;
module.exports.ExpensePayeeSetupService = ExpensePayeeSetupService;
module.exports.ExpensePayeeSetupController = ExpensePayeeSetupController;
