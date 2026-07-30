'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const { assertTestDatabaseAuthority } = require('../recovery/testDatabaseAuthority');

const envPath = path.join(process.cwd(), '.env.restore');
if (!fs.existsSync(envPath)) throw new Error('Missing .env.restore.');

dotenv.config({ path: envPath, override: true });

const targetUrl = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;
assertTestDatabaseAuthority({
  targetUrl,
  env: process.env,
  requiresWriteApproval: true,
});

if (process.env.TEST_OPERATOR_PROVISIONING_APPROVAL !== 'ALPHATECH_TEST_OPERATOR_PROVISION') {
  throw new Error('Set TEST_OPERATOR_PROVISIONING_APPROVAL=ALPHATECH_TEST_OPERATOR_PROVISION for Test DB operator provisioning.');
}

const required = (name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing ${name} in .env.restore.`);
  return value;
};

const operatorEmail = required('TEST_PARTNER_OPERATOR_EMAIL').toLowerCase();
const operatorPassword = required('TEST_PARTNER_OPERATOR_PASSWORD');
const ownerEmail = required('TEST_PARTNER_OWNER_EMAIL').toLowerCase();
const ownerPassword = required('TEST_PARTNER_OWNER_PASSWORD');

process.env.DATABASE_URL = targetUrl;
process.env.DIRECT_URL = targetUrl;
const { prisma } = require('../lib/prisma');

async function main() {
  const suffix = crypto.createHash('sha256').update(operatorEmail).digest('hex').slice(0, 10);
  const slug = `system-test-partner-admin-${suffix}`;
  const [operatorHash, ownerHash] = await Promise.all([
    bcrypt.hash(operatorPassword, 12),
    bcrypt.hash(ownerPassword, 12),
  ]);

  const result = await prisma.$transaction(async (tx) => {
    const branch = await tx.branch.upsert({
      where: { slug },
      update: {},
      create: {
        name: 'System Test Partner Administration',
        address: 'SYSTEM TEST ONLY',
        phone: '0000000000',
        slug,
        businessType: 'GENERAL',
        category: {
          connectOrCreate: {
            where: { name: 'System Partner Store' },
            create: { name: 'System Partner Store', active: true, isSystem: true },
          },
        },
      },
      select: { id: true, slug: true },
    });

    const operator = await tx.user.upsert({
      where: { email: operatorEmail },
      update: { password: operatorHash, role: 'SUPERADMIN', enabled: true },
      create: { email: operatorEmail, password: operatorHash, role: 'SUPERADMIN', enabled: true },
      select: { id: true },
    });

    await tx.employeeProfile.upsert({
      where: { userId: operator.id },
      update: { branchId: branch.id, approved: true, active: true, v2Role: 'OWNER' },
      create: {
        userId: operator.id,
        branchId: branch.id,
        name: 'System Test Partner Superadmin',
        phone: '0000000000',
        approved: true,
        active: true,
        v2Role: 'OWNER',
      },
    });

    const owner = await tx.user.upsert({
      where: { email: ownerEmail },
      update: { password: ownerHash, role: 'CUSTOMER', enabled: true },
      create: { email: ownerEmail, password: ownerHash, role: 'CUSTOMER', enabled: true },
      select: { id: true },
    });

    const ownerProfile = await tx.employeeProfile.findUnique({ where: { userId: owner.id }, select: { id: true } });
    if (ownerProfile) throw new Error('TEST_PARTNER_OWNER_EMAIL is already linked to an employee profile. Choose another Test-only owner email.');

    return { branch, operator, owner };
  });

  console.log(JSON.stringify({
    result: 'PASS',
    environment: 'TEST',
    operatorEmail,
    operatorBranchSlug: result.branch.slug,
    ownerUserId: result.owner.id,
    retainedTestData: true,
  }));
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
