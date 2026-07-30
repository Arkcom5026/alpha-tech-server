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

const createApplication = async (payload = {}) => {
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

  return repository.create({
    applicationCode: `PSA-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    businessName,
    contactName,
    contactPhone,
    contactEmail,
    businessAddress,
    requestedStorefrontSlug: requestedStorefrontSlug || null,
    note: text(payload.note) || null,
  })
}

const listApplications = (status) => {
  const value = text(status).toUpperCase()
  if (value && !['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN'].includes(value)) {
    fail(400, 'PARTNER_STORE_APPLICATION_STATUS_INVALID', 'สถานะใบสมัครไม่ถูกต้อง')
  }
  return repository.list(value || undefined)
}

const approveApplication = async (applicationId, ownerUserId, actorEmployeeId, reviewNote) => {
  const ownerId = Number(ownerUserId)
  if (!Number.isInteger(ownerId) || ownerId <= 0) {
    fail(400, 'PARTNER_STORE_OWNER_REQUIRED', 'กรุณาระบุผู้ใช้เจ้าของร้าน')
  }

  return repository.withTransaction(async (tx) => {
    const application = await repository.findById(applicationId, tx)
    if (!application) fail(404, 'PARTNER_STORE_APPLICATION_NOT_FOUND', 'ไม่พบใบสมัครร้านพาร์ทเนอร์')
    if (application.status !== 'PENDING' && application.status !== 'UNDER_REVIEW') {
      fail(409, 'PARTNER_STORE_APPLICATION_NOT_ACTIONABLE', 'ใบสมัครนี้ไม่สามารถอนุมัติได้')
    }

    const owner = await tx.user.findUnique({
      where: { id: ownerId },
      include: { employeeProfile: true },
    })
    if (!owner || !owner.enabled) fail(409, 'PARTNER_STORE_OWNER_INVALID', 'ผู้ใช้เจ้าของร้านไม่พร้อมใช้งาน')
    if (owner.employeeProfile) fail(409, 'PARTNER_STORE_OWNER_ALREADY_ASSIGNED', 'ผู้ใช้นี้มีสังกัดร้านอยู่แล้ว')

    const slug = application.requestedStorefrontSlug || `partner-${application.id}`
    const branch = await tx.branch.create({
      data: {
        name: application.businessName,
        address: application.businessAddress,
        phone: application.contactPhone,
        slug,
        businessType: 'GENERAL',
        category: {
          connectOrCreate: {
            where: { name: 'System Partner Store' },
            create: {
              name: 'System Partner Store',
              active: true,
              isSystem: true,
            },
          },
        },
      },
    })

    await tx.employeeProfile.create({
      data: {
        userId: owner.id,
        branchId: branch.id,
        name: application.contactName,
        phone: application.contactPhone,
        approved: true,
        active: true,
        v2Role: 'OWNER',
      },
    })

    await tx.user.update({ where: { id: owner.id }, data: { role: 'ADMIN' } })
    await tx.partnerStoreCapability.create({
      data: {
        branchId: branch.id,
        displayName: application.businessName,
        contactPhone: application.contactPhone,
        storefrontEnabled: false,
        pickupEnabled: true,
        deliveryEnabled: false,
        serviceAreaMode: 'PICKUP_ONLY',
      },
    })

    return tx.partnerStoreApplication.update({
      where: { id: application.id },
      data: {
        status: 'APPROVED',
        reviewNote: text(reviewNote) || null,
        provisionedBranchId: branch.id,
        provisionedOwnerUserId: owner.id,
        decidedAt: new Date(),
      },
      select: {
        id: true,
        applicationCode: true,
        status: true,
        provisionedBranchId: true,
        provisionedOwnerUserId: true,
        decidedAt: true,
      },
    })
  })
}

const rejectApplication = async (applicationId, reviewNote) => {
  const note = requireText({ reviewNote }, 'reviewNote', 'กรุณาระบุเหตุผลที่ไม่อนุมัติ')
  const application = await repository.findById(applicationId)
  if (!application) fail(404, 'PARTNER_STORE_APPLICATION_NOT_FOUND', 'ไม่พบใบสมัครร้านพาร์ทเนอร์')
  if (application.status !== 'PENDING' && application.status !== 'UNDER_REVIEW') {
    fail(409, 'PARTNER_STORE_APPLICATION_NOT_ACTIONABLE', 'ใบสมัครนี้ไม่สามารถปฏิเสธได้')
  }
  return require('../../../../lib/prisma').prisma.partnerStoreApplication.update({
    where: { id: application.id },
    data: { status: 'REJECTED', reviewNote: note, decidedAt: new Date() },
    select: { id: true, applicationCode: true, status: true, reviewNote: true, decidedAt: true },
  })
}

module.exports = { createApplication, listApplications, approveApplication, rejectApplication }
