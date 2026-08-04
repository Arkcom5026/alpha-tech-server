const GROUP_REVIEW_STATUS = Object.freeze({
  READY: 'READY',
  PRODUCT_TYPE_REVIEW_REQUIRED: 'PRODUCT_TYPE_REVIEW_REQUIRED',
})

const normalizeGroupText = (value) =>
  String(value || '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('th-TH')
    .replace(/[^\p{L}\p{N}]+/gu, '')

const buildCandidateGroupKey = (item) => {
  const sourceProduct = item?.sourceProduct || {}
  const name = normalizeGroupText(sourceProduct.name)
  const brand = normalizeGroupText(sourceProduct.brandName)
  if (!name) return null
  return `${brand || 'no-brand'}:${name}`
}

const uniqueSortedNumbers = (values) =>
  [...new Set(values.filter((value) => Number.isInteger(Number(value))).map(Number))]
    .sort((a, b) => a - b)

const groupUnmatchedDiscoveryItems = (items = []) => {
  const groupsByKey = new Map()

  for (const item of items) {
    const groupKey = buildCandidateGroupKey(item)
    if (!groupKey) continue

    const sourceProduct = item.sourceProduct || {}
    if (!groupsByKey.has(groupKey)) {
      groupsByKey.set(groupKey, {
        groupKey,
        canonicalName: sourceProduct.name || null,
        canonicalBrandName: sourceProduct.brandName || null,
        sourceProducts: [],
      })
    }

    groupsByKey.get(groupKey).sourceProducts.push({
      id: sourceProduct.id,
      name: sourceProduct.name || null,
      branchId: sourceProduct.branchId || null,
      branchName: sourceProduct.branchName || null,
      productTypeId: sourceProduct.productTypeId || null,
      globalProductTypeId: sourceProduct.globalProductTypeId || null,
      productTypeName: sourceProduct.productTypeName || null,
      brandId: sourceProduct.brandId || null,
      brandName: sourceProduct.brandName || null,
      unitId: sourceProduct.unitId || null,
      unitName: sourceProduct.unitName || null,
    })
  }

  return [...groupsByKey.values()]
    .map((group) => {
      const sourceBranchIds = uniqueSortedNumbers(
        group.sourceProducts.map((product) => product.branchId)
      )
      const globalProductTypeIds = uniqueSortedNumbers(
        group.sourceProducts.map((product) => product.globalProductTypeId)
      )
      const hasMissingProductType = group.sourceProducts.some(
        (product) => !product.globalProductTypeId
      )
      const reviewStatus =
        hasMissingProductType || globalProductTypeIds.length !== 1
          ? GROUP_REVIEW_STATUS.PRODUCT_TYPE_REVIEW_REQUIRED
          : GROUP_REVIEW_STATUS.READY

      return {
        ...group,
        sourceProductCount: group.sourceProducts.length,
        sourceBranchCount: sourceBranchIds.length,
        sourceBranchIds,
        globalProductTypeIds,
        reviewStatus,
        reviewReasons: [
          ...(hasMissingProductType ? ['MISSING_GLOBAL_PRODUCT_TYPE'] : []),
          ...(globalProductTypeIds.length > 1 ? ['CONFLICTING_GLOBAL_PRODUCT_TYPE'] : []),
        ],
      }
    })
    .sort((left, right) => {
      if (right.sourceBranchCount !== left.sourceBranchCount) {
        return right.sourceBranchCount - left.sourceBranchCount
      }
      if (right.sourceProductCount !== left.sourceProductCount) {
        return right.sourceProductCount - left.sourceProductCount
      }
      return left.groupKey.localeCompare(right.groupKey)
    })
}

module.exports = {
  GROUP_REVIEW_STATUS,
  normalizeGroupText,
  buildCandidateGroupKey,
  groupUnmatchedDiscoveryItems,
}
