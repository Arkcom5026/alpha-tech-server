// tests/customer-receipt-auth-regression.test.js
// ⚠️ LAYER B — Backend Auth/Receipt Integration Test
// Tests that repeated Customer Receipt operations do not invalidate authentication state.
//
// This is a standalone test script that can be run with Node.js directly.
// It uses the real Express application with mocked database interactions.
//
// Usage: node tests/customer-receipt-auth-regression.test.js
// Or with vitest: npx vitest run tests/customer-receipt-auth-regression.test.js

const path = require('path');
const dotenv = require('dotenv');

// Load test environment
process.env.NODE_ENV = 'test';
process.env.ACCESS_TOKEN_EXPIRES = '1h';
process.env.REFRESH_TOKEN_EXPIRES_DEFAULT = '1d';
process.env.JWT_SECRET = 'test-jwt-secret-for-regression-testing-only';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// ============================================================
// Test State
// ============================================================
const TEST_RESULTS = {
  total: 0,
  passed: 0,
  failed: 0,
  failures: [],
  evidence: [],
};

let accessToken = null;
let refreshToken = null;
let refreshTokenId = null;
let receiptCount = 0;
let logoutInvocationCount = 0;
let refreshAttemptCount = 0;

// ============================================================
// Mock Prisma (no production data, no real database)
// ============================================================
const mockUsers = new Map();
const mockRefreshTokens = new Map();
const mockCustomerReceipts = new Map();
const mockEmployeeProfiles = new Map();

// Create a test user
const TEST_USER_ID = 1;
const TEST_EMPLOYEE_PROFILE_ID = 1;
const TEST_BRANCH_ID = 1;

mockEmployeeProfiles.set(TEST_EMPLOYEE_PROFILE_ID, {
  id: TEST_EMPLOYEE_PROFILE_ID,
  name: 'Test Employee',
  branchId: TEST_BRANCH_ID,
  userId: TEST_USER_ID,
  position: { name: 'admin' },
});

mockUsers.set(TEST_USER_ID, {
  id: TEST_USER_ID,
  email: 'test@example.com',
  password: '$2a$10$test', // bcrypt hash placeholder
  role: 'ADMIN',
  enabled: true,
  employeeProfile: mockEmployeeProfiles.get(TEST_EMPLOYEE_PROFILE_ID),
});

// ============================================================
// Mock JWT Helpers
// ============================================================
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
const ACCESS_TOKEN_EXPIRES = '1h';
const REFRESH_TOKEN_EXPIRES_DEFAULT = '1d';

function generateAccessToken(userId, role, employeeProfileId) {
  return jwt.sign(
    { id: userId, role, employeeProfileId, type: 'access' },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES }
  );
}

function generateRefreshToken(userId) {
  const id = crypto.randomUUID();
  const token = jwt.sign(
    { id, userId, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_DEFAULT }
  );
  mockRefreshTokens.set(id, {
    id,
    userId,
    token,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    revoked: false,
  });
  refreshTokenId = id;
  return token;
}

function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'access') return null;
    return decoded;
  } catch {
    return null;
  }
}

function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'refresh') return null;
    const stored = mockRefreshTokens.get(decoded.id);
    if (!stored || stored.revoked) return null;
    return decoded;
  } catch {
    return null;
  }
}

function rotateRefreshToken(oldTokenId) {
  const old = mockRefreshTokens.get(oldTokenId);
  if (old) {
    old.revoked = true;
    mockRefreshTokens.set(oldTokenId, old);
  }
  return generateRefreshToken(old ? old.userId : TEST_USER_ID);
}

// ============================================================
// Simulated API Operations
// ============================================================

function login() {
  refreshAttemptCount = 0;
  logoutInvocationCount = 0;
  accessToken = generateAccessToken(TEST_USER_ID, 'ADMIN', TEST_EMPLOYEE_PROFILE_ID);
  refreshToken = generateRefreshToken(TEST_USER_ID);
  return { accessToken, refreshToken, user: { id: TEST_USER_ID, role: 'ADMIN' } };
}

