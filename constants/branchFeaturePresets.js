// ============================== NEW FILE: constants/branchFeaturePresets.js ===============================
// CommonJS export of BusinessType → feature presets
// Path (relative to server root): D:/alpha-tech/server/constants/branchFeaturePresets.js
// Used by controllers/branchController.js

module.exports = {
    GENERAL: { mode: 'STRUCTURED', trackSerialNumber: false, enableTemplates: true },
    IT: { mode: 'STRUCTURED', trackSerialNumber: true, enableTemplates: true },
    ELECTRONICS: { mode: 'STRUCTURED', trackSerialNumber: true, enableTemplates: true },
    CONSTRUCTION: { mode: 'SIMPLE', trackSerialNumber: false, enableTemplates: false },
    GROCERY: { mode: 'SIMPLE', trackSerialNumber: false, enableTemplates: false },
  };
  // ============================ END NEW FILE: branchFeaturePresets.js ============================
  
  