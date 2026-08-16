'use strict';

const fs = require('fs');
const path = require('path');

const bat = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'run-recovery-task.bat'), 'utf8');

function mustMatch(regex, message) {
  if (!regex.test(bat)) throw new Error(message);
}

mustMatch(/setlocal/i, 'Scheduled recovery entrypoint must scope its environment with setlocal.');
mustMatch(/RECOVERY_STANDBY_SYNC_ENABLED=true/i, 'Scheduled recovery must enable Workflow B standby sync.');
mustMatch(/RECOVERY_DRILL_APPROVAL=ALPHATECH_RECOVERY_DRILL/i, 'Scheduled recovery must carry the explicit recovery drill approval.');
mustMatch(/RESTORE_DATABASE_RESET_CONFIRMATION=ALPHATECH_TEST_DB_RESET/i, 'Scheduled recovery must carry reset confirmation.');
mustMatch(/RESTORE_DATABASE_ENVIRONMENT=TEST/i, 'Scheduled recovery must pin the restore environment to TEST.');
mustMatch(/RESTORE_DATABASE_PROJECT_REF=engqdeyzbvnmxbnpemau/i, 'Scheduled recovery must pin the approved Recovery/Test project ref.');
mustMatch(/RESTORE_DATABASE_WRITE_APPROVAL=ALPHATECH_TEST_DB_WRITE/i, 'Scheduled recovery must carry the Recovery/Test write approval.');
mustMatch(/RESTORE_DATABASE_RESET_APPROVAL=ALPHATECH_TEST_DB_RESET/i, 'Scheduled recovery must carry the Recovery/Test reset approval.');
mustMatch(/RECOVERY_RETENTION_APPLY=false/i, 'Scheduled recovery must force local retention dry-run.');
mustMatch(/RECOVERY_R2_RETENTION_APPLY=false/i, 'Scheduled recovery must force R2 retention dry-run.');
mustMatch(/node\s+recovery\\consolidatedRecoveryRunner\.js/i, 'Scheduled recovery must invoke only the consolidated runner.');
mustMatch(/endlocal\s*&\s*exit\s+\/b/i, 'Scheduled recovery must return the consolidated runner exit code after endlocal.');

if (/set\s+"?(?:RESTORE_DATABASE_URL|RECOVERY_DATABASE_URL)=/i.test(bat)) {
  throw new Error('Scheduled entrypoint must not embed Recovery database URLs or credentials in Git.');
}
if (/postgres(?:ql)?:\/\//i.test(bat)) {
  throw new Error('Scheduled entrypoint must not contain PostgreSQL connection strings.');
}

console.log('recovery scheduled standby sync contract: PASS');
