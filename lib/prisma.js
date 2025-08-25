// ✅ lib/prisma.js (CommonJS, singleton, clean export)
const { PrismaClient, Prisma } = require('@prisma/client');

// Ensure a single PrismaClient instance across dev/hot-reload
globalThis._prisma ??= new PrismaClient();

const prisma = globalThis._prisma;

// Clean export: always destructure where used
// usage: const { prisma, Prisma } = require('../lib/prisma')
module.exports = { prisma, Prisma };
