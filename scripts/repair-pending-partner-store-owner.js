'use strict'

const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const { prisma } = require('../lib/prisma')

const required = (name) => {
  const value = String(process.env[name] || '').trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

const main = async () => {
  if (process.env.ALLOW_PARTNER_STORE_OWNER_DB_REPAIR !== 'true') {
    throw new Error('Refusing to run: set ALLOW_PARTNER_STORE_OWNER_DB_REPAIR=true explicitly')
  }

  const applicationId = Number(required('PARTNER_STORE_APPLICATION_ID'))
  const expectedEmail = required('PARTNER_STORE_OWNER_EMAIL').toLowerCase()

  if (!Number.isInteger(applicationId) || applicationId <= 0) {
    throw new Error('PARTNER_STORE_APPLICATION_ID must be a positive integer')
  }

  const outcome = await prisma.$transaction(async (tx) => {
    const application = await tx.partnerStoreApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        applicationCode: true,
        contactEmail: true,
        status: true,
        provisionedOwnerUserId: true,
        provisionedBranchId: true,
      },
    })

    if (!application) throw new Error(`Partner application ${applicationId} was not found`)
    if (!['PENDING', 'UNDER_REVIEW'].includes(application.status)) {
      throw new Error(`Application is not repairable in status ${application.status}`)
    }
    if (application.provisionedBranchId) {
      throw new Error('Application already has a provisioned branch')
    }
    if (application.provisionedOwnerUserId) {
      return {
        result: 'NO_CHANGE',
        reason: 'OWNER_ALREADY_LINKED',
        applicationId: application.id,
        applicationCode: application.applicationCode,
        ownerUserId: application.provisionedOwnerUserId,
      }
    }

    const applicationEmail = String(application.contactEmail || '').trim().toLowerCase()
    if (!applicationEmail || applicationEmail !== expectedEmail) {
      throw new Error('PARTNER_STORE_OWNER_EMAIL does not match the application contact email')
    }

    const existingUser = await tx.user.findUnique({
      where: { email: applicationEmail },
      include: { employeeProfile: true },
    })

    if (existingUser) {
      if (existingUser.enabled || existingUser.employeeProfile || existingUser.role !== 'EMPLOYEE') {
        throw new Error('Existing email account is not safe to link to this pending application')
      }

      await tx.partnerStoreApplication.update({
        where: { id: application.id },
        data: { provisionedOwnerUserId: existingUser.id },
      })

      return {
        result: 'PASS',
        repairMode: 'LINK_EXISTING_DISABLED_OWNER',
        applicationId: application.id,
        applicationCode: application.applicationCode,
        ownerUserId: existingUser.id,
        ownerEmail: applicationEmail,
        ownerEnabled: false,
        passwordResetRequired: true,
      }
    }

    // The original plaintext password cannot and must not be reconstructed.
    // Create an unknown high-entropy placeholder; the owner must use Forgot Password.
    const inaccessiblePassword = crypto.randomBytes(48).toString('base64url')
    const passwordHash = await bcrypt.hash(inaccessiblePassword, 12)

    const owner = await tx.user.create({
      data: {
        email: applicationEmail,
        loginId: applicationEmail,
        password: passwordHash,
        role: 'EMPLOYEE',
        loginType: 'EMAIL',
        enabled: false,
      },
      select: { id: true, email: true, enabled: true },
    })

    await tx.partnerStoreApplication.update({
      where: { id: application.id },
      data: { provisionedOwnerUserId: owner.id },
    })

    return {
      result: 'PASS',
      repairMode: 'CREATE_DISABLED_OWNER_WITH_INACCESSIBLE_PASSWORD',
      applicationId: application.id,
      applicationCode: application.applicationCode,
      ownerUserId: owner.id,
      ownerEmail: owner.email,
      ownerEnabled: owner.enabled,
      passwordResetRequired: true,
    }
  })

  console.log(JSON.stringify(outcome))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
