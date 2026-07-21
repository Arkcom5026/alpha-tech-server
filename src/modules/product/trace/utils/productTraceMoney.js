const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'object' && typeof value.toNumber === 'function') {
    return value.toNumber()
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const roundMoney = (value) => {
  const number = toNumber(value)
  if (number === null) return null
  return Math.round((number + Number.EPSILON) * 100) / 100
}

const sumMoney = (values) => roundMoney(
  (Array.isArray(values) ? values : []).reduce((sum, value) => {
    const number = toNumber(value)
    return sum + (number || 0)
  }, 0)
)

const calculateMarginPercent = (profit, revenue) => {
  const p = toNumber(profit)
  const r = toNumber(revenue)
  if (p === null || r === null || r === 0) return null
  return roundMoney((p / r) * 100)
}

module.exports = {
  toNumber,
  roundMoney,
  sumMoney,
  calculateMarginPercent,
}
