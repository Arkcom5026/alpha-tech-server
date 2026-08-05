'use strict';

const fs = require('node:fs');
const path = require('node:path');

const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
const source = fs.readFileSync(schemaPath, 'utf8');

const requiredFields = [
  'contentConfiguration',
  'publishedThemePreset',
  'publishedThemeTokens',
  'publishedLayoutPreset',
  'publishedSectionConfiguration',
  'publishedContentConfiguration',
  'publishedVersion',
];

if (requiredFields.every((field) => source.includes(`  ${field}`))) {
  console.log('store experience published snapshot schema: already applied');
  process.exit(0);
}

const modelPattern = /model StoreExperienceProfile \{[\s\S]*?\n\}/;
const match = source.match(modelPattern);
if (!match) {
  throw new Error('StoreExperienceProfile model not found; schema was not modified');
}

const originalModel = match[0];
const anchor = '  sectionConfiguration Json?';
if (!originalModel.includes(anchor)) {
  throw new Error('StoreExperienceProfile anchor not found; schema was not modified');
}

if (requiredFields.some((field) => originalModel.includes(field))) {
  throw new Error('Partial published snapshot schema detected; review manually before continuing');
}

const insertion = [
  anchor,
  '  contentConfiguration              Json?',
  '  publishedThemePreset              String?                       @db.VarChar(80)',
  '  publishedThemeTokens              Json?',
  '  publishedLayoutPreset             String?                       @db.VarChar(80)',
  '  publishedSectionConfiguration     Json?',
  '  publishedContentConfiguration     Json?',
  '  publishedVersion                  Int?',
].join('\n');

const nextModel = originalModel.replace(anchor, insertion);
const nextSource = source.replace(originalModel, nextModel);

if (nextSource === source) {
  throw new Error('Schema patch produced no change');
}

fs.writeFileSync(schemaPath, nextSource, 'utf8');
console.log('store experience published snapshot schema: applied');
