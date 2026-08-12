const assert = require('node:assert/strict')

const {
  normalizeTaxonomyLabel,
  isTaxonomyLabelCompatible,
} = require('../src/modules/product/templateClone/services/productTemplateCloneService')

assert.equal(
  normalizeTaxonomyLabel('คอมพิวเตอร์ / โน้ตบุ๊ก'),
  'คอมพิวเตอร์ โน้ตบุ๊ก'
)
assert.equal(
  normalizeTaxonomyLabel('คอมพิวเตอร์และโน้ตบุ๊ก'),
  'คอมพิวเตอร์ โน้ตบุ๊ก'
)
assert.equal(
  isTaxonomyLabelCompatible('คอมพิวเตอร์ / โน้ตบุ๊ก', 'คอมพิวเตอร์และโน้ตบุ๊ก'),
  true
)
assert.equal(
  isTaxonomyLabelCompatible('ลำโพง', 'คอมพิวเตอร์และโน้ตบุ๊ก'),
  false
)

console.log('Product Template Taxonomy Label Compatibility Contract: PASS')
