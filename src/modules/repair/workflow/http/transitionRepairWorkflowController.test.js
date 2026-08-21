const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REPAIR_WORKFLOW_RESPONSE_VERSION,
  createTransitionRepairWorkflowController,
  mapRepairWorkflowHttpError,
  normalizeWorkflowCommand,
  projectRepairWorkflowCommandResponse,
} = require('./transitionRepairWorkflowController');

function createResponseCapture() {
  return {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test('normalizes route params and request body into a workflow command', () => {
  const command = normalizeWorkflowCommand({
    params: { id: '41' },
    body: {
      action: 'START_DIAGNOSIS',
      commandKey: 'cmd-1',
      expectedWorkflowStatus: 'WAITING_DIAGNOSIS',
      note: 'เริ่มตรวจสอบอาการ',
      customerVisible: false,
    },
  });

  assert.equal(command.repairJobId, '41');
  assert.equal(command.action, 'START_DIAGNOSIS');
  assert.equal(command.commandKey, 'cmd-1');
  assert.equal(command.expectedWorkflowStatus, 'WAITING_DIAGNOSIS');
  assert.equal(command.customerVisible, false);
});

test('projects a stable versioned HTTP response', () => {
  const projected = projectRepairWorkflowCommandResponse({
    repairJobId: 41,
    commandKey: 'cmd-1',
    previousStatus: 'WAITING_DIAGNOSIS',
    status: 'DIAGNOSING',
    legacyStatus: 'IN_PROGRESS',
    terminal: false,
    passportEventId: 91,
    availableActions: [{ action: 'COMPLETE_DIAGNOSIS' }],
    repairJob: { id: 41 },
    internalOnly: true,
  });

  assert.equal(projected.responseVersion, REPAIR_WORKFLOW_RESPONSE_VERSION);
  assert.equal(projected.status, 'DIAGNOSING');
  assert.equal(projected.internalOnly, undefined);
});

test('executes the command with the authenticated repair actor', async () => {
  let receivedActor;
  let receivedCommand;
  const service = {
    execute(actor, command) {
      receivedActor = actor;
      receivedCommand = command;
      return Promise.resolve({
        repairJobId: 41,
        commandKey: 'cmd-1',
        previousStatus: 'WAITING_DIAGNOSIS',
        status: 'DIAGNOSING',
        legacyStatus: 'IN_PROGRESS',
        terminal: false,
        passportEventId: 91,
        availableActions: [],
        repairJob: { id: 41 },
      });
    },
  };

  const controller = createTransitionRepairWorkflowController(service);
  const res = createResponseCapture();
  let nextError;

  await controller(
    {
      user: {
        id: 2,
        branchId: 3,
        employeeId: 7,
        role: 'MANAGER',
        repairCapabilities: ['repair.workflow'],
        positionAuthorityMode: 'POSITION',
      },
      params: { id: '41' },
      body: { action: 'START_DIAGNOSIS', commandKey: 'cmd-1' },
    },
    res,
    (error) => { nextError = error; }
  );

  assert.equal(nextError, undefined);
  assert.deepEqual(receivedActor, {
    branchId: 3,
    employeeId: 7,
    role: 'MANAGER',
    repairCapabilities: ['repair.workflow'],
    positionAuthorityMode: 'POSITION',
    userId: 2,
  });
  assert.equal(receivedCommand.repairJobId, '41');
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.data.responseVersion, 1);
});

test('maps workflow failures to explicit HTTP status codes', async () => {
  const service = {
    execute() {
      const error = new Error('stale command');
      error.code = 'REPAIR_WORKFLOW_VERSION_CONFLICT';
      return Promise.reject(error);
    },
  };
  const controller = createTransitionRepairWorkflowController(service);
  const res = createResponseCapture();
  let nextError;

  await controller(
    {
      user: { branchId: 3, employeeId: 7, role: 'MANAGER' },
      params: { id: '41' },
      body: { action: 'START_DIAGNOSIS', commandKey: 'cmd-1' },
    },
    res,
    (error) => { nextError = error; }
  );

  assert.equal(nextError.code, 'REPAIR_WORKFLOW_VERSION_CONFLICT');
  assert.equal(nextError.statusCode, 409);
});

test('preserves an existing statusCode while mapping errors', () => {
  const error = Object.assign(new Error('custom'), {
    code: 'REPAIR_JOB_NOT_FOUND',
    statusCode: 422,
  });
  assert.equal(mapRepairWorkflowHttpError(error).statusCode, 422);
});