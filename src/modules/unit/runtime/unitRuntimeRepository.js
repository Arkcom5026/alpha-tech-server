// src/modules/unit/runtime/unitRuntimeRepository.js

const { prisma } = require('../../../../lib/prisma');

const findAll = () => prisma.unit.findMany({ orderBy: { name: 'asc' } });

const findById = (id) => prisma.unit.findUnique({ where: { id } });

const create = (name) => prisma.unit.create({ data: { name } });

const update = (id, name) =>
  prisma.unit.update({
    where: { id },
    data: { name },
  });

const remove = (id) => prisma.unit.delete({ where: { id } });

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove,
};
