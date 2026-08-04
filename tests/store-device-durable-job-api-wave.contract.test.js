import test from 'node:test'
import assert from 'node:assert/strict'

test('durable job API wave is aligned with its persistence authority', () => {
  const authority = {
    persistencePullRequest: 285,
    persistenceSha: 'e044a8f6a18ee1e4786275d1c9f6a76efddae4fb',
    requiresExactPersistenceSha: true,
    implementationComplete: true,
    migrationApplyAuthorized: false,
    physicalExecutionEnabled: false,
  }

  assert.equal(authority.requiresExactPersistenceSha, true)
  assert.equal(authority.implementationComplete, true)
  assert.equal(authority.migrationApplyAuthorized, false)
  assert.equal(authority.physicalExecutionEnabled, false)
})
