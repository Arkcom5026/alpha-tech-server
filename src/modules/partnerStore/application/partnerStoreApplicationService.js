'use strict'

const crypto = require('crypto')
const bcrypt = require('bcryptjs')
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
  const password = requireText(payload, 'password', 'กรุณากำหนดรหัสผ่านสำหรับเจ้าของร้าน')
  const requestedStorefrontSlug = cleanSlug(payload.requestedStorefrontSlug)

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    fail(400, 'PARTNER_STORE_APPLICATION_VALIDATION_FAILED', 'รูปแบบอีเมลไม่ถูกต้อง')
  }
  if (password.length < 8) {
    fail(400, 'PARTNER_STORE_APPLICATION_VALIDATION_FAILED', 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร')
  }
  if (requestedStorefrontSlug && !/^[a-z0-9][a-z0-9-]{1,62}$/.test(requestedStorefrontSlug)) {
    fail(400, 'PARTNER_STORE_APPLICATION_VALIDATION_FAILED', 'ชื่อย่อร้านต้องเป็น a-z, 0-9 หรือขีดกลาง และยาวอย่างน้อย 2 ตัวอักษร')
  }

  const passwordHash = await bcrypt.hash(password, 10)

  return repository.withTransaction(async (tx) => {
    const existingUser = await tx.user.findUnique({ where: { email: contactEmail }, select: { id: true } })
    if (existingUser) {
      fail(409, 'PARTNER_STORE_OWNER_EMAIL_ALREADY_EXISTS', 'อีเมลนี้มีบัญชีผู้ใช้งานอยู่แล้ว กรุณาใช้อีเมลอื่นหรือติดต่อผู้ดูแลระบบ')
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

    const owner = await tx.user.create({
      data: {
        email: contactEmail,
        loginId: contactEmail,
        password: passwordHash,
        role: 'EMPLOYEE',
        loginType: 'EMAIL',
        enabled: false,
      },
      select: { id: true },
    })

    return repository.create({
      applicationCode: `PSA-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      businessName,
      contactName,
      contactPhone,
      contactEmail,
      businessAddress,
      requestedStorefrontSlug: requestedStorefrontSlug || null,
      note: text(payload.note) || null,
      provisionedOwnerUserId: owner.id,
    }, tx)
  })
}

const listApplications = (status) => {
  const value = text(status).toUpperCase()
  if (value && !['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN'].includes(value)) {
    fail(400, 'PARTNER_STORE_APPLICATION_STATUS_INVALID', 'สถานะใบสมัครไม่ถูกต้อง')
  }
  return repository.list(value || undefined)
}

const resolveReservedOwner = async (application, tx) => {
  const reservedOwnerId = Number(application.provisionedOwnerUserId)
  if (Number.isInteger(reservedOwnerId) && reservedOwnerId > 0) {
    return tx.user.findUnique({
      where: { id: reservedOwnerId },
      include: { employeeProfile: true },
    })
  }

  const recoverableOwner = await tx.user.findUnique({
    where: { email: text(application.contactEmail).toLowerCase() },
    include: { employeeProfile: true },
  })

  if (!recoverableOwner) {
    fail(409, 'PARTNER_STORE_OWNER_NOT_RESERVED', 'ใบสมัครนี้ยังไม่มีบัญชีเจ้าของร้านที่พร้อมเปิดใช้งาน กรุณาให้ผู้สมัครส่งใบสมัครใหม่')
  }
  if (recoverableOwner.enabled || recoverableOwner.employeeProfile) {
    fail(409, 'PARTNER_STORE_OWNER_RECOVERY_UNSAFE', 'พบบัญชีอีเมลเดียวกันแต่บัญชีถูกใช้งานแล้ว ไม่สามารถผูกกับใบสมัครนี้อัตโนมัติได้')
  }
  if (recoverableOwner.role !== 'EMPLOYEE') {
    fail(409, 'PARTNER_STORE_OWNER_RECOVERY_UNSAFE', 'พบบัญชีอีเมลเดียวกันแต่บทบาทบัญชีไม่ตรงกับบัญชีสำรองของเจ้าของร้าน')
  }

  await tx.partnerStoreApplication.update({
    where: { id: application.id },
    data: { provisionedOwnerUserId: recoverableOwner.id },
  })

  return recoverableOwner
}

const approveApplication = async (applicationId, actorEmployeeId, reviewNote) =>
  repository.withTransaction(async (tx) => {
    const application = await repository.findById(applicationId, tx)
    if (!application) fail(404, 'PARTNER_STORE_APPLICATION_NOT_FOUND', 'ไม่พบใบสมัครร้านพาร์ทเนอร์')
    if (application.status !== 'PENDING' && application.status !== 'UNDER_REVIEW') {
      fail(409, 'PARTNER_STORE_APPLICATION_NOT_ACTIONABLE', 'ใบสมัครนี้ไม่สามารถอนุมัติได้')
    }

    const owner = await resolveReservedOwner(application, tx)
    if (!owner) fail(409, 'PARTNER_STORE_OWNER_INVALID', 'ไม่พบบัญชีเจ้าของร้านของใบสมัครนี้')
    if (owner.enabled) fail(409, 'PARTNER_STORE_OWNER_ALREADY_ENABLED', 'บัญชีเจ้าของร้านนี้ถูกเปิดใช้งานไปแล้ว')
    if (owner.employeeProfile) fail(409, 'PARTNER_STORE_OWNER_ALREADY_ASSIGNED', 'ผู้ใช้นี้มีสังกัดร้านอยู่แล้ว')

    const slug = application.requestedStorefrontSlug || `partner-${application.id}`
    const slugOwner = await tx.branch.findUnique({ where: { slug }, select: { id: true } })
    if (slugOwner) fail(409, 'PARTNER_STORE_SLUG_ALREADY_EXISTS', 'ชื่อย่อหน้าร้านนี้ถูกใช้งานแล้ว กรุณาแก้ไขใบสมัครก่อนอนุมัติ')

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
            create: { name: 'System Partner Store', active: true, isSystem: true },
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

    await tx.user.update({
      where: { id: owner.id },
      data: { role: 'ADMIN', enabled: true },
    })

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

const rejectApplication = async (applicationId, reviewNote) => {
  const note = requireText({ reviewNote }, 'reviewNote', 'กรุณาระบุเหตุผลที่ไม่อนุมัติ')

  return repository.withTransaction(async (tx) => {
    const application = await repository.findById(applicationId, tx)
    if (!application) fail(404, 'PARTNER_STORE_APPLICATION_NOT_FOUND', 'ไม่พบใบสมัครร้านพาร์ทเนอร์')
    if (application.status !== 'PENDING' && application.status !== 'UNDER_REVIEW') {
      fail(409, 'PARTNER_STORE_APPLICATION_NOT_ACTIONABLE', 'ใบสมัครนี้ไม่สามารถปฏิเสธได้')
    }

    const ownerId = Number(application.provisionedOwnerUserId)
    if (Number.isInteger(ownerId) && ownerId > 0) {
      const owner = await tx.user.findUnique({
        where: { id: ownerId },
        include: { employeeProfile: true },
      })
      if (owner?.enabled || owner?.employeeProfile) {
        fail(409, 'PARTNER_STORE_OWNER_CLEANUP_UNSAFE', 'ไม่สามารถปฏิเสธใบสมัครได้ เนื่องจากบัญชีเจ้าของร้านถูกใช้งานแล้ว')
      }
    }

    const rejected = await tx.partnerStoreApplication.update({
      where: { id: application.id },
      data: {
        status: 'REJECTED',
        reviewNote: note,
        provisionedOwnerUserId: null,
        decidedAt: new Date(),
      },
      select: { id: true, applicationCode: true, status: true, reviewNote: true, decidedAt: true },
    })

    if (Number.isInteger(ownerId) && ownerId > 0) {
      await tx.user.delete({ where: { id: ownerId } })
    }

    return rejected
  })
}

module.exports = { createApplication, listApplications, approveApplication, rejectApplication }
