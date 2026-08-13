'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'scripts/backfill-store-products-to-template.js'),
  'utf8',
)

assert.match(source, /reverseCloneStoreProductToMatchingTemplate/)
assert.match(source, /templateProductId: null/)
assert.match(source, /id: \{ gt: Number\(afterId\) \|\| 0 \}/)
assert.match(source, /orderBy: \{ id: 'asc' \}/)
assert.match(source, /remainingUnlinked/)
assert.match(source, /completed = summary\.after\.unlinkedProducts === 0/)

assert.match(source, /const dryRun = Boolean\(args\['dry-run'\]\) \|\| !execute/)
assert.match(source, /mutation: 'NONE'/)
assert.match(source, /--confirm-branches must exactly match --branches when using --execute/)
assert.match(source, /Missing employee mapping for branch/)
assert.match(source, /active: true/)
assert.match(source, /approved: true/)

assert.match(source, /--max-items/)
assert.match(source, /MAX_BATCH_SIZE = 100/)
assert.match(source, /if \(maxItems && summary\.attempted >= maxItems\)/)
assert.match(source, /if \(require\.main === module\)/)

assert.doesNotMatch(source, /ALLOWED_BRANCHES/)
assert.doesNotMatch(source, /Only branch 2 and 5 are allowed/)
assert.doesNotMatch(source, /candidate|promoteCandidate|materializeDiscovery/)

console.log('Store Product Template Reverse Clone Backfill Contract: PASS')
