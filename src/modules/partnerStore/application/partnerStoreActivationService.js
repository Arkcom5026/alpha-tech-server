'use strict'

const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const repository = require('./partnerStoreApplicationRepository')

const INVITATION_TTL_MS = 24 * 60 * 60 * 1000

const fail = (statusCode, code, message) => {
  const error = new Error(message)
  error.statusCode = statusCode
  error.code = code
  throw error
}

const positiveId = (value, statusCode, code, message) => {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) fail(statusCode, code, message)
  return id
}

const hashToken = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex')

const assertUsableInvitation = (invitation) => {
  if (!invitation || invitation.consumedAt || invitation.revokedAt) {
    fail(409, 'PARTNER_STORE_ACTIVATION_TOKEN_INVALID', 'ลิงก์เปิดใช้งานไม่ถูกต้อง ถูกยกเลิก หรือถูกใช้แล้ว')
  }
  if (invitation.expiresAt <= new Date()) fail(409, 'PARTNER_STORE_ACTIVATION_TOKEN_EXPIRED', 'ลิงก์เปิดใช้งานหมดอายุแล้ว')
}

const findIdentityConflict = (tx, email) => tx.user.findFirst({
  where: { OR: [{ email }, { loginId: email }] },
  select: { id: true },
})

const issueInvitation = async (applicationId, actorUserId) => {
  const id = positiveId(applicationId, 400, 'PARTNER_STORE_APPLICATION_ID_INVALID', 'รหัสใบสมัครไม่ถูกต้อง')
  const actorId = positiveId(actorUserId, 401, 'PARTNER_STORE_ACTIVATION_ACTOR_REQUIRED', 'ไม่พบผู้ดำเนินการ')
  const rawToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS)

  const invitation = await repository.withTransaction(async (tx) => {
    const application = await repository.findById(id, tx)
    if (!application) fail(404, 'PARTNER_STORE_APPLICATION_NOT_FOUND', 'ไม่พบใบสมัครร้านพาร์ทเนอร์')
    if (application.status !== 'APPROVED' || application.provisioningStatus !== 'PROVISIONED' || !application.provisionedBranchId) {
      fail(409, 'PARTNER_STORE_ACTIVATION_REQUIRES_PROVISIONED_STORE', 'ต้องอนุมัติและสร้างร้านให้เสร็จก่อนออกคำเชิญเปิดใช้งาน')
    }
    const email = String(application.contactEmail || '').trim().toLowerCase()
    if (!email) fail(409, 'PARTNER_STORE_ACTIVATION_EMAIL_REQUIRED', 'ใบสมัครไม่มีอีเมลสำหรับบัญชีเจ้าของร้าน')
    if (application.activationStatus === 'ACTIVE' || application.provisionedOwnerUserId) {
      fail(409, 'PARTNER_STORE_OWNER_ALREADY_ACTIVE', 'บัญชีเจ้าของร้านถูกเปิดใช้งานแล้ว')
    }
    if (await findIdentityConflict(tx, email)) {
      fail(409, 'PARTNER_STORE_OWNER_EMAIL_ALREADY_IN_USE', 'อีเมลนี้มีบัญชีอยู่แล้ว กรุณาติดต่อผู้ดูแลระบบ')
    }

    const now = new Date()
    await tx.partnerStoreActivationInvitation.updateMany({
      where: { applicationId: id, consumedAt: null, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now },
    })

    const created = await tx.partnerStoreActivationInvitation.create({
      data: { applicationId: id, tokenHash, expiresAt, createdByUserId: actorId },
      select: { id: true, expiresAt: true },
    })

    await tx.partnerStoreApplication.update({
      where: { id },
      data: { activationStatus: 'INVITED' },
    })

    await tx.partnerStoreApplicationEvent.create({
      data: {
        applicationId: id,
        eventType: 'ACTIVATION_INVITATION_ISSUED',
        previousStatus: application.status,
        resultingStatus: application.status,
        previousProvisioningStatus: application.provisioningStatus,
        resultingProvisioningStatus: application.provisioningStatus,
        previousActivationStatus: application.activationStatus,
        resultingActivationStatus: 'INVITED',
        actorUserId: actorId,
        metadata: { invitationId: created.id, expiresAt: created.expiresAt.toISOString() },
      },
    })

    return created
  })

  return {
    invitationId: invitation.id,
    token: rawToken,
    expiresAt: invitation.expiresAt,
    claimPath: `/partner-portal/activate?token=${encodeURIComponent(rawToken)}`,
  }
}

