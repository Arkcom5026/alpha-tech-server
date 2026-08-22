'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  RESIDUAL_POSITION_CAPABILITIES,
} = require('../../employee/authorization/residualPositionAuthority');

test('position runtime accepts the grouped residual capability catalog', () => {
  const source = fs.readFileSync(path.join(__dirname, 'positionRuntimeService.js'), 'utf8');
  assert.match(source, /RESIDUAL_POSITION_CAPABILITIES/);
  assert.match(source, /Object\.values\(RESIDUAL_POSITION_CAPABILITIES\)/);
  assert.equal(Object.values(RESIDUAL_POSITION_CAPABILITIES).length, 8);
});
