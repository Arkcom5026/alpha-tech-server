const { Readable } = require('stream');
const repository = require('./intakeEvidenceRepository');
const { RepairError, RepairFailureCode } = require('../contracts/repairError');
const { parseConsent, mapEvidence } = require('./intakeEvidencePolicy');

function uploadPhoto(file, folder) {
  const { cloudinary } = require('../../../../utils/cloudinary');
  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        return resolve({
          url: result.secure_url || result.url,
          storageKey: result.public_id,
        });
      }
    );
    Readable.from(file.buffer).pipe(upload);
  });
}

class IntakeEvidenceService {
  constructor(repo = repository) {
    this.repository = repo;
  }

  async get(actor, repairJobId) {
    const intake = await this.repository.findIntake(actor.branchId, repairJobId);
    if (!intake) {
      throw new RepairError(
        RepairFailureCode.REPAIR_JOB_NOT_FOUND,
        'ไม่พบข้อมูลรับเครื่องของใบงานนี้',
        404
      );
    }
    return mapEvidence(intake);
  }

  async save(actor, repairJobId, body, files = []) {
    const intake = await this.repository.findIntake(actor.branchId, repairJobId);
    if (!intake) {
      throw new RepairError(
        RepairFailureCode.REPAIR_JOB_NOT_FOUND,
        'ไม่พบข้อมูลรับเครื่องของใบงานนี้',
        404
      );
    }

    const consent = parseConsent(body);
    if (!consent.confirmed && !files.length) {
      throw new RepairError(
        RepairFailureCode.INVALID_INPUT,
        'กรุณาเพิ่มภาพหลักฐานหรือยืนยันการรับเครื่อง',
        400
      );
    }

    const uploaded = [];
    try {
      for (let index = 0; index < files.length; index += 1) {
        const stored = await uploadPhoto(
          files[index],
          `repair-intakes/${actor.branchId}/${intake.referenceNo}`
        );
        uploaded.push({
          ...stored,
          category: String(body[`photoCategory${index}`] || 'INTAKE_CONDITION'),
          caption: String(body[`photoCaption${index}`] || '').trim() || null,
          takenAt: new Date(),
        });
      }

      await this.repository.transaction(async (repo) => {
        if (consent.confirmed) {
          await repo.upsertConsent(intake.id, consent.data);
        }
        await repo.createPhotos(intake.id, actor.employeeId, uploaded);
        if (uploaded.length) {
          await repo.createAudit({
            deviceIntakeId: intake.id,
            eventType: 'PHOTO_ADDED',
            performedByEmployeeId: actor.employeeId,
            note: 'เพิ่มภาพหลักฐานการรับเครื่อง',
            metadata: { photoCount: uploaded.length },
          });
        }
        if (consent.confirmed) {
          await repo.createAudit({
            deviceIntakeId: intake.id,
            eventType: 'CONSENT_SIGNED',
            performedByEmployeeId: actor.employeeId,
            note: 'ลูกค้ายืนยันการรับเครื่องแบบดิจิทัล',
            metadata: { digitallyConfirmed: true },
          });
        }
      });
    } catch (error) {
      const { cloudinary } = require('../../../../utils/cloudinary');
      await Promise.allSettled(
        uploaded
          .filter((item) => item.storageKey)
          .map((item) => cloudinary.uploader.destroy(item.storageKey))
      );
      throw error;
    }

    return this.get(actor, repairJobId);
  }
}

module.exports = new IntakeEvidenceService();
module.exports.IntakeEvidenceService = IntakeEvidenceService;
