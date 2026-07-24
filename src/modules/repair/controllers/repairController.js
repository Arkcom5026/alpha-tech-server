const repairService = require('../services/repairService');
const repairIntakeService = require('../services/repairIntakeService');
const warrantyClaimService = require('../services/warrantyClaimService');
const { resolveRepairActor } = require('../utils/repairActor');

class RepairController {
  async getIntakeContext(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await repairIntakeService.getContext(
        actor,
        req.params.lookup
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createJob(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await repairService.createRepairJob(actor, req.body);
      res.status(201).json({
        success: true,
        message: 'เปิดใบรับซ่อมเรียบร้อยแล้ว',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async listJobs(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await repairService.listRepairJobs(actor, req.query);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getJob(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await repairService.getRepairJob(actor, req.params.id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await repairService.updateJobStatus(
        actor,
        req.params.id,
        req.body
      );
      res.status(200).json({
        success: true,
        message: 'อัปเดตสถานะงานซ่อมเรียบร้อยแล้ว',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async addParts(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await repairService.addPartsToRepairJob(
        actor,
        req.params.id,
        req.body
      );
      res.status(201).json({
        success: true,
        message: 'เบิกอะไหล่สำหรับงานซ่อมเรียบร้อยแล้ว',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async openWarrantyClaim(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await warrantyClaimService.openFromRepairJob(
        actor,
        req.params.id,
        req.body
      );
      res.status(201).json({
        success: true,
        message: 'เปิดรายการเคลมจากใบงานซ่อมเรียบร้อยแล้ว',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async listWarrantyClaims(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await warrantyClaimService.listWarrantyClaims(
        actor,
        req.query
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getWarrantyClaim(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await warrantyClaimService.getWarrantyClaim(
        actor,
        req.params.claimId
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updateWarrantyClaimStatus(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await warrantyClaimService.updateStatus(
        actor,
        req.params.claimId,
        req.body
      );
      res.status(200).json({
        success: true,
        message: 'อัปเดตสถานะเคลมเรียบร้อยแล้ว',
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RepairController();
