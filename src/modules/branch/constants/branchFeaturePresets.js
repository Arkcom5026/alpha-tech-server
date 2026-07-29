'use strict';

module.exports = Object.freeze({
  GENERAL: Object.freeze({ mode: 'STRUCTURED', trackSerialNumber: false, enableTemplates: true }),
  IT: Object.freeze({ mode: 'STRUCTURED', trackSerialNumber: true, enableTemplates: true }),
  ELECTRONICS: Object.freeze({ mode: 'STRUCTURED', trackSerialNumber: true, enableTemplates: true }),
  CONSTRUCTION: Object.freeze({ mode: 'SIMPLE', trackSerialNumber: false, enableTemplates: false }),
  GROCERY: Object.freeze({ mode: 'SIMPLE', trackSerialNumber: false, enableTemplates: false }),
});
