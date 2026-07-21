const toIsoString = (value) => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const compareOccurredAt = (left, right) => {
  const leftTime = left?.occurredAt ? new Date(left.occurredAt).getTime() : 0
  const rightTime = right?.occurredAt ? new Date(right.occurredAt).getTime() : 0
  return leftTime - rightTime
}

module.exports = {
  toIsoString,
  compareOccurredAt,
}
