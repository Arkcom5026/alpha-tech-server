'use strict';

const { prisma } = require('../../../../../lib/prisma');

const money = (value) => Number(value || 0);
const mapItem = (item) => ({
  ...item,
  quantity: money(item.quantity),
  basePrice: money(item.basePrice),
  discount: money(item.discount),
  price: money(item.price),
  vatAmount: money(item.vatAmount),
});

const mapReservation = (reservation) => ({
  ...reservation,
  totalBeforeDiscount: money(reservation.totalBeforeDiscount),
  totalDiscount: money(reservation.totalDiscount),
  totalAmount: money(reservation.totalAmount),
  depositAmount: money(reservation.depositAmount),
  outstandingAmount: Math.max(0, money(reservation.totalAmount) - money(reservation.depositAmount)),
  items: reservation.items ? reservation.items.map(mapItem) : undefined,
});

const list = async ({ branchId, status, customerId, keyword, limit, offset }, db = prisma) => {
  const where = {
    branchId,
    ...(status ? { status } : {}),
    ...(customerId ? { customerId } : {}),
    ...(keyword ? {
      OR: [
        { code: { contains: keyword, mode: 'insensitive' } },
        { customer: { user: { email: { contains: keyword, mode: 'insensitive' } } } },
      ],
    } : {}),
  };

  const [items, total] = await Promise.all([
    db.productReservation.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      skip: offset,
      include: {
        customer: { select: { id: true, name: true, phone: true, user: { select: { email: true } } } },
        createdByEmployee: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
    db.productReservation.count({ where }),
  ]);

  return { items: items.map(mapReservation), total, limit, offset };
};

const findById = async ({ id, branchId }, db = prisma) => {
  const reservation = await db.productReservation.findFirst({
    where: { id, branchId },
    include: {
      customer: { select: { id: true, name: true, phone: true, user: { select: { email: true } } } },
      createdByEmployee: { select: { id: true, name: true } },
      convertedSale: { select: { id: true, code: true, status: true, totalAmount: true } },
      items: {
        orderBy: { id: 'asc' },
        include: {
          product: { select: { id: true, name: true, mode: true, saleBarcode: true } },
          stockItem: { select: { id: true, barcode: true, serialNumber: true, status: true } },
          simpleLot: { select: { id: true, lotCode: true, qtyRemaining: true } },
        },
      },
    },
  });
  return reservation ? mapReservation(reservation) : null;
};

module.exports = Object.freeze({ list, findById });
