const normalizeCatalogText = (value) =>
  String(value || '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('th-TH')
    .replace(/[^\p{L}\p{N}]+/gu, '')

const tokenizeCatalogText = (value) =>
  String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('th-TH')
    .split(/[^\p{L}\p{N}]+/gu)
    .map((token) => token.trim())
    .filter(Boolean)

const extractModelTokens = (product) =>
  Array.from(
    new Set(
      tokenizeCatalogText(product?.name).filter(
        (token) => token.length >= 3 && /\d/u.test(token)
      )
    )
  )

const jaccardSimilarity = (leftTokens, rightTokens) => {
  const left = new Set(leftTokens)
  const right = new Set(rightTokens)
  if (!left.size || !right.size) return 0
  let intersection = 0
  for (const token of left) if (right.has(token)) intersection += 1
  return intersection / (left.size + right.size - intersection)
}

const nameSimilarity = (left, right) => {
  const compactLeft = normalizeCatalogText(left)
  const compactRight = normalizeCatalogText(right)
  if (!compactLeft || !compactRight) return 0
  if (compactLeft === compactRight) return 1
  return jaccardSimilarity(tokenizeCatalogText(left), tokenizeCatalogText(right))
}

const sameBrand = (left, right) => {
  if (left?.brandId && right?.brandId) return Number(left.brandId) === Number(right.brandId)
  const a = normalizeCatalogText(left?.brand?.normalizedName || left?.brand?.name)
  const b = normalizeCatalogText(right?.brand?.normalizedName || right?.brand?.name)
  return Boolean(a && b && a === b)
}

const sameUnit = (left, right) => {
  if (left?.unitId && right?.unitId) return Number(left.unitId) === Number(right.unitId)
  const a = normalizeCatalogText(left?.unit?.name)
  const b = normalizeCatalogText(right?.unit?.name)
  return Boolean(a && b && a === b)
}

const scoreDuplicatePair = (left, right) => {
  const leftGlobalType = Number(left?.productType?.globalProductTypeId) || null
  const rightGlobalType = Number(right?.productType?.globalProductTypeId) || null
  const sameGlobalProductType = Boolean(
    leftGlobalType && rightGlobalType && leftGlobalType === rightGlobalType
  )
  const brandMatch = sameBrand(left, right)
  const unitMatch = sameUnit(left, right)
  const leftBarcode = String(left?.saleBarcode || '').trim()
  const rightBarcode = String(right?.saleBarcode || '').trim()
  const barcodeMatch = Boolean(leftBarcode && rightBarcode && leftBarcode === rightBarcode)
  const similarity = nameSimilarity(left?.name, right?.name)
  const exactName = similarity === 1
  const leftModels = extractModelTokens(left)
  const rightModels = extractModelTokens(right)
  const sharedModelTokens = leftModels.filter((token) => rightModels.includes(token))
  const modelMatch = sharedModelTokens.length > 0

  const signals = {
    saleBarcode: barcodeMatch,
    globalProductTypeId: sameGlobalProductType,
    brand: brandMatch,
    unit: unitMatch,
    exactName,
    nameSimilarity: Number(similarity.toFixed(4)),
    modelTokens: sharedModelTokens,
  }

  let confidence = null
  let reason = null

  if (barcodeMatch) {
    confidence = 'STRONG'
    reason = 'EXACT_SALE_BARCODE'
  } else if (sameGlobalProductType && brandMatch && exactName) {
    confidence = 'STRONG'
    reason = 'EXACT_CATALOG_IDENTITY'
  } else if (sameGlobalProductType && brandMatch && modelMatch && similarity >= 0.5) {
    confidence = 'LIKELY'
    reason = 'MODEL_AND_NAME_SIMILARITY'
  }

  return {
    candidate: Boolean(confidence),
    confidence,
    reason,
    signals,
  }
}

const addBucket = (buckets, key, product) => {
  if (!key) return
  const current = buckets.get(key) || []
  current.push(product)
  buckets.set(key, current)
}

const buildCandidateBuckets = (products = []) => {
  const buckets = new Map()
  for (const product of products) {
    const globalTypeId = Number(product?.productType?.globalProductTypeId) || null
    const brand = product?.brandId
      ? `id:${Number(product.brandId)}`
      : `name:${normalizeCatalogText(product?.brand?.normalizedName || product?.brand?.name)}`
    const barcode = String(product?.saleBarcode || '').trim()
    const compactName = normalizeCatalogText(product?.name)

    if (barcode) addBucket(buckets, `barcode:${barcode}`, product)
    if (globalTypeId && compactName) {
      addBucket(buckets, `identity:${globalTypeId}:${brand}:${compactName}`, product)
    }
    if (globalTypeId) {
      for (const modelToken of extractModelTokens(product)) {
        addBucket(buckets, `model:${globalTypeId}:${brand}:${modelToken}`, product)
      }
    }
  }
  return buckets
}

const buildAssessedDuplicatePairs = (products = []) => {
  const buckets = buildCandidateBuckets(products)
  const seen = new Set()
  const pairs = []

  for (const group of buckets.values()) {
    if (group.length < 2) continue
    const sorted = [...group].sort((a, b) => Number(a.id) - Number(b.id))
    for (let i = 0; i < sorted.length - 1; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const left = sorted[i]
        const right = sorted[j]
        const pairKey = `${left.id}:${right.id}`
        if (seen.has(pairKey)) continue
        seen.add(pairKey)
        const assessment = scoreDuplicatePair(left, right)
        if (!assessment.candidate) continue
        pairs.push({ primary: left, comparison: right, assessment })
      }
    }
  }

  return pairs
}

module.exports = {
  normalizeCatalogText,
  tokenizeCatalogText,
  extractModelTokens,
  jaccardSimilarity,
  nameSimilarity,
  scoreDuplicatePair,
  buildCandidateBuckets,
  buildAssessedDuplicatePairs,
}
