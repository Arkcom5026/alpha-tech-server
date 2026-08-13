'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'src/modules/product/templateReverseClone/services/storeProductTemplateReverseCloneImageService.js'),
  'utf8',
)

assert.match(source, /require\('\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/utils\/cloudinary'\)/)

console.log('Store Product Template Reverse Clone Image Import Contract: PASS')