const claimActivation = async (payload = {}) => {
  const rawToken = String(payload.token || '').trim()
  const password = String(payload.password || '')
  if (!rawToken) fail(400, 'PARTNER_STORE_ACTIVATION_TOKEN_REQUIRED', 'ไม่พบโทเคนเปิดใช้งาน')
  if (password.length < 8) fail(400, 'PARTNER_STORE_ACTIVATION_PASSWORD_INVALID', 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')

  const tokenHash = hashToken(rawToken)

  await repository.withTransaction(async (tx) => {
    const invitation = await tx.partnerStoreActivationInvitation.findUnique({
      where: { tokenHash },
      select: { expiresAt: true, revokedAt: true, consumedAt: true },
    })
    assertUsableInvitation(invitation)
  })

  const passwordHash = await bcrypt.hash(password, 10)

  return repository.withTransaction(async (tx) => {
    const invitation = await tx.partnerStoreActivationInvitation.findUnique({
      where: { tokenHash },
      include: { application: true },
    })
    assertUsableInvitation(invitation)

    const application = invitation.application
    if (application.status !== 'APPROVED' || application.provisioningStatus !== 'PROVISIONED' || !application.provisionedBranchId) {
      fail(409, 'PARTNER_STORE_ACTIVATION_STATE_INVALID', 'ร้านยังไม่พร้อมเปิดใช้งานบัญชีเจ้าของร้าน')
    }
    if (application.activationStatus === 'ACTIVE' || application.provisionedOwnerUserId) {
      fail(409, 'PARTNER_STORE_OWNER_ALREADY_ACTIVE', 'บัญชีเจ้าของร้านถูกเปิดใช้งานแล้ว')
    }

    const email = String(application.contactEmail || '').trim().toLowerCase()
    if (!email) fail(409, 'PARTNER_STORE_ACTIVATION_EMAIL_REQUIRED', 'ใบสมัครไม่มีอีเมลสำหรับบัญชีเจ้าของร้าน')
    if (await findIdentityConflict(tx, email)) {
      fail(409, 'PARTNER_STORE_OWNER_EMAIL_ALREADY_IN_USE', 'อีเมลนี้มีบัญชีอยู่แล้ว กรุณาติดต่อผู้ดูแลระบบ')
    }

    const owner = await tx.user.create({
      data: {
        email,
        loginId: email,
        password: passwordHash,
        role: 'ADMIN',
        loginType: 'EMAIL',
        enabled: true,
      },
      select: { id: true, email: true },
    })

    await tx.employeeProfile.create({
      data: {
        userId: owner.id,
        branchId: application.provisionedBranchId,
        name: application.contactName,
        phone: application.contactPhone,
        approved: true,
        active: true,
        v2Role: 'OWNER',
      },
    })

    const activatedAt = new Date()
    await tx.partnerStoreApplication.update({
      where: { id: application.id },
      data: {
        activationStatus: 'ACTIVE',
        provisionedOwnerUserId: owner.id,
        activatedAt,
      },
    })

    await tx.partnerStoreActivationInvitation.update({
      where: { id: invitation.id },
      data: { consumedAt: activatedAt },
    })

    await tx.partnerStoreApplicationEvent.create({
      data: {
        applicationId: application.id,
        eventType: 'OWNER_ACTIVATED',
        previousStatus: application.status,
        resultingStatus: application.status,
        previousProvisioningStatus: application.provisioningStatus,
        resultingProvisioningStatus: application.provisioningStatus,
        previousActivationStatus: application.activationStatus,
        resultingActivationStatus: 'ACTIVE',
        actorUserId: owner.id,
        metadata: { ownerUserId: owner.id, branchId: application.provisionedBranchId },
      },
    })

    return {
      applicationId: application.id,
      activationStatus: 'ACTIVE',
      ownerUserId: owner.id,
      branchId: application.provisionedBranchId,
      email: owner.email,
      activatedAt,
    }
  })
}

module.exports = { issueInvitation, claimActivation }
