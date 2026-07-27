require('dotenv').config()

const baseUrl = String(process.env.OPERATIONAL_API_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
const token = String(process.env.OPERATIONAL_AUTH_TOKEN || '').trim()
const branchId = String(process.env.OPERATIONAL_BRANCH_ID || '').trim()
const configuredProductId = String(process.env.OPERATIONAL_PRODUCT_ID || '').trim()
const configuredTemplateProductId = String(process.env.OPERATIONAL_TEMPLATE_PRODUCT_ID || '').trim()
const allowMutation = String(process.env.OPERATIONAL_ALLOW_MUTATION || '').toLowerCase() === 'true'

const isPlaceholder = (value) => !value || /^<.*>$/.test(value)
const hasToken = !isPlaceholder(token)
const hasBranchId = !isPlaceholder(branchId)

const parseJsonEnv = (name) => {
  const raw = String(process.env[name] || '').trim()
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (error) {
    throw new Error(`${name} must contain valid JSON: ${error.message}`)
  }
}

const localCreatePayload = parseJsonEnv('OPERATIONAL_CREATE_LOCAL_JSON')
const templateCreatePayload = parseJsonEnv('OPERATIONAL_CREATE_FROM_TEMPLATE_JSON')
const updatePayload = parseJsonEnv('OPERATIONAL_UPDATE_PRODUCT_JSON')

const results = []

const request = async ({ name, path, method = 'GET', auth = false, body, expected = [200] }) => {
  if (auth && !hasToken) {
    results.push({ name, status: 'SKIP', detail: 'OPERATIONAL_AUTH_TOKEN is missing or still a placeholder' })
    return null
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(auth ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await response.text()
  let payload = text
  try {
    payload = text ? JSON.parse(text) : null
  } catch (_) {}

  if (!expected.includes(response.status)) {
    const detail = typeof payload === 'string' ? payload : JSON.stringify(payload)
    results.push({ name, status: 'FAIL', detail: `HTTP ${response.status}: ${detail}` })
    return null
  }

  results.push({ name, status: 'PASS', detail: `HTTP ${response.status}` })
  return payload
}

const findFirstValue = (payload, keys) => {
  const visited = new Set()

  const walk = (value) => {
    if (!value || typeof value !== 'object' || visited.has(value)) return null
    visited.add(value)

    if (!Array.isArray(value)) {
      for (const key of keys) {
        const candidate = value[key]
        if (candidate !== undefined && candidate !== null && String(candidate).trim()) {
          return String(candidate).trim()
        }
      }
    }

    const children = Array.isArray(value) ? value : Object.values(value)
    for (const child of children) {
      const found = walk(child)
      if (found) return found
    }

    return null
  }

  return walk(payload)
}

const main = async () => {
  let productId = isPlaceholder(configuredProductId) ? '' : configuredProductId
  let templateProductId = isPlaceholder(configuredTemplateProductId) ? '' : configuredTemplateProductId

  let onlineSearchPayload = null
  if (hasBranchId) {
    onlineSearchPayload = await request({
      name: 'Online product search',
      path: `/api/products/online/search?limit=1&branchId=${encodeURIComponent(branchId)}`,
      expected: [200],
    })
  } else {
    results.push({ name: 'Online product search', status: 'SKIP', detail: 'OPERATIONAL_BRANCH_ID is missing or still a placeholder' })
  }

  const posSearchPayload = await request({
    name: 'POS product search',
    path: '/api/products/pos/search?limit=1',
    auth: true,
    expected: [200],
  })

  if (!productId) {
    productId = findFirstValue(posSearchPayload, ['operationalProductId', 'productId', 'id'])
      || findFirstValue(onlineSearchPayload, ['operationalProductId', 'productId', 'id'])
      || ''
  }

  if (!templateProductId) {
    templateProductId = findFirstValue(posSearchPayload, ['templateProductId', 'productTemplateId', 'templateId'])
      || findFirstValue(onlineSearchPayload, ['templateProductId', 'productTemplateId', 'templateId'])
      || ''
  }

  if (productId && hasBranchId) {
    await request({
      name: 'Online product detail',
      path: `/api/products/online/detail/${encodeURIComponent(productId)}?branchId=${encodeURIComponent(branchId)}`,
      expected: [200],
    })
  } else {
    results.push({ name: 'Online product detail', status: 'SKIP', detail: 'No product was returned by search' })
  }

  if (productId) {
    await request({
      name: 'POS product detail',
      path: `/api/products/pos/${encodeURIComponent(productId)}`,
      auth: true,
      expected: [200],
    })
  } else {
    results.push({ name: 'POS product detail', status: 'SKIP', detail: 'No product was returned by search' })
  }

  if (templateProductId) {
    await request({
      name: 'Runtime lookup by template',
      path: `/api/products/pos/runtime-by-template/${encodeURIComponent(templateProductId)}`,
      auth: true,
      expected: [200, 404],
    })
  } else {
    results.push({ name: 'Runtime lookup by template', status: 'SKIP', detail: 'No template ID was returned by search' })
  }

  await request({
    name: 'Ready-to-sell list',
    path: '/api/products/ready-to-sell?limit=1',
    auth: true,
    expected: [200],
  })

  if (productId) {
    await request({
      name: 'Ready-to-sell detail',
      path: `/api/products/ready-to-sell/structured/${encodeURIComponent(productId)}`,
      auth: true,
      expected: [200, 404],
    })
  } else {
    results.push({ name: 'Ready-to-sell detail', status: 'SKIP', detail: 'No product was returned by search' })
  }

  await request({
    name: 'Quick Receipt list',
    path: '/api/quick-stock/receipts?limit=1',
    auth: true,
    expected: [200],
  })

  if (allowMutation && localCreatePayload) {
    await request({
      name: 'Create local product',
      path: '/api/products/pos/create-local',
      method: 'POST',
      auth: true,
      body: localCreatePayload,
      expected: [201],
    })
  } else {
    results.push({ name: 'Create local product', status: 'SKIP', detail: 'Mutation disabled or payload missing' })
  }

  if (allowMutation && templateCreatePayload) {
    await request({
      name: 'Create product from template',
      path: '/api/products/pos/create-from-template',
      method: 'POST',
      auth: true,
      body: templateCreatePayload,
      expected: [200, 201],
    })
  } else {
    results.push({ name: 'Create product from template', status: 'SKIP', detail: 'Mutation disabled or payload missing' })
  }

  if (allowMutation && updatePayload && productId) {
    await request({
      name: 'Update product',
      path: `/api/products/${encodeURIComponent(productId)}`,
      method: 'PATCH',
      auth: true,
      body: updatePayload,
      expected: [200],
    })
  } else {
    results.push({ name: 'Update product', status: 'SKIP', detail: 'Mutation disabled, payload missing, or product ID missing' })
  }

  console.table(results)

  if (productId) console.log(`[operational] resolved product ID: ${productId}`)
  if (templateProductId) console.log(`[operational] resolved template ID: ${templateProductId}`)

  const failed = results.filter((result) => result.status === 'FAIL')
  const skipped = results.filter((result) => result.status === 'SKIP')

  if (failed.length) {
    throw new Error(`Product operational smoke failed: ${failed.length} check(s) failed`)
  }

  if (skipped.length) {
    console.log(`[operational] PASS WITH SKIPS: ${skipped.length} optional or unconfigured check(s)`)
  } else {
    console.log('[operational] PASS: all configured Product checks completed')
  }
}

main().catch((error) => {
  console.error('[operational] FAIL:', error.message)
  process.exitCode = 1
})
