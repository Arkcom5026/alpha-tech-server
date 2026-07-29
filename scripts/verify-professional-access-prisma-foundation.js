const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const fragmentPath = path.join(root, 'prisma', 'fragments', 'professional-access-foundation.prisma');
const migrationPath = path.join(root, 'prisma', 'migrations', '20260729143000_professional_access_foundation', 'migration.sql');
const schemaPath = path.join(root, 'prisma', 'schema.prisma');

const read = (filePath) => fs.readFileSync(filePath, 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(fs.existsSync(fragmentPath), 'Missing professional access Prisma fragment');
assert(fs.existsSync(migrationPath), 'Missing professional access migration SQL');
assert(fs.existsSync(schemaPath), 'Missing main Prisma schema');

const fragment = read(fragmentPath);
const migration = read(migrationPath);
const schema = read(schemaPath);

for (const model of [
  'Business',
  'BusinessMembership',
  'ExternalOrganization',
  'ExternalOrganizationMembership',
  'BusinessAccountingFirmAssignment',
  'DelegatedPermissionScope',
]) {
  assert(fragment.includes(`model ${model} {`), `Fragment missing model ${model}`);
  assert(migration.includes(`CREATE TABLE "${model}"`), `Migration missing table ${model}`);
}

for (const enumName of [
  'BusinessStatus',
  'BusinessMembershipRole',
  'BusinessMembershipStatus',
  'ExternalOrganizationType',
  'ExternalOrganizationStatus',
  'ExternalOrganizationMembershipRole',
  'ExternalOrganizationMembershipStatus',
  'BusinessAccountingFirmAssignmentStatus',
  'DelegatedPermissionScopeStatus',
  'DelegatedPermissionBranchMode',
]) {
  assert(fragment.includes(`enum ${enumName} {`), `Fragment missing enum ${enumName}`);
  assert(migration.includes(`CREATE TYPE "${enumName}" AS ENUM`), `Migration missing enum ${enumName}`);
}

assert(fragment.includes('businessId Int?'), 'Branch businessId must remain nullable in foundation');
assert(migration.includes('ALTER TABLE "Branch" ADD COLUMN "businessId" INTEGER;'), 'Migration must add nullable Branch.businessId');
assert(schema.includes('branchId                          Int?'), 'EmployeeProfile.branchId compatibility field must remain present');
assert(!migration.includes('DROP COLUMN "branchId"'), 'Migration must not remove EmployeeProfile.branchId');
assert(!migration.includes('ALTER COLUMN "businessId" SET NOT NULL'), 'Foundation must not require Branch.businessId yet');
assert(!migration.includes('DROP TABLE'), 'Foundation migration must be additive');
assert(!migration.includes('DROP TYPE'), 'Foundation migration must not remove enums');

console.log('Professional Access Prisma Foundation repository verification: PASS');
console.log('Note: prisma/schema.prisma integration and runtime migration execution are deferred to final test integration.');
