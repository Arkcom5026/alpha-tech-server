// src/modules/location/address/query/validate/addressValidateRepository.js
const { prisma, Prisma } = require('../../../../../../lib/prisma');

class AddressValidatePersistenceError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'AddressValidatePersistenceError';
    this.isKnownPrismaError = Boolean(options.isKnownPrismaError);
    this.cause = options.cause;
  }
}

const findSubdistrictByCode = async (subdistrictCode) => {
  try {
    return await prisma.subdistrict.findUnique({
      where: { code: subdistrictCode },
    });
  } catch (error) {
    throw new AddressValidatePersistenceError('Address validation persistence failed', {
      isKnownPrismaError: error instanceof Prisma.PrismaClientKnownRequestError,
      cause: error,
    });
  }
};

module.exports = {
  AddressValidatePersistenceError,
  findSubdistrictByCode,
};
