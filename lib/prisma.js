// ✅ lib/prisma.js (CommonJS, singleton, clean export)
const { PrismaClient, Prisma } = require('@prisma/client');
const {
  authorizeStockMovementClient,
} = require('../src/modules/inventory/movement/stockMovementWriter');

// Ensure a single PrismaClient instance across dev/hot-reload
globalThis._prismaRaw ??= new PrismaClient();
globalThis._prisma ??= authorizeStockMovementClient(globalThis._prismaRaw);

const prisma = globalThis._prisma;

// Clean export: always destructure where used
// usage: const { prisma, Prisma } = require('../lib/prisma')
module.exports = { prisma, Prisma };