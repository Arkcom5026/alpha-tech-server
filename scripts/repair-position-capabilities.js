'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const positionId = Number(process.argv[2]);
const branchId = Number(process.argv[3]);
const profile = String(process.argv[4] || '').trim().toUpperCase();
const mode = String(process.argv[5] || 'inspect').trim().toLowerCase();

if (!Number.isInteger(positionId) || positionId <= 0) {
  throw new Error('Usage: node scripts/repair-position-capabilities.js <positionId> <branchId> <profile> [inspect|apply]');
}
if (!Number.isInteger(branchId) || branchId <= 0) throw new Error('branchId must be a positive integer.');
if (profile !== 'TECHNICIAN') throw new Error('Only TECHNICIAN profile is supported by this scoped repair.');
if (!['inspect', 'apply'].includes(mode)) throw new Error('Mode must be inspect or apply.');

const approvedScope = `${positionId}:${branchId}:${profile}`;
if (mode === 'apply') {
  if (process.env.ALLOW_MAIN_DATABASE_POSITION_CAPABILITY_REPAIR !== 'YES') {
    throw new Error('Blocked: set ALLOW_MAIN_DATABASE_POSITION_CAPABILITY_REPAIR=YES to approve this scoped repair.');
  }
  if (process.env.CONFIRM_POSITION_CAPABILITY_REPAIR_SCOPE !== approvedScope) {
    throw new Error(`Blocked: CONFIRM_POSITION_CAPABILITY_REPAIR_SCOPE must equal ${approvedScope}.`);
  }
}

const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) throw new Error('Missing .env runtime configuration.');
dotenv.config({ path: envPath, override: false });
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');

const { prisma } = require('../lib/prisma');
const { legacyCapabilitiesForRole } = require('../src/modules/employee/authorization/employeePositionAuthority');
const expectedCapabilities = legacyCapabilitiesForRole(profile);

const connectionAuthority = () => {
  try {
    const url = new URL(process.env.DATABASE_URL);
    return { mode: mode === 'apply' ? 'RUNTIME_SCOPED_REPAIR' : 'READ_ONLY_INSPECTION', host: url.hostname, port: url.port || null, database: url.pathname.replace(/^\//, '') || null };
  } catch (_) {
    return { mode: mode === 'apply' ? 'RUNTIME_SCOPED_REPAIR' : 'READ_ONLY_INSPECTION', host: 'unparsed', port: null, database: null };
  }
};

async function main() {
  const readCurrent = async (client) => {
    const position = await client.position.findFirst({
      where: { id: positionId, branchId },
      select: { id: true, branchId: true, name: true, isActive: true, capabilities: true },
    });
    if (!position) throw new Error('Position not found in the approved branch scope.');
    const employees = await client.employeeProfile.findMany({
      where: { positionId, branchId, active: true },
      select: { id: true, v2Role: true, approved: true },
      orderBy: { id: 'asc' },
    });
    return { position, employees };
  };

  if (mode === 'inspect') {
    const { position, employees } = await readCurrent(prisma);
    console.log(JSON.stringify({ result: 'PASS', databaseModified: false, authority: connectionAuthority(), approvedScope: { positionId, branchId, profile }, expectedCapabilities, currentCapabilities: Array.isArray(position.capabilities) ? position.capabilities : null, position, employees }, null, 2));
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const { position, employees } = await readCurrent(tx);
    if (!position.isActive) throw new Error('Position is inactive; refusing capability repair.');
    const before = Array.isArray(position.capabilities) ? position.capabilities : null;
    const alreadyExact = Array.isArray(before) && before.length === expectedCapabilities.length && expectedCapabilities.every((capability) => before.includes(capability));
    if (alreadyExact) return { changed: false, reason: 'ALREADY_EXACT', position, employees, before, after: before };
    if (before !== null) throw new Error('Position already has explicit capabilities that differ from the TECHNICIAN compatibility set; refusing overwrite.');
    const updated = await tx.position.update({
      where: { id: positionId },
      data: { capabilities: expectedCapabilities },
      select: { id: true, branchId: true, name: true, isActive: true, capabilities: true },
    });
    return { changed: true, reason: 'MIGRATED_FROM_NULL', position: updated, employees, before, after: updated.capabilities };
  }, { timeout: 20000 });

  console.log(JSON.stringify({ result: 'PASS', databaseModified: result.changed, authority: connectionAuthority(), approvedScope: { positionId, branchId, profile }, expectedCapabilities, ...result }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ result: 'FAIL', databaseModified: false, authority: connectionAuthority(), approvedScope: { positionId, branchId, profile, mode }, expectedCapabilities, message: error.message || String(error) }, null, 2));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
