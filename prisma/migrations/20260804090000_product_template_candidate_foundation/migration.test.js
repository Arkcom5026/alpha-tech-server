const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
const migration = fs.readFileSync(path.join(__dirname, 'migration.sql'), 'utf8');

function model(name) {
  const match = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`, 'm'));
  assert.ok(match, `missing model ${name}`);
  return match[1];
}

function exactEnum(name, values) {
  const match = schema.match(new RegExp(`enum ${name} \\{([\\s\\S]*?)\\n\\}`, 'm'));
  assert.ok(match, `missing enum ${name}`);
  assert.deepEqual(match[1].trim().split(/\s+/), values);
}

exactEnum('ProductTemplateCandidateStatus', ['DRAFT', 'UNDER_REVIEW', 'REJECTED', 'PROMOTED', 'MERGED', 'CANCELLED']);
exactEnum('ProductTemplateCandidateEventType', ['CREATED', 'REVIEW_STARTED', 'PROPOSED_DATA_UPDATED', 'REJECTED', 'PROMOTED', 'MERGED', 'CANCELLED']);

const candidate = model('ProductTemplateCandidate');
const event = model('ProductTemplateCandidateEvent');
for (const [name, type] of [['sourceBranchId', 'Int'], ['sourceProductId', 'Int'], ['targetTemplateBranchId', 'Int'], ['targetTemplateProductId', 'Int?'], ['sourceSnapshot', 'Json'], ['proposedTemplateData', 'Json?'], ['duplicateAssessment', 'Json?'], ['createdByEmployeeId', 'Int?'], ['reviewedByEmployeeId', 'Int?']]) assert.match(candidate, new RegExp(`\\b${name}\\s+${type.replace('?', '\\?')}(?:\\s|$)`));
for (const relation of ['ProductTemplateCandidateSourceBranch', 'ProductTemplateCandidateSourceProduct', 'ProductTemplateCandidateTargetBranch', 'ProductTemplateCandidateTargetProduct', 'ProductTemplateCandidateCreatedBy', 'ProductTemplateCandidateReviewedBy']) assert.match(candidate, new RegExp(relation));
for (const index of ['@@index([sourceBranchId, sourceProductId])', '@@index([targetTemplateBranchId, status])', '@@index([status, createdAt])', '@@index([targetTemplateProductId])']) assert.ok(candidate.includes(index), `missing ${index}`);
assert.ok(!candidate.includes('@@unique'), 'candidate must not impose a uniqueness constraint');
assert.ok(!event.includes('updatedAt'), 'event must not have updatedAt');
assert.match(event, /@relation\(fields: \[candidateId\], references: \[id\], onDelete: Cascade\)/);
for (const index of ['@@index([candidateId, createdAt])', '@@index([eventType, createdAt])', '@@index([actorEmployeeId])']) assert.ok(event.includes(index), `missing ${index}`);
for (const reverse of ['productTemplateCandidatesCreated', 'productTemplateCandidatesReviewed', 'productTemplateCandidateEvents', 'sourceProductTemplateCandidates', 'targetProductTemplateCandidates']) assert.match(schema, new RegExp(`\\b${reverse}\\b`));
for (const forbidden of ['stock', 'serial', 'movement', 'supplier', 'purchase', 'customer', 'sale', 'cost', 'reservation', 'repair', 'claim', 'tax']) assert.ok(!new RegExp(`\\b${forbidden}`, 'i').test(candidate + event), `forbidden snapshot field ${forbidden}`);
assert.ok(!/^\s*(UPDATE|INSERT\s+INTO|DELETE\s+FROM|MERGE\s+INTO|TRUNCATE|DROP)\b/im.test(migration), 'migration must be additive and data-mutation free');
assert.ok(!/ALTER TABLE "public"\."(?:Product|Brand|Branch)"\s/i.test(migration), 'migration must not alter existing ownership foundations');
for (const table of ['ProductTemplateCandidate', 'ProductTemplateCandidateEvent']) assert.match(migration, new RegExp(`CREATE TABLE "public"\\."${table}"`));
assert.match(migration, /ProductTemplateCandidateEvent_candidateId_fkey[\s\S]*ON DELETE CASCADE ON UPDATE CASCADE/);
console.log('ProductTemplate Candidate Prisma foundation contract passed');
