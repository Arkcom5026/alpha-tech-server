// src/modules/unit/runtime/unitRuntimeController.js

const service = require('./unitRuntimeService');

const handleError = (res, error, fallbackMessage) => {
  console.error(`❌ [unit runtime] ${fallbackMessage}:`, error);
  return res.status(error?.statusCode || 500).json({
    message: error?.message || fallbackMessage,
  });
};

const getAllUnits = async (_req, res) => {
  try {
    return res.json(await service.getAllUnits());
  } catch (error) {
    return handleError(res, error, 'เกิดข้อผิดพลาดในการดึงข้อมูลหน่วยนับ');
  }
};

const getUnitById = async (req, res) => {
  try {
    return res.json(await service.getUnitById(req.params?.id));
  } catch (error) {
    return handleError(res, error, 'เกิดข้อผิดพลาดในการดึงข้อมูลหน่วยนับ');
  }
};

const createUnit = async (req, res) => {
  try {
    return res.status(201).json(await service.createUnit(req.body?.name));
  } catch (error) {
    return handleError(res, error, 'ไม่สามารถสร้างหน่วยนับได้');
  }
};

const updateUnit = async (req, res) => {
  try {
    return res.json(await service.updateUnit(req.params?.id, req.body?.name));
  } catch (error) {
    return handleError(res, error, 'ไม่สามารถแก้ไขหน่วยนับได้');
  }
};

const deleteUnit = async (req, res) => {
  try {
    return res.json(await service.deleteUnit(req.params?.id));
  } catch (error) {
    return handleError(res, error, 'ไม่สามารถลบหน่วยนับได้');
  }
};

module.exports = {
  getAllUnits,
  getUnitById,
  createUnit,
  updateUnit,
  deleteUnit,
};
