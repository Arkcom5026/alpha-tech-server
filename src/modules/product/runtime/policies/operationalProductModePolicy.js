const normalizeBoolean = (value) => {
  return value === true || value === 'true' || value === 1 || value === '1'
}

const decideOperationalProductMode = ({
  explicitMode,
  noSN,
  trackSerialNumber,
} = {}) => {
  const mode = explicitMode == null ? '' : String(explicitMode).trim().toUpperCase()

  if (mode === 'SIMPLE' || mode === 'NOSN' || mode === 'NO_SN' || mode === 'NO-SN') {
    return { mode: 'SIMPLE', noSN: true, trackSerialNumber: false }
  }

  if (mode === 'STRUCTURED' || mode === 'SN') {
    return { mode: 'STRUCTURED', noSN: false, trackSerialNumber: true }
  }

  if (trackSerialNumber !== undefined && normalizeBoolean(trackSerialNumber)) {
    return { mode: 'STRUCTURED', noSN: false, trackSerialNumber: true }
  }

  if (noSN !== undefined && normalizeBoolean(noSN)) {
    return { mode: 'SIMPLE', noSN: true, trackSerialNumber: false }
  }

  return { mode: 'SIMPLE', noSN: true, trackSerialNumber: false }
}

module.exports = {
  decideOperationalProductMode,
}
