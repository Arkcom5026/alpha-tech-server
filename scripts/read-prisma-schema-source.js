'use strict';

const fs = require('node:fs');
const path = require('node:path');

const collect = (directory) => fs.readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return collect(absolute);
    return entry.isFile() && entry.name.endsWith('.prisma') ? [absolute] : [];
  });

const readPrismaSchemaSource = (root) => collect(path.join(root, 'prisma'))
  .sort()
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n');

module.exports = { readPrismaSchemaSource };
