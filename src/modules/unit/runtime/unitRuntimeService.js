// src/modules/unit/runtime/unitRuntimeService.js

const { Prisma } = require('../../../../lib/prisma');
const repository = require('./unitRuntimeRepository');

const toInt = (value) =>
  value === undefined || value === null || value === '' ? undefined : Number(value);

const normalizeName = (value) => String(value || '').trim();

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getAllUnits = () => repository.findAll();

const getUnitById = async (rawId) => {
  const id = toInt(rawId);
  if (!id) throw createHttpError(400, 'id ไม่ถูกต้อง');

  const unit = await repository.findById(id);
  if (!unit) throw createHttpError(404, 'ไม่พบหน่วยนับนี้');
  return unit;
};

const createUnit = async (rawName) => {
  const name = normalizeName(rawName);
  if (!name) throw createHttpError(400, 'กรุณาระบุชื่อหน่วยนับ');

  try {
    return await repository.create(name);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw createHttpError(409, 'ชื่อหน่วยนับซ้ำ (unique constraint)');
    }
    throw error;
  }
};

const updateUnit = async (rawId, rawName) => {
  const id = toInt(rawId);
  if (!id) throw createHttpError(400, 'id ไม่ถูกต้อง');

  const name = normalizeName(rawName);
  if (!name) throw createHttpError(400, 'กรุณาระบุชื่อหน่วยนับ');

  try {
    return await repository.update(id, name);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw createHttpError(404, 'ไม่พบหน่วยนับที่ต้องการแก้ไข');
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw createHttpError(409, 'ชื่อหน่วยนับซ้ำ (unique constraint)');
    }
    throw error;
  }
};

const deleteUnit = async (rawId) => {
  const id = toInt(rawId);
  if (!id) throw createHttpError(400, 'id ไม่ถูกต้อง');

  try {
    await repository.remove(id);
    return { message: 'ลบหน่วยนับเรียบร้อยแล้ว' };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw createHttpError(404, 'ไม่พบหน่วยนับที่ต้องการลบ');
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw createHttpError(409, 'ลบไม่ได้ มีการอ้างอิงอยู่ (foreign key constraint)');
    }
    throw error;
  }
};

module.exports = {
  getAllUnits,
  getUnitById,
  createUnit,
  updateUnit,
  deleteUnit,
};
