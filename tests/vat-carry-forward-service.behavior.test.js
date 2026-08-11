'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const carryForwardService = require('../src/modules/tax/settlement/vatCarryForwardService');

const period = (overrides = {}) => ({
  id: 'period-current',
  branchId: 2,
  periodCode: '2026-08',
  startDate: new Date('2026-08-01T00:00:00.000Z'),
  endDate: new Date('2026-08-31T23:59:59.999Z'),
  status: 'OPEN',
  ...overrides,
});

const previousPeriod = (overrides = {}) => ({
  id: 'period-previous',
  periodCode: '2026-07',
  startDate: new Date('2026-07-01T00:00:00.000Z'),
  endDate: new Date('2026-07-31T23:59:59.999Z'),
  status: 'LOCKED',
  ...overrides,
});

const createDatabase = ({ target, previous = null, startingVersion = 0 } = {}) => {
  let authorityVersion = startingVersion;
  let writeCount = 0;

  return {
    get writeCount() { return writeCount; },
    async $transaction(work) {
      let queryIndex = 0;
      const tx = {
        async $queryRaw() {
          queryIndex += 1;
          if (queryIndex === 1) return [target];
          if (queryIndex === 2) return previous ? [previous] : [];
          writeCount += 1;
          authorityVersion += 1;
          return [{
            id: 'vcf-test',
            branchId: 2,
            taxPeriodId: target.id,
            sourceTaxPeriodId: previous?.id || null,
            sourceType: previous ? 'PRIOR_PERIOD' : 'HISTORICAL_OPENING',
            amount: '0.00',
            status: 'CONFIRMED',
            note: null,
            version: authorityVersion,
            confirmedById: 35,
          }];
        },
      };
      return work(tx);
    },
  };
};

test('historical opening can explicitly confirm zero credit without touching a real database', async () => {
  const database = createDatabase({ target: period() });

  const result = await carryForwardService.confirmVatCarryForwardAuthority({
    branchId: 2,
    taxPeriodId: 'period-current',
    sourceType: 'HISTORICAL_OPENING',
    amount: 0,
    note: 'opening confirmed by accountant',
    actorEmployeeId: 35,
  }, { database });

  assert.equal(result.status, 'CONFIRMED');
  assert.equal(result.amount, 0);
  assert.equal(result.version, 1);
  assert.equal(database.writeCount, 1);
});

test('carry-forward raw SQL casts confirmed amount to numeric', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/modules/tax/settlement/vatCarryForwardService.js'),
    'utf8',
  );

  assert.match(
    source,
    /\$\{normalizedSourceType\}::"VatCarryForwardSourceType",\s*\$\{normalizedAmount\}::numeric/,
  );
});

test('prior-period carry-forward rejects an amount above available PP30 credit before write', async () => {
  const database = createDatabase({
    target: period(),
    previous: previousPeriod(),
  });

  await assert.rejects(
    carryForwardService.confirmVatCarryForwardAuthority({
      branchId: 2,
      taxPeriodId: 'period-current',
      sourceType: 'PRIOR_PERIOD',
      amount: 100.01,
      note: null,
      actorEmployeeId: 35,
    }, {
      database,
      loadPriorPeriodSettlement: async () => ({
        readyForPp30Preparation: true,
        pp30VatCredit: 100,
        pp30VatPayable: 0,
        exceptionCodes: [],
      }),
    }),
    (error) => {
      assert.equal(error.code, 'VAT_CARRY_FORWARD_AMOUNT_EXCEEDS_SOURCE_CREDIT');
      assert.equal(error.statusCode, 409);
      assert.equal(error.details.availableCredit, '100.00');
      return true;
    },
  );

  assert.equal(database.writeCount, 0);
});

test('reconfirmation surfaces monotonically increasing authority versions', async () => {
  const database = createDatabase({ target: period() });
  const request = {
    branchId: 2,
    taxPeriodId: 'period-current',
    sourceType: 'HISTORICAL_OPENING',
    amount: 0,
    note: null,
    actorEmployeeId: 35,
  };

  const first = await carryForwardService.confirmVatCarryForwardAuthority(request, { database });
  const second = await carryForwardService.confirmVatCarryForwardAuthority(request, { database });

  assert.equal(first.version, 1);
  assert.equal(second.version, 2);
  assert.equal(database.writeCount, 2);
});

test('submitted period rejects carry-forward mutation before any write', async () => {
  const database = createDatabase({ target: period({ status: 'SUBMITTED' }) });

  await assert.rejects(
    carryForwardService.confirmVatCarryForwardAuthority({
      branchId: 2,
      taxPeriodId: 'period-current',
      sourceType: 'HISTORICAL_OPENING',
      amount: 0,
      note: null,
      actorEmployeeId: 35,
    }, { database }),
    (error) => {
      assert.equal(error.code, 'VAT_CARRY_FORWARD_PERIOD_IMMUTABLE');
      assert.equal(error.statusCode, 409);
      return true;
    },
  );

  assert.equal(database.writeCount, 0);
});