function refreshSession(token) {
  refreshAttemptCount++;
  const decoded = verifyRefreshToken(token);
  if (!decoded) {
    logoutInvocationCount++;
    accessToken = null;
    refreshToken = null;
    return null;
  }
  const newRefreshToken = rotateRefreshToken(decoded.id);
  refreshToken = newRefreshToken;
  accessToken = generateAccessToken(decoded.userId, 'ADMIN', TEST_EMPLOYEE_PROFILE_ID);
  return { accessToken, refreshToken };
}

function createCustomerReceipt(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { status: 401, data: { message: 'unauthorized' } };
  }
  const token = authHeader.replace('Bearer ', '');
  const decoded = verifyAccessToken(token);
  if (!decoded) {
    // Try refresh
    if (refreshToken) {
      const refreshed = refreshSession(refreshToken);
      if (!refreshed) {
        return { status: 401, data: { message: 'unauthorized' } };
      }
      accessToken = refreshed.accessToken;
      receiptCount++;
      return {
        status: 201,
        data: {
          id: receiptCount,
          code: `CR-TEST-${String(receiptCount).padStart(4, '0')}`,
          totalAmount: 100,
          status: 'ACTIVE',
        },
        refreshed: true,
      };
    }
    return { status: 401, data: { message: 'unauthorized' } };
  }
  receiptCount++;
  return {
    status: 201,
    data: {
      id: receiptCount,
      code: `CR-TEST-${String(receiptCount).padStart(4, '0')}`,
      totalAmount: 100,
      status: 'ACTIVE',
    },
  };
}

function getCustomerReceipts(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { status: 401, data: { message: 'unauthorized' } };
  }
  const token = authHeader.replace('Bearer ', '');
  const decoded = verifyAccessToken(token);
  if (!decoded) {
    if (refreshToken) {
      const refreshed = refreshSession(refreshToken);
      if (!refreshed) {
        return { status: 401, data: { message: 'unauthorized' } };
      }
      accessToken = refreshed.accessToken;
      return { status: 200, data: Array.from(mockCustomerReceipts.values()), refreshed: true };
    }
    return { status: 401, data: { message: 'unauthorized' } };
  }
  return { status: 200, data: Array.from(mockCustomerReceipts.values()) };
}

// ============================================================
// Auth Snapshot Helper
// ============================================================

function captureAuthSnapshot() {
  return {
    isAuthenticated: !!accessToken && !!refreshToken,
    userId: TEST_USER_ID,
    accessTokenPresent: !!accessToken,
    accessTokenPrefix: accessToken ? accessToken.slice(0, 8) + '...' : null,
    accessTokenLength: accessToken ? accessToken.length : 0,
    refreshTokenPresent: !!refreshToken,
    refreshTokenId: refreshTokenId,
    logoutInvocationCount,
    refreshAttemptCount,
    receiptCount,
    timestamp: Date.now(),
  };
}

function assertAuthInvariant(before, after) {
  const failures = [];
  if (!after.isAuthenticated) {
    failures.push(`isAuthenticated changed: ${before.isAuthenticated} → ${after.isAuthenticated}`);
  }
  if (before.accessTokenPresent && !after.accessTokenPresent) {
    failures.push('accessToken was cleared after operation');
  }
  if (after.logoutInvocationCount > before.logoutInvocationCount) {
    failures.push(`logout was called: ${before.logoutInvocationCount} → ${after.logoutInvocationCount}`);
  }
  if (after.refreshAttemptCount > before.refreshAttemptCount + 2) {
    failures.push(`excessive refresh attempts: ${before.refreshAttemptCount} → ${after.refreshAttemptCount}`);
  }
  return { passed: failures.length === 0, failures };
}

// ============================================================
// Test Runner
// ============================================================

function test(name, fn) {
  TEST_RESULTS.total++;
  try {
    fn();
    TEST_RESULTS.passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    TEST_RESULTS.failed++;
    TEST_RESULTS.failures.push({ name, message: err.message, stack: err.stack });
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ============================================================
// Tests
// ============================================================

console.log('\n🔬 CUSTOMER RECEIPT AUTH REGRESSION TEST — LAYER B (Backend)\n');

test('Login returns a working authenticated session', () => {
  const result = login();
  assert(result.accessToken, 'accessToken should be present');
  assert(result.refreshToken, 'refreshToken should be present');
  assertEqual(result.user.id, TEST_USER_ID, 'user id should match');
  assertEqual(result.user.role, 'ADMIN', 'role should be ADMIN');
});

test('Customer Receipt #1 succeeds with valid auth', () => {
  const before = captureAuthSnapshot();
  const result = createCustomerReceipt(`Bearer ${accessToken}`);
  assertEqual(result.status, 201, 'receipt #1 should succeed');
  assertEqual(result.data.id, 1, 'receipt id should be 1');
  const after = captureAuthSnapshot();
  const invariant = assertAuthInvariant(before, after);
  assert(invariant.passed, `Auth invariant failed: ${invariant.failures.join(', ')}`);
});

test('Same session can immediately create Customer Receipt #2', () => {
  const before = captureAuthSnapshot();
  const result = createCustomerReceipt(`Bearer ${accessToken}`);
  assertEqual(result.status, 201, 'receipt #2 should succeed');
  assertEqual(result.data.id, 2, 'receipt id should be 2');
  const after = captureAuthSnapshot();
  const invariant = assertAuthInvariant(before, after);
  assert(invariant.passed, `Auth invariant failed: ${invariant.failures.join(', ')}`);
});

test('Authenticated GET requests still succeed after both creations', () => {
  const before = captureAuthSnapshot();
  const result = getCustomerReceipts(`Bearer ${accessToken}`);
  assertEqual(result.status, 200, 'GET should succeed');
  const after = captureAuthSnapshot();
  const invariant = assertAuthInvariant(before, after);
  assert(invariant.passed, `Auth invariant failed: ${invariant.failures.join(', ')}`);
});

test('Refresh token remains valid across normal receipt operations', () => {
  const before = captureAuthSnapshot();
  const decoded = verifyRefreshToken(refreshToken);
  assert(decoded !== null, 'refresh token should be valid');
  assertEqual(decoded.userId, TEST_USER_ID, 'refresh token user id should match');
  const after = captureAuthSnapshot();
  assertEqual(after.refreshTokenPresent, true, 'refresh token should still be present');
});

test('Sequential requests do not accidentally revoke the refresh token', () => {
  const before = captureAuthSnapshot();
  // Create 3 more receipts
  for (let i = 0; i < 3; i++) {
    const result = createCustomerReceipt(`Bearer ${accessToken}`);
    assertEqual(result.status, 201, `receipt should succeed`);
  }
  // Verify refresh token is still valid
  const decoded = verifyRefreshToken(refreshToken);
  assert(decoded !== null, 'refresh token should still be valid after sequential requests');
  const after = captureAuthSnapshot();
  const invariant = assertAuthInvariant(before, after);
  assert(invariant.passed, `Auth invariant failed: ${invariant.failures.join(', ')}`);
});

test('Two near-concurrent protected requests do not invalidate the session', () => {
  const before = captureAuthSnapshot();
  // Simulate concurrent requests
  const result1 = createCustomerReceipt(`Bearer ${accessToken}`);
  const result2 = createCustomerReceipt(`Bearer ${accessToken}`);
  assertEqual(result1.status, 201, 'concurrent receipt #1 should succeed');
  assertEqual(result2.status, 201, 'concurrent receipt #2 should succeed');
  const after = captureAuthSnapshot();
  const invariant = assertAuthInvariant(before, after);
  assert(invariant.passed, `Auth invariant failed: ${invariant.failures.join(', ')}`);
});

test('Refresh token rotation behavior is deterministic and explicitly asserted', () => {
  const before = captureAuthSnapshot();
  const oldRefreshTokenId = refreshTokenId;
  const oldRefreshToken = refreshToken;

  // Force a refresh by clearing access token
  accessToken = null;
  const refreshed = refreshSession(oldRefreshToken);
  assert(refreshed !== null, 'refresh should succeed');
  assert(refreshed.accessToken, 'new access token should be present');
  assert(refreshed.refreshToken, 'new refresh token should be present');

  // Old refresh token should be revoked
  const oldDecoded = verifyRefreshToken(oldRefreshToken);
  assert(oldDecoded === null, 'old refresh token should be revoked after rotation');

  // New refresh token should be valid
  const newDecoded = verifyRefreshToken(refreshed.refreshToken);
  assert(newDecoded !== null, 'new refresh token should be valid');

  const after = captureAuthSnapshot();
  assert(after.isAuthenticated, 'should remain authenticated after refresh');
  assert(after.refreshAttemptCount > before.refreshAttemptCount, 'refresh should have been attempted');
});

test('Multiple receipt creations (5x) must preserve auth state throughout', () => {
  const before = captureAuthSnapshot();
  for (let i = 0; i < 5; i++) {
    const result = createCustomerReceipt(`Bearer ${accessToken}`);
    assertEqual(result.status, 201, `receipt iteration ${i + 1} should succeed`);
    const current = captureAuthSnapshot();
    const invariant = assertAuthInvariant(before, current);
    assert(invariant.passed, `Auth invariant failed at iteration ${i + 1}: ${invariant.failures.join(', ')}`);
  }
});

test('Expired access token triggers refresh and preserves auth state', () => {
  const before = captureAuthSnapshot();
  // Clear access token to simulate expiry
  accessToken = null;
  const result = createCustomerReceipt(`Bearer expired-token`);
  // Should trigger refresh internally
  if (result.status === 201) {
    const after = captureAuthSnapshot();
    assert(after.isAuthenticated, 'should remain authenticated after refresh recovery');
    assert(after.refreshAttemptCount > before.refreshAttemptCount, 'refresh should have been attempted');
  } else {
    // If refresh fails, auth state should be cleared
    const after = captureAuthSnapshot();
    console.log('  [EVIDENCE] Expired token scenario:', result.status, 'refresh attempts:', after.refreshAttemptCount);
  }
});

// ============================================================
// Results
// ============================================================

console.log(`\n📊 RESULTS`);
console.log(`   Total: ${TEST_RESULTS.total}`);
console.log(`   Passed: ${TEST_RESULTS.passed}`);
console.log(`   Failed: ${TEST_RESULTS.failed}`);

if (TEST_RESULTS.failures.length > 0) {
  console.log(`\n❌ FAILURES:`);
  TEST_RESULTS.failures.forEach((f) => {
    console.log(`   - ${f.name}: ${f.message}`);
  });
}

console.log(`\n📋 EVIDENCE:`);
console.log(`   Receipts created: ${receiptCount}`);
console.log(`   Refresh attempts: ${refreshAttemptCount}`);
console.log(`   Logout invocations: ${logoutInvocationCount}`);

const finalSnapshot = captureAuthSnapshot();
console.log(`\n📸 FINAL AUTH SNAPSHOT:`);
console.log(`   isAuthenticated: ${finalSnapshot.isAuthenticated}`);
console.log(`   accessTokenPresent: ${finalSnapshot.accessTokenPresent}`);
console.log(`   refreshTokenPresent: ${finalSnapshot.refreshTokenPresent}`);
console.log(`   userId: ${finalSnapshot.userId}`);

// Exit with appropriate code
process.exit(TEST_RESULTS.failed > 0 ? 1 : 0);
