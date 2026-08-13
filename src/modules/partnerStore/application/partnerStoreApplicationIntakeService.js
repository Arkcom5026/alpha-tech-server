'use strict'

const crypto = require('crypto')
const repository = require('./partnerStoreApplicationRepository')

const text = (value) => String(value || '').trim()
const cleanSlug = (value) => text(value).toLowerCase().replace(/[^a-z0-9-]/g, '')

const fail = (statusCode, code, message) => {
  const error = new Error(message)
  error.statusCode = statusCode
  error.code = code
  throw error
}

const requireText = (payload, field, message) => {
  const value = text(payload?.[field])
  if (!value) fail(400, 'PARTNER_STORE_APPLICATION_VALIDATION_FAILED', message)
  return value
}

const submitApplication = async (payload = {}) => {
  const businessName = requireText(payload, 'businessName', 'กรุณาระบุชื่อร้าน')
  const contactName = requireText(payload, 'contactName', 'กรุณาระบุชื่อผู้ติดต่อ')
  const contactPhone = requireText(payload, 'contactPhone', 'กรุณาระบุเบอร์โทรศัพท์')
  const contactEmail = requireText(payload, 'contactEmail', 'กรุณาระบุอีเมลผู้ติดต่อ').toLowerCase()
  const businessAddress = requireText(payload, 'businessAddress', 'กรุณาระบุที่อยู่ร้าน')
  const requestedStorefrontSlug = cleanSlug(payload.requestedStorefrontSlug)

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    fail(400, 'PARTNER_STORE_APPLICATION_VALIDATION_FAILED', 'รูปแบบอีเมลไม่ถูกต้อง')
  }
  if (requestedStorefrontSlug && !/^[a-z0-9][a-z0-9-]{1,62}$/.test(requestedStorefrontSlug)) {
    fail(400, 'PARTNER_STORE_APPLICATION_VALIDATION_FAILED', 'ชื่อย่อร้านต้องเป็น a-z, 0-9 หรือขีดกลาง และยาวอย่างน้อย 2 ตัวอักษร')
  }

  return repository.withTransaction(async (tx) => {
    const activeApplication = await tx.partnerStoreApplication.findFirst({
      where: {
        contactEmail,
        status: { in: ['PENDING', 'UNDER_REVIEW', 'APPROVED'] },
      },
      select: { id: true },
    })
    if (activeApplication) {
      fail(409, 'PARTNER_STORE_APPLICATION_ALREADY_ACTIVE', 'อีเมลนี้มีใบสมัครร้านพาร์ทเนอร์ที่กำลังดำเนินการอยู่แล้ว')
    }

    if (requestedStorefrontSlug) {
      const [existingBranch, pendingApplication] = await Promise.all([
        tx.branch.findUnique({ where: { slug: requestedStorefrontSlug }, select: { id: true } }),
        tx.partnerStoreApplication.findFirst({
          where: {
            requestedStorefrontSlug,
            status: { in: ['PENDING', 'UNDER_REVIEW', 'APPROVED'] },
          },
          select: { id: true },
        }),
      ])
      if (existingBranch || pendingApplication) {
        fail(409, 'PARTNER_STORE_SLUG_ALREADY_EXISTS', 'ชื่อย่อหน้าร้านนี้ถูกใช้งานหรือมีผู้ขอใช้งานแล้ว กรุณาเลือกชื่อใหม่')
      }
    }

    const application = await repository.create({
      applicationCode: `PSA-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      businessName,
      contactName,
      contactPhone,
      contactEmail,
      businessAddress,
      requestedStorefrontSlug: requestedStorefrontSlug || null,
      note: text(payload.note) || null,
    }, tx)

    await tx.partnerStoreApplicationEvent.create({
      data: {
        applicationId: application.id,
        eventType: 'SUBMITTED',
        previousStatus: null,
        resultingStatus: 'PENDING',
        actorUserId: null,
        note: application.note || null,
      },
    })

    return application
  })
}

module.exports = { submitApplication }
