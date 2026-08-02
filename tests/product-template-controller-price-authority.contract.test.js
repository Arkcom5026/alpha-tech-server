'use strict';

const assert = require('assert');
const controller = require('../src/modules/productTemplate/runtime/productTemplateRuntimeController');
const service = require('../src/modules/productTemplate/runtime/productTemplateRuntimeService');

const originalCreate = service.createTemplate;
const originalUpdate = service.updateTemplate;

const response = () => ({
  statusCode: 200,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});

(async () => {
  try {
    let capturedCreate;
    service.createTemplate = async (payload, query) => {
      capturedCreate = { payload, query };
      return { id: 1 };
    };

    const createReq = {
      body: { name: 'Template', costPrice: 100, role: 'SUPERADMIN' },
      query: { templateBranchCode: 'TEMPLATE', employeeId: 999, role: 'OWNER' },
      employee: { id: 35, branchId: 2, v2Role: 'ADMIN' },
      user: { employeeId: 88, branchId: 9, role: 'SUPERADMIN' },
    };
    const createRes = response();
    await controller.createProductTemplate(createReq, createRes);

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(capturedCreate.query.templateBranchCode, 'TEMPLATE');
    assert.deepStrictEqual(capturedCreate.query.actor, {
      branchId: 2,
      employeeId: 35,
      role: 'ADMIN',
      v2Role: 'ADMIN',
    });
    assert.strictEqual(capturedCreate.query.actor.employeeId, createReq.employee.id);
    assert.notStrictEqual(capturedCreate.query.actor.employeeId, createReq.query.employeeId);
    assert.notStrictEqual(capturedCreate.query.actor.role, createReq.query.role);
    assert.strictEqual(capturedCreate.payload.role, 'SUPERADMIN');

    let capturedUpdate;
    service.updateTemplate = async (id, payload, query) => {
      capturedUpdate = { id, payload, query };
      return { id: Number(id) };
    };

    const updateReq = {
      params: { id: '7' },
      body: { priceRetail: 150 },
      query: { actor: { employeeId: 999, role: 'OWNER' } },
      user: { employeeId: 44, branchId: 3, role: 'SUPERADMIN' },
    };
    const updateRes = response();
    await controller.updateProductTemplate(updateReq, updateRes);

    assert.strictEqual(updateRes.statusCode, 200);
    assert.deepStrictEqual(capturedUpdate.query.actor, {
      branchId: 3,
      employeeId: 44,
      role: 'SUPERADMIN',
      v2Role: 'SUPERADMIN',
    });
    assert.notDeepStrictEqual(capturedUpdate.query.actor, updateReq.query.actor);

    console.log('product-template-controller-price-authority.contract.test.js: PASS');
  } finally {
    service.createTemplate = originalCreate;
    service.updateTemplate = originalUpdate;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
