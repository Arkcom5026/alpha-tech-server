const fs = require('fs')
const path = require('path')

const target = path.join(process.cwd(), 'controllers', 'productController.js')

if (!fs.existsSync(target)) {
  console.error('controllers/productController.js not found. Run this script from alpha-tech-server root.')
  process.exit(1)
}

let text = fs.readFileSync(target, 'utf8')

const requiredImport = `const {
  findOperationalProductById,
  findOperationalProductByTemplateId,
  findOperationalProductsForPOS,
  findOperationalProductsForOnline,
  findOperationalProductOnlineById,
  getReadyToSell: getReadyToSellService,
  getReadyToSellStructuredDetails: getReadyToSellStructuredDetailsService,
} = require('../src/modules/product/services/operationalProductRuntimeService')`

const runtimeRequire = "require('../src/modules/product/services/operationalProductRuntimeService')"

if (text.includes(runtimeRequire)) {
  const requireIndex = text.indexOf(runtimeRequire)
  const constIndex = text.lastIndexOf('const {', requireIndex)

  if (constIndex === -1) {
    console.error('Runtime service require found, but import block start was not found.')
    process.exit(1)
  }

  let endIndex = text.indexOf('\n', requireIndex)
  if (endIndex === -1) endIndex = text.length

  text = text.slice(0, constIndex) + requiredImport + text.slice(endIndex)
} else {
  const prismaImport = "const { prisma, Prisma } = require('../lib/prisma')"
  if (!text.includes(prismaImport)) {
    console.error('Could not find prisma import insertion point.')
    process.exit(1)
  }

  text = text.replace(prismaImport, `${prismaImport}\n${requiredImport}`)
}

function findFunctionEnd(source, start) {
  const arrowIndex = source.indexOf('=>', start)
  if (arrowIndex === -1) throw new Error('Arrow function marker not found')

  const openBrace = source.indexOf('{', arrowIndex)
  if (openBrace === -1) throw new Error('Function open brace not found')

  let depth = 0
  let inString = null
  let escaped = false
  let inLineComment = false
  let inBlockComment = false

  for (let i = openBrace; i < source.length; i++) {
    const ch = source[i]
    const next = source[i + 1]

    if (inLineComment) {
      if (ch === '\n') inLineComment = false
      continue
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false
        i++
      }
      continue
    }

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === inString) {
        inString = null
      }
      continue
    }

    if (ch === '/' && next === '/') {
      inLineComment = true
      i++
      continue
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true
      i++
      continue
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch
      continue
    }

    if (ch === '{') depth++
    if (ch === '}') {
      depth--
      if (depth === 0) {
        let end = i + 1
        while (source[end] === '\r' || source[end] === '\n') end++
        return end
      }
    }
  }

  throw new Error('Function end not found')
}

function replaceFunction(source, functionName, replacement) {
  const start = source.indexOf(`const ${functionName} = async`)
  if (start === -1) {
    throw new Error(`Function not found: ${functionName}`)
  }

  const end = findFunctionEnd(source, start)
  return source.slice(0, start) + replacement.trimEnd() + '\n\n' + source.slice(end)
}

const getProductsForPos = `const getProductsForPos = async (req, res) => {
  try {
    const result = await findOperationalProductsForPOS({
      branchId: req.user?.branchId,
      search: req.query.search || req.query.searchText || '',
      take: req.query.take,
      page: req.query.page,
      productTypeId: req.query.productTypeId,
      brandId: req.query.brandId,
      readyOnly: req.query.readyOnly,
      hasPrice: req.query.hasPrice,
      activeOnly: req.query.activeOnly,
      includeInactive: req.query.includeInactive,
      mode: req.query.mode,
      simpleOnly: req.query.simpleOnly,
    })

    return res.json(result)
  } catch (error) {
    if (error?.code === 'unauthorized') return res.status(401).json({ error: 'unauthorized' })

    console.error('❌ getProductsForPos error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}`

const getProductsForOnline = `const getProductsForOnline = async (req, res) => {
  try {
    const result = await findOperationalProductsForOnline({
      branchId: Number(req.user?.branchId) || toInt(req.query.branchId),
      search: req.query.search || req.query.searchText || '',
      take: req.query.take,
      size: req.query.size,
      page: req.query.page,
      productTypeId: req.query.productTypeId,
      brandId: req.query.brandId,
      readyOnly: req.query.readyOnly,
      hasPrice: req.query.hasPrice,
      mode: req.query.mode,
      simpleOnly: req.query.simpleOnly,
    })

    return res.json(result)
  } catch (error) {
    if (error?.code === 'BRANCH_REQUIRED') return res.status(400).json({ error: 'BRANCH_REQUIRED' })

    console.error('❌ getProductsForOnline error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}`

const getProductPosById = `const getProductPosById = async (req, res) => {
  try {
    const result = await findOperationalProductById({
      branchId: req.user?.branchId,
      productId: req.params.id,
    })

    return res.json(result)
  } catch (error) {
    if (error?.code === 'unauthorized') return res.status(401).json({ error: 'unauthorized' })
    if (error?.code === 'INVALID_ID') return res.status(400).json({ error: 'INVALID_ID' })
    if (error?.code === 'NOT_FOUND') return res.status(404).json({ error: 'NOT_FOUND' })

    console.error('❌ getProductPosById error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}`

const getProductOnlineById = `const getProductOnlineById = async (req, res) => {
  try {
    const result = await findOperationalProductOnlineById({
      branchId: toInt(req.query.branchId) ?? Number(req.user?.branchId),
      productId: req.params.id,
    })

    return res.json(result)
  } catch (error) {
    if (error?.code === 'BRANCH_REQUIRED') return res.status(400).json({ error: 'BRANCH_REQUIRED' })
    if (error?.code === 'INVALID_ID') return res.status(400).json({ error: 'INVALID_ID' })
    if (error?.code === 'NOT_FOUND') return res.status(404).json({ error: 'NOT_FOUND' })

    console.error('❌ getProductOnlineById error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}`

const replacements = [
  ['getProductsForPos', getProductsForPos],
  ['getProductsForOnline', getProductsForOnline],
  ['getProductPosById', getProductPosById],
  ['getProductOnlineById', getProductOnlineById],
]

for (const [name, replacement] of replacements) {
  text = replaceFunction(text, name, replacement)
}

fs.writeFileSync(target, text, 'utf8')

console.log('Mission B controller adapter corrective patch applied.')
console.log('Updated: controllers/productController.js')
