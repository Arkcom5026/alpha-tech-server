let bcrypt;
let bcryptProvider = 'unknown';

try {
  // eslint-disable-next-line global-require
  bcrypt = require('@node-rs/bcrypt');
  bcryptProvider = 'node-rs';
} catch (nodeRsError) {
  try {
    // eslint-disable-next-line global-require
    bcrypt = require('bcrypt');
    bcryptProvider = 'bcrypt';
  } catch (bcryptError) {
    // eslint-disable-next-line global-require
    bcrypt = require('bcryptjs');
    bcryptProvider = 'bcryptjs';
  }
}

const hashPassword = async (plain, rounds = 10) => {
  if (typeof bcrypt?.hash === 'function') return bcrypt.hash(plain, rounds);
  if (typeof bcrypt?.hashSync === 'function') return bcrypt.hashSync(plain, rounds);
  throw new Error('bcrypt hash function not available');
};

const comparePassword = async (plain, hashed) => {
  if (typeof bcrypt?.compare === 'function') return bcrypt.compare(plain, hashed);
  if (typeof bcrypt?.verify === 'function') {
    try {
      return await bcrypt.verify(plain, hashed);
    } catch (error) {
      return bcrypt.verify(hashed, plain);
    }
  }
  throw new Error('bcrypt compare/verify function not available');
};

module.exports = {
  bcryptProvider,
  hashPassword,
  comparePassword,
};
