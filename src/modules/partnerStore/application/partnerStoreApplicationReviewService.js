'use strict'

const repository = require('./partnerStoreApplicationRepository')

const text = (value) => String(value || '').trim()

const fail = (statusCode, code, message) => {
  const error = new Error(message)
  error.statusCode = statusCode
  error.code = code
  throw error
}

const startReview = async (applicationId, actorUserId, note) => {
  const actorId = Number(actorUserId)
  if (!Number.isInteger(actorId) || actorId <= 0) {
    fail(403, 'PARTNER_STORE_GOVERNANCE_ACTOR_REQUIRED', 'ไม่พบผู้ดำเนินการที่ได้รับอนุญาต')
  }

  return repository.withTransaction(async (tx) => {
    const application = await repository.findById(applicationId, tx)
    if (!application) fail(404, 'PARTNER_STORE_APPLICATION_NOT_FOUND', 'ไม่พบใบสมัครร้านพาร์ทเนอร์')
    if (application.status !== 'PENDING') {
      fail(409, 'PARTNER_STORE_APPLICATION_NOT_REVIEWABLE', 'ใบสมัครนี้ไม่สามารถเริ่มพิจารณาได้')
    }

    const updated = await tx.partnerStoreApplication.update({
      where: { id: application.id },
      data: { status: 'UNDER_REVIEW' },
      select: { id: true, applicationCode: true, status: true, updatedAt: true },
    })

    await tx.partnerStoreApplicationEvent.create({
      data: {
        applicationId: application.id,
        eventType: 'REVIEW_STARTED',
        previousStatus: 'PENDING',
        resultingStatus: 'UNDER_REVIEW',
        actorUserId: actorId,
        note: text(note) || null,
      },
    })

    return updated
  })
}

module.exports = { startReview }
