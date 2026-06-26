// src/database/prisma/client.js
const { PrismaClient } = require('@prisma/client');

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    log: ['error', 'warn'],
  });
} else {
  // สำหรับสภาพแวดล้อมเพื่อการพัฒนา (Development) ป้องกันการสปอนอินสแตนซ์ซ้ำซ้อนเมื่อเซิร์ฟเวอร์โหลดใหม่
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });
  }
  prisma = global.prisma;
}

module.exports = prisma;