const fs = require('fs');
const path = require('path');

describe('finance daily closing module ownership', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
  const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

  test('legacy feature daily closing files stay retired', () => {
    expect(exists('src/features/finance/dailyClosing.routes.js')).toBe(false);
    expect(exists('src/features/finance/dailyClosing.controller.js')).toBe(false);
    expect(exists('src/features/finance/dailyClosing.service.js')).toBe(false);
  });

  test('finance runtime mounts module-owned daily closing route', () => {
    const financeRoutes = read('src/modules/finance/legacy-runtime/routes/financeRuntimeRoutes.js');
    expect(financeRoutes).toContain("require('../../daily-closing/routes/dailyClosingRoutes')");
    expect(financeRoutes).not.toContain('src/features/finance/dailyClosing.routes');
  });

  test('daily closing contract remains available', () => {
    const route = read('src/modules/finance/daily-closing/routes/dailyClosingRoutes.js');
    const controller = read('src/modules/finance/daily-closing/dailyClosingController.js');
    const service = read('src/modules/finance/daily-closing/dailyClosingService.js');

    expect(route).toContain("router.get('/daily-closing-summary', getDailyClosingSummary)");
    expect(controller).toContain('getDailyClosingSummary');
    expect(service).toContain('resolveBangkokDateRange');
    expect(service).toContain('resolveBangkokPeriodRange');
    expect(service).toContain("timezone: 'Asia/Bangkok'");
    expect(service).toContain('creditOutstandingAmount');
    expect(service).toContain('cashExpectedAmount');
  });
});
