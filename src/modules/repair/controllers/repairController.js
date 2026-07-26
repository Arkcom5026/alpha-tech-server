const repairService = require('../services/repairService');
const repairCompletionService = require('../services/repairCompletionService');
const repairHandoverService = require('../services/repairHandoverService');
const repairDiagnosisService = require('../services/repairDiagnosisService');
const repairEstimateService = require('../services/repairEstimateService');
const repairIntakeService = require('../services/repairIntakeService');
const warrantyClaimService = require('../services/warrantyClaimService');
const customerWarrantyAssetService = require('../services/customerWarrantyAssetService');
const { resolveRepairActor } = require('../utils/repairActor');

class RepairController {
  async getIntakeContext(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await repairIntakeService.getContext(actor, req.params.lookup);
      res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  }

  async listCustomerWarrantyAssets(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await customerWarrantyAssetService.listForCustomer(actor, req.params.customerId);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  }

  async createJob(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await repairService.createRepairJob(actor, req.body);
      res.status(201).json({ success: true, message: 'เปิดใบรับซ่อมเรียบร้อยแล้ว', data });
    } catch (error) { next(error); }
  }

  async listJobs(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await repairService.listRepairJobs(actor, req.query);
      res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  }

  async getJob(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await repairService.getRepairJob(actor, req.params.id);
      res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  }

  async updateStatus(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const requestedStatus = String(req.body?.status || '').trim().toUpperCase();
      const data = requestedStatus === 'COMPLETED'
        ? await repairCompletionService.completeRepairJob(actor, req.params.id, req.body)
        : await repairService.updateJobStatus(actor, req.params.id, req.body);
      res.status(200).json({ success: true, message: 'อัปเดตสถานะงานซ่อมเรียบร้อยแล้ว', data });
    } catch (error) { next(error); }
  }

  async listDiagnoses(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await repairDiagnosisService.listForRepairJob(actor, req.params.id);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  }

  async recordDiagnosis(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await repairDiagnosisService.record(actor, req.params.id, req.body);
      res.status(201).json({ success: true, message: 'บันทึกผลตรวจงานซ่อมเรียบร้อยแล้ว', data });
    } catch (error) { next(error); }
  }

  async listEstimates(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await repairEstimateService.listForRepairJob(actor, req.params.id);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  }

  async createEstimate(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await repairEstimateService.create(actor, req.params.id, req.body);
      res.status(201).json({ success: true, message: 'สร้างใบเสนอราคางานซ่อมเรียบร้อยแล้ว', data });
    } catch (error) { next(error); }
  }

  async decideEstimate(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await repairEstimateService.decide(actor, req.params.id, req.params.estimateId, req.body);
      res.status(200).json({
        success: true,
        message: data.status === 'APPROVED' ? 'ลูกค้าอนุมัติใบเสนอราคาแล้ว' : 'ลูกค้าปฏิเสธใบเสนอราคาแล้ว',
        data,
      });
    } catch (error) { next(error); }
  }

  async handoverToCustomer(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await repairHandoverService.handoverToCustomer(actor, req.params.id, req.body);
      res.status(200).json({
        success: true,
        message: data.idempotent ? 'เครื่องถูกส่งคืนลูกค้าแล้ว' : 'ส่งคืนเครื่องให้ลูกค้าเรียบร้อยแล้ว',
        data,
      });
    } catch (error) { next(error); }
  }

  async addParts(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await repairService.addPartsToRepairJob(actor, req.params.id, req.body);
      res.status(201).json({ success: true, message: 'เบิกอะไหล่สำหรับงานซ่อมเรียบร้อยแล้ว', data });
    } catch (error) { next(error); }
  }

  async openWarrantyClaim(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await warrantyClaimService.openFromRepairJob(actor, req.params.id, req.body);
      res.status(201).json({ success: true, message: 'เปิดรายการเคลมจากใบงานซ่อมเรียบร้อยแล้ว', data });
    } catch (error) { next(error); }
  }

  async listWarrantyClaims(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await warrantyClaimService.listWarrantyClaims(actor, req.query);
      res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  }

  async getWarrantyClaim(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await warrantyClaimService.getWarrantyClaim(actor, req.params.claimId);
      res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  }

  async updateWarrantyClaimStatus(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await warrantyClaimService.updateStatus(actor, req.params.claimId, req.body);
      res.status(200).json({ success: true, message: 'อัปเดตสถานะเคลมเรียบร้อยแล้ว', data });
    } catch (error) { next(error); }
  }
}

module.exports = new RepairController();