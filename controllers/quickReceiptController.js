// =============================================================================
// BE: server/controllers/quickReceiptController.js
// Purpose: Quick Receive (Hybrid A) controller — Draft first → Finalize commits
// Style: CommonJS; **no service & no external model file** (Project #1 guideline)
//         ทำงานจบในไฟล์เดียวแบบ scoped เพื่อลดผลกระทบกับส่วนอื่นของระบบ
// Notes:
//  - อ่าน user/branch จาก req.user (verifyToken ผูกที่ระดับ router แล้ว)
//  - FE ห้ามส่ง branchId/employeeId เข้ามาโดยตรง
//  - Idempotency headers:
//      * X-Idempotency-Key  — save item draft (กันดับเบิลคลิก)
//      * X-Finalize-Token   — finalize (กันกดปุ่มซ้ำ)
//  - ใช้ Knex instance จาก req.app.locals.knex หรือ require('../db') (ปรับตามโปรเจกต์)
//  - ตารางอ้างอิง (เปลี่ยนชื่อตามจริง):
//      T.receipt  = 'quick_receipts'
//      T.item     = 'quick_receipt_items'
//      T.stock    = 'stock_balances'
//      T.barcode  = 'barcodes'
// =============================================================================

// ---------- helpers -----------------------------------------------------------
const asNumber = (v, def = 0) => {
    if (v === '' || v === null || v === undefined) return def;
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
};

const getDb = (req) => {
    if (req?.app?.locals?.knex) return req.app.locals.knex;
    try { return require('../db'); } catch { /* noop */ }
    try { return require('../../db'); } catch { /* noop */ }
    return null;
};

const pickContext = (req) => ({
    userId: req.user?.id,
    branchId: req.user?.branchId,
    reqId: req.id || req.headers['x-request-id'] || undefined,
    ip: req.ip,
    db: getDb(req),
});

const send = (res, code, payload) => res.status(code).json(payload);

const T = {
    receipt: 'quick_receipts',
    item: 'quick_receipt_items',
    stock: 'stock_balances',
    barcode: 'barcodes',
};

const nowIso = () => new Date().toISOString();
const genBarcode = (productId) => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `QR${y}${m}${dd}-${productId}-${rand}`;
};

// ---------- inline DB fns (SCOPED • เติม/ปรับ table/column ตามโปรเจกต์) -----

// สร้างหรือคืนใบร่าง
const dbEnsureDraft = async ({ db, source, supplierId, note, userId, branchId }) => {
    if (!db) throw new Error('DB connection not available');

    // สร้างใบใหม่ทุกครั้ง (ถ้าอยาก enforce 1 draft ต่อผู้ใช้/สาขา สามารถเช็คก่อน insert ได้)
    const payload = {
        source,
        supplier_id: supplierId || 0,
        note: note || '',
        status: 'DRAFT',
        branch_id: branchId || null,
        user_id: userId || null,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
    };

    let id;
    try {
        const rows = await db(T.receipt).insert(payload).returning('id');
        id = Array.isArray(rows) ? (rows[0]?.id ?? rows[0]) : rows;
    } catch (e) {
        // บาง dialect ไม่รองรับ returning
        const result = await db(T.receipt).insert(payload);
        id = Array.isArray(result) ? result[0] : result;
    }
    return { id, status: 'DRAFT', source, supplierId, note };
};

// บันทึก/อัปเดตรายการในใบร่าง (ยังไม่ขยับสต๊อก)
const dbSaveDraftItem = async ({ db, receiptId, itemId, productId, qty, unitCost, vatRate, idempotencyKey, userId, branchId }) => {
    if (!db) throw new Error('DB connection not available');
    if (!receiptId) throw new Error('missing receipt id');
    if (!productId || !qty) throw new Error('missing product or qty');

    // ตรวจใบต้องเป็น DRAFT
    const receipt = await db(T.receipt).where({ id: receiptId }).first();
    if (!receipt) throw Object.assign(new Error('receipt not found'), { status: 404, code: 'NOT_FOUND' });
    if (receipt.status !== 'DRAFT') throw Object.assign(new Error('receipt not in DRAFT'), { status: 409, code: 'CONFLICT' });

    const body = {
        receipt_id: receiptId,
        product_id: productId,
        qty,
        unit_cost: unitCost ?? 0,
        vat_rate: vatRate ?? 0,
        idempotency_key: idempotencyKey || null,
        updated_at: db.fn.now(),
    };

    let savedId = itemId;
    if (itemId) {
        await db(T.item).where({ id: itemId, receipt_id: receiptId }).update(body);
    } else {
        body.created_at = db.fn.now();
        try {
            const rows = await db(T.item).insert(body).returning('id');
            savedId = Array.isArray(rows) ? (rows[0]?.id ?? rows[0]) : rows;
        } catch (e) {
            // MySQL ไม่มี returning
            const result = await db(T.item).insert(body);
            savedId = Array.isArray(result) ? result[0] : result;
        }
    }

    return { itemId: savedId };
};

// ลบรายการในใบร่าง (เฉพาะก่อน Finalize)
const dbDeleteDraftItem = async ({ db, receiptId, itemId }) => {
    if (!db) throw new Error('DB connection not available');
    if (!receiptId || !itemId) throw new Error('missing id');

    const receipt = await db(T.receipt).where({ id: receiptId }).first();
    if (!receipt) throw Object.assign(new Error('receipt not found'), { status: 404, code: 'NOT_FOUND' });
    if (receipt.status !== 'DRAFT') throw Object.assign(new Error('receipt not in DRAFT'), { status: 409, code: 'CONFLICT' });

    await db(T.item).where({ id: itemId, receipt_id: receiptId }).del();
    return { ok: true };
};

// Finalize ใบรับ (ธุรกรรมเดียว + idempotent)
const dbFinalize = async ({ db, receiptId, finalizeToken, userId, branchId }) => {
    if (!db) throw new Error('DB connection not available');
    if (!receiptId) throw new Error('missing receipt id');

    return await db.transaction(async (trx) => {
        // 1) lock ใบรับ
        const receipt = await trx(T.receipt).where({ id: receiptId }).forUpdate().first();
        if (!receipt) throw Object.assign(new Error('receipt not found'), { status: 404, code: 'NOT_FOUND' });

        // Idempotent: ถ้าเคย finalize ไปแล้ว ให้คืนข้อมูลเดิม
        if (receipt.status === 'FINALIZED') {
            return {
                receiptId,
                committedAt: receipt.finalized_at || nowIso(),
                lotBarcodes: await trx(T.barcode).select('code', 'product_id').where({ receipt_id: receiptId, kind: 'LOT' }),
                stockMovements: await trx(T.item).select('product_id as productId', 'qty').where({ receipt_id: receiptId }),
            };
        }

        // ตรวจ token idempotent (ถ้าต้องการบังคับ)
        if (receipt.finalize_token && finalizeToken && receipt.finalize_token !== finalizeToken) {
            // มี token เก่าไม่ตรง — ป้องกันการยิงซ้ำข้าม context
            throw Object.assign(new Error('finalize token mismatch'), { status: 409, code: 'CONFLICT' });
        }

        // 2) โหลดรายการทั้งหมด
        const items = await trx(T.item).where({ receipt_id: receiptId });
        if (items.length === 0) throw Object.assign(new Error('no items to finalize'), { status: 409, code: 'EMPTY' });

        // 3) อัปเดตสต๊อกและสร้าง LOT barcode ต่อ product หนึ่งรายการ/หนึ่ง LOT (SIMPLE)
        const lotBarcodes = [];
        const stockMovements = [];

        for (const it of items) {
            // upsert stock balance
            const existing = await trx(T.stock).where({ branch_id: branchId, product_id: it.product_id }).first();
            if (existing) {
                await trx(T.stock).where({ id: existing.id }).update({
                    quantity: (existing.quantity || 0) + it.qty,
                    updated_at: trx.fn.now(),
                });
            } else {
                await trx(T.stock).insert({
                    branch_id: branchId,
                    product_id: it.product_id,
                    quantity: it.qty,
                    created_at: trx.fn.now(),
                    updated_at: trx.fn.now(),
                });
            }
            stockMovements.push({ productId: it.product_id, qty: it.qty });

            // create one LOT barcode per item line (SIMPLE)
            const code = genBarcode(it.product_id);
            await trx(T.barcode).insert({
                code,
                kind: 'LOT',
                product_id: it.product_id,
                receipt_id: receiptId,
                status: 'SN_RECEIVED', // ตามนิยามเดิม: LOT ใช้ SN_RECEIVED
                created_at: trx.fn.now(),
            });
            lotBarcodes.push({ productId: it.product_id, code });
        }

        // 4) mark FINALIZED + finalize token
        const committedAt = nowIso();
        await trx(T.receipt).where({ id: receiptId }).update({
            status: 'FINALIZED',
            finalized_at: committedAt,
            finalize_token: finalizeToken || trx.raw('COALESCE(finalize_token, ?) ', [finalizeToken || null]),
            updated_at: trx.fn.now(),
        });

        return { receiptId, committedAt, lotBarcodes, stockMovements };
    });
};

// ---------- controllers -------------------------------------------------------
// POST /api/quick-receipts — สร้างเอกสาร Quick Receipt แบบ DRAFT
const ensureDraft = async (req, res, next) => {
    try {
        const { source = 'QUICK_HYBRID', supplierId = 0, note = '' } = req.body || {};
        const ctx = pickContext(req);
        const out = await dbEnsureDraft({
            db: ctx.db,
            source,
            supplierId: asNumber(supplierId, 0),
            note: String(note || ''),
            userId: ctx.userId,
            branchId: ctx.branchId,
        });
        return send(res, 201, out);
    } catch (err) { next(err); }
};

// POST /api/quick-receipts/:id/items — บันทึก/อัปเดตรายการแบบ DRAFT (ยังไม่ขยับสต๊อก)
const saveItemDraft = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!id) return send(res, 400, { code: 'INVALID', message: 'missing receipt id' });

        const { itemId, productId, qty, unitCost = 0, vatRate = 0 } = req.body || {};
        const idempotencyKey = req.get('X-Idempotency-Key');
        const ctx = pickContext(req);

        const out = await dbSaveDraftItem({
            db: ctx.db,
            receiptId: id,
            itemId: itemId || undefined,
            productId: asNumber(productId),
            qty: asNumber(qty),
            unitCost: asNumber(unitCost),
            vatRate: asNumber(vatRate),
            idempotencyKey: idempotencyKey || undefined,
            userId: ctx.userId,
            branchId: ctx.branchId,
        });
        return send(res, 200, out);
    } catch (err) { next(err); }
};

// DELETE /api/quick-receipts/:id/items/:itemId — ลบรายการแบบ DRAFT (เฉพาะก่อน Finalize)
const deleteItemDraft = async (req, res, next) => {
    try {
        const { id, itemId } = req.params;
        if (!id || !itemId) return send(res, 400, { code: 'INVALID', message: 'missing id or itemId' });
        const ctx = pickContext(req);

        const out = await dbDeleteDraftItem({ db: ctx.db, receiptId: id, itemId });
        return send(res, 200, out);
    } catch (err) { next(err); }
};

// POST /api/quick-receipts/:id/finalize — Finalize เอกสาร (ทำธุรกรรมเดียว + idempotent)
const finalize = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!id) return send(res, 400, { code: 'INVALID', message: 'missing receipt id' });
        const finalizeToken = req.get('X-Finalize-Token');
        const ctx = pickContext(req);

        const out = await dbFinalize({ db: ctx.db, receiptId: id, finalizeToken: finalizeToken || undefined, userId: ctx.userId, branchId: ctx.branchId });
        return send(res, 200, out);
    } catch (err) { next(err); }
};

module.exports = {
    ensureDraft,
    saveItemDraft,
    deleteItemDraft,
    finalize
};
