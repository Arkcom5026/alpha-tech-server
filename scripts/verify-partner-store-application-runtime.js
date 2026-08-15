'use strict';

const canonicalCommand = 'npm run verify:partner-store-application-http-e2e:test';

const error = new Error(
  `RETIRED_PARTNER_STORE_RUNTIME_VERIFIER: this pre-V2 verifier is no longer an execution authority. Use ${canonicalCommand}.`
);
error.code = 'RETIRED_PARTNER_STORE_RUNTIME_VERIFIER';
error.canonicalCommand = canonicalCommand;

throw error;
