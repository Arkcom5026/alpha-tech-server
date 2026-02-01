// controllers/simpleStockController.js
// BASELINE: SIMPLE flow controller (single source of truth)
// - Centralizes: healthcheck, auth/branch context, idempotency header, standard error mapping
// - Keeps business logic modular: handlers call service functions you can implement/expand later
// - Production-safe & minimal disruption

const buildContext = (req) => ({
  userId: req.user?.id || null,
  role: req.user?.role || null,
  branchId: req.user?.branchId || null,
  idempotencyKey: req.headers["x-idempotency-key"] || null,
  ts: new Date().toISOString(),
});

const toNum = (v) => (v === undefined || v === null || v === "" ? NaN : Number(v));

const sendError = (res, status, message, extra = undefined) => {
  const payload = { ok: false, message };
  if (extra && typeof extra === "object") Object.assign(payload, extra);
  return res.status(status).json(payload);
};

const requireBranch = (req, res) => {
  const branchId = req.user?.branchId;
  if (!branchId) {
    sendError(res, 401, "Unauthorized (missing branchId)", { context: buildContext(req) });
    return null;
  }
  return branchId;
};

// ─────────────────────────────────────────────────────────────────────────────
// Health / Ping — verify routing, auth, branch scope, custom headers
const pingSimple = async (req, res) => {
  try {
    requireBranch(req, res);
    return res.json({
      ok: true,
      service: "simple-stock",
      message: "SIMPLE routes are mounted and authenticated",
      context: buildContext(req),
    });
  } catch (err) {
    console.error("❌ pingSimple error:", err);
    return sendError(res, 500, "Internal Server Error");
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Service layer placeholders (implement when SIMPLE stock flow is ready)
// IMPORTANT: NEVER trust client branchId. Use req.user.branchId only.

const simpleStockService = {
  receipt: async ({ payload, context }) => ({
    ok: false,
    code: "NOT_IMPLEMENTED",
    message: "receipt service not implemented",
    payload,
    context,
  }),
  sale: async ({ payload, context }) => ({
    ok: false,
    code: "NOT_IMPLEMENTED",
    message: "sale service not implemented",
    payload,
    context,
  }),
  adjust: async ({ payload, context }) => ({
    ok: false,
    code: "NOT_IMPLEMENTED",
    message: "adjust service not implemented",
    payload,
    context,
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Route handlers (Baseline)

const createSimpleReceipt = async (req, res) => {
  try {
    const branchId = requireBranch(req, res);
    if (!branchId) return;

    const { productId, qty, unitCost, refType, refId, note } = req.body || {};

    if (!productId) return sendError(res, 400, "productId is required", { context: buildContext(req) });
    if (!Number.isFinite(toNum(qty)) || toNum(qty) <= 0)
      return sendError(res, 400, "qty must be a positive number", { context: buildContext(req) });
    if (!Number.isFinite(toNum(unitCost)) || toNum(unitCost) < 0)
      return sendError(res, 400, "unitCost must be a non-negative number", { context: buildContext(req) });

    const payload = { productId, qty: toNum(qty), unitCost: toNum(unitCost), refType, refId, note };
    const result = await simpleStockService.receipt({ branchId, payload, context: buildContext(req) });

    if (result?.code === "NOT_IMPLEMENTED") {
      return sendError(res, 501, "createSimpleReceipt is not implemented yet", {
        context: buildContext(req),
        hint: "Endpoint is mounted successfully. Implement simpleStockService.receipt when ready.",
      });
    }

    return res.json({ ok: true, data: result, context: buildContext(req) });
  } catch (err) {
    console.error("❌ createSimpleReceipt error:", err);
    return sendError(res, 500, "Internal Server Error");
  }
};

const createSimpleSale = async (req, res) => {
  try {
    const branchId = requireBranch(req, res);
    if (!branchId) return;

    const { productId, qty, unitPrice, refType, refId, note } = req.body || {};

    if (!productId) return sendError(res, 400, "productId is required", { context: buildContext(req) });
    if (!Number.isFinite(toNum(qty)) || toNum(qty) <= 0)
      return sendError(res, 400, "qty must be a positive number", { context: buildContext(req) });
    if (typeof unitPrice !== "undefined" && (!Number.isFinite(toNum(unitPrice)) || toNum(unitPrice) < 0))
      return sendError(res, 400, "unitPrice must be a non-negative number", { context: buildContext(req) });

    const payload = {
      productId,
      qty: toNum(qty),
      unitPrice: typeof unitPrice === "undefined" ? undefined : toNum(unitPrice),
      refType,
      refId,
      note,
    };

    const result = await simpleStockService.sale({ branchId, payload, context: buildContext(req) });

    if (result?.code === "NOT_IMPLEMENTED") {
      return sendError(res, 501, "createSimpleSale is not implemented yet", {
        context: buildContext(req),
        hint: "Endpoint is mounted successfully. Implement simpleStockService.sale when ready.",
      });
    }

    return res.json({ ok: true, data: result, context: buildContext(req) });
  } catch (err) {
    console.error("❌ createSimpleSale error:", err);
    return sendError(res, 500, "Internal Server Error");
  }
};

const createSimpleAdjustment = async (req, res) => {
  try {
    const branchId = requireBranch(req, res);
    if (!branchId) return;

    const { productId, qtyDelta, note, refType, refId } = req.body || {};

    if (!productId) return sendError(res, 400, "productId is required", { context: buildContext(req) });
    if (!Number.isFinite(toNum(qtyDelta)) || toNum(qtyDelta) === 0)
      return sendError(res, 400, "qtyDelta must be a non-zero number", { context: buildContext(req) });

    const payload = { productId, qtyDelta: toNum(qtyDelta), note, refType, refId };
    const result = await simpleStockService.adjust({ branchId, payload, context: buildContext(req) });

    if (result?.code === "NOT_IMPLEMENTED") {
      return sendError(res, 501, "createSimpleAdjustment is not implemented yet", {
        context: buildContext(req),
        hint: "Endpoint is mounted successfully. Implement simpleStockService.adjust when ready.",
      });
    }

    return res.json({ ok: true, data: result, context: buildContext(req) });
  } catch (err) {
    console.error("❌ createSimpleAdjustment error:", err);
    return sendError(res, 500, "Internal Server Error");
  }
};

module.exports = {
  pingSimple,
  createSimpleReceipt,
  createSimpleSale,
  createSimpleAdjustment,

  // exported for unit tests / incremental wiring
  simpleStockService,
  buildContext,
};
