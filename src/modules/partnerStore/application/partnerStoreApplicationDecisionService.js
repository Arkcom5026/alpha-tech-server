'use strict'

const repository = require('./partnerStoreApplicationRepository')

const text = (value) => String(value || '').trim()

const fail = (statusCode, code, message) => {
  const error = new Error(message)
  error.statusCode = statusCode
  error.code = code
  throw error
}

const requireActor = (actorUserId) => {
  const actorId = Number(actorUserId)
  if (!Number.isInteger(actorId) || actorId <= 0) {
    fail(403, 'PARTNER_STORE_GOVERNANCE_ACTOR_REQUIRED', 'ไม่พบผู้ดำเนินการที่ได้รับอนุญาต')
  }
  return actorId
}

const approve = async (applicationId, actorUserId, reviewNote) => {
  const actorId = requireActor(actorUserId)

  return repository.withTransaction(async (tx) => {
    const application = await repository.findById(applicationId, tx)
    if (!application) fail(404, 'PARTNER_STORE_APPLICATION_NOT_FOUND', 'ไม่พบใบสมัครร้านพาร์ทเนอร์')
    if (application.status !== 'UNDER_REVIEW') {
      fail(409, 'PARTNER_STORE_APPLICATION_NOT_APPROVABLE', 'ใบสมัครต้องอยู่ระหว่างการพิจารณาก่อนอนุมัติ')
    }

    const decidedAt = new Date()
    const note = text(reviewNote) || null
    const updated = await tx.partnerStoreApplication.update({
      where: { id: application.id },
      data: {
        status: 'APPROVED',
        reviewNote: note,
        decidedAt,
      },
      select: {
        id: true,
        applicationCode: true,
        status: true,
        reviewNote: true,
        decidedAt: true,
        provisionedBranchId: true,
        provisionedOwnerUserId: true,
      },
    })

    await tx.partnerStoreApplicationEvent.create({
      data: {
        applicationId: application.id,
        eventType: 'APPROVED',
        previousStatus: 'UNDER_REVIEW',
        resultingStatus: 'APPROVED',
        actorUserId: actorId,
        note,
      },
    })

    return updated
  })
}

const reject = async (applicationId, actorUserId, reviewNote) => {
  const actorId = requireActor(actorUserId)
  const note = text(reviewNote)
  if (!note) fail(400, 'PARTNER_STORE_REJECTION_REASON_REQUIRED', 'กรุณาระบุเหตุผลที่ไม่อนุมัติ')

  return repository.withTransaction(async (tx) => {
    const application = await repository.findById(applicationId, tx)
    if (!application) fail(404, 'PARTNER_STORE_APPLICATION_NOT_FOUND', 'ไม่พบใบสมัครร้านพาร์ทเนอร์')
    if (application.status !== 'UNDER_REVIEW') {
      fail(409, 'PARTNER_STORE_APPLICATION_NOT_REJECTABLE', 'ใบสมัครต้องอยู่ระหว่างการพิจารณาก่อนปฏิเสธ')
    }

    const decidedAt = new Date()
    const updated = await tx.partnerStoreApplication.update({
      where: { id: application.id },
      data: {
        status: 'REJECTED',
        reviewNote: note,
        decidedAt,
      },
      select: { id: true, applicationCode: true, status: true, reviewNote: true, decidedAt: true },
    })

    await tx.partnerStoreApplicationEvent.create({
      data: {
        applicationId: application.id,
        eventType: 'REJECTED',
        previousStatus: 'UNDER_REVIEW',
        resultingStatus: 'REJECTED',
        actorUserId: actorId,
        note,
      },
    })

    return updated
  })
}

module.exports = { approve, reject }
