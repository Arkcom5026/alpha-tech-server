const crypto = require('crypto');

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((output, key) => {
      output[key] = stable(value[key]);
      return output;
    }, {});
  }
  return value;
};

const createSaleReturnRequestHash = (material) =>
  crypto.createHash('sha256').update(JSON.stringify(stable(material))).digest('hex');

module.exports = { stable, createSaleReturnRequestHash };
