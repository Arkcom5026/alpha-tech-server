// recovery/jobRunner.js
// AlphaTech Recovery Toolkit — Phase 5 Retention Workflow
//
// Workflow:
//   HEALTH_CHECK -> BACKUP -> VERIFY_BACKUP -> VERIFY_RECOVERY -> UPLOAD -> RETENTION -> REPORT
//
// Upload is enabled when:
//   RECOVERY_UPLOAD_ENABLED=true or --upload
//
// Retention is enabled when:
//   RECOVERY_RETENTION_ENABLED=true or --retention
//
// Retention apply mode is enabled when:
//   RECOVERY_RETENTION_APPLY=true or --retention-apply
// otherwise retention runs dry-run.

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const JOB_VERSION = 'ALPHATECH-RECOVERY-JOB-RUNNER-V5-RETENTION';
const ROOT_DIR = process.cwd();
const RECOVERY_DIR = path.join(ROOT_DIR, 'recovery');
const JOB_DIR = path.join(RECOVERY_DIR, 'jobs');
const LOG_DIR = path.join(RECOVERY_DIR, 'logs');
const REPORT_DIR = path.join(RECOVERY_DIR, 'reports');
const LOCK_FILE = path.join(JOB_DIR, 'recovery-job.lock');
const BACKUPS_DIR = process.env.BACKUP_OUTPUT_DIR || path.join(ROOT_DIR, 'backups');

const UPLOAD_ENABLED = String(process.env.RECOVERY_UPLOAD_ENABLED || 'false').toLowerCase() === 'true';
const RETENTION_ENABLED = String(process.env.RECOVERY_RETENTION_ENABLED || 'false').toLowerCase() === 'true';
const RETENTION_APPLY = String(process.env.RECOVERY_RETENTION_APPLY || 'false').toLowerCase() === 'true';

const STEP_STATUS = { PENDING:'PENDING', RUNNING:'RUNNING', PASS:'PASS', FAIL:'FAIL', SKIPPED:'SKIPPED' };
const WORKFLOW_STEPS = ['HEALTH_CHECK','BACKUP','VERIFY_BACKUP','VERIFY_RECOVERY','UPLOAD','RETENTION','REPORT'];

function nowIso(){ return new Date().toISOString(); }
function safeIdFromIso(iso){ return iso.replace(/[:.]/g,'-'); }
function ensureDir(p){ fs.mkdirSync(p,{recursive:true}); }
function readJson(p){ return JSON.parse(fs.readFileSync(p,'utf8')); }
function writeJson(p,v){ fs.writeFileSync(p,JSON.stringify(v,null,2),'utf8'); }

function parseArgs(argv){
  const flags=argv.slice(2);
  const args={mode:'backup-workflow'};
  if(flags.includes('--backup-only')) args.mode='backup-only';
  if(flags.includes('--backup-workflow')||flags.includes('--backup-and-verify')) args.mode='backup-workflow';
  if(flags.includes('--full-drill')) args.mode='full-drill';
  if(flags.includes('--skip-health-check')) args.skipHealthCheck=true;
  if(flags.includes('--upload')) args.uploadEnabled=true;
  if(flags.includes('--no-upload')) args.uploadEnabled=false;
  if(flags.includes('--retention')) args.retentionEnabled=true;
  if(flags.includes('--no-retention')) args.retentionEnabled=false;
  if(flags.includes('--retention-apply')) args.retentionApply=true;
  return args;
}

function uploadActive(args){ return args.uploadEnabled === true || (args.uploadEnabled !== false && UPLOAD_ENABLED); }
function retentionActive(args){ return args.retentionEnabled === true || (args.retentionEnabled !== false && RETENTION_ENABLED); }
function retentionApply(args){ return args.retentionApply === true || RETENTION_APPLY; }

function createLogger(jobId){
  ensureDir(LOG_DIR);
  const logFile=path.join(LOG_DIR,`job-${jobId}.log`);
  const log=(msg)=>{ const line=`[${nowIso()}] ${msg}`; console.log(line); fs.appendFileSync(logFile,`${line}\n`,'utf8'); };
  return {log,logFile};
}

function initializeWorkflow(mode,args){
  const steps={};
  for(const name of WORKFLOW_STEPS){
    steps[name]={name,status:STEP_STATUS.PENDING,startedAt:null,finishedAt:null,durationMs:null,exitCode:null,command:null,details:{},error:null};
  }
  if(args.skipHealthCheck){ steps.HEALTH_CHECK.status=STEP_STATUS.SKIPPED; steps.HEALTH_CHECK.details.reason='--skip-health-check'; }
  if(mode==='backup-only'){
    steps.VERIFY_BACKUP.status=STEP_STATUS.SKIPPED; steps.VERIFY_BACKUP.details.reason='backup-only mode';
    steps.VERIFY_RECOVERY.status=STEP_STATUS.SKIPPED; steps.VERIFY_RECOVERY.details.reason='backup-only mode';
  }
  if(mode==='backup-workflow'){
    steps.VERIFY_RECOVERY.status=STEP_STATUS.SKIPPED; steps.VERIFY_RECOVERY.details.reason='requires full-drill';
  }
  if(!uploadActive(args)){ steps.UPLOAD.status=STEP_STATUS.SKIPPED; steps.UPLOAD.details.reason='upload not enabled'; }
  if(!retentionActive(args)){ steps.RETENTION.status=STEP_STATUS.SKIPPED; steps.RETENTION.details.reason='retention not enabled'; }
  return steps;
}

function startStep(job,name,command=null){ const s=job.workflow.steps[name]; s.status=STEP_STATUS.RUNNING; s.startedAt=nowIso(); s.command=command; return s; }
function finishStep(job,name,result={}){ const s=job.workflow.steps[name]; s.finishedAt=nowIso(); s.durationMs=s.startedAt?Date.now()-Date.parse(s.startedAt):null; s.status=result.ok?STEP_STATUS.PASS:STEP_STATUS.FAIL; s.exitCode=result.exitCode??(result.ok?0:1); s.error=result.error||null; s.details={...s.details,...(result.details||{})}; return s; }
function skipStep(job,name,reason){ const s=job.workflow.steps[name]; s.status=STEP_STATUS.SKIPPED; s.finishedAt=nowIso(); s.details.reason=reason; return s; }

function acquireLock(jobId){
  ensureDir(JOB_DIR);
  if(fs.existsSync(LOCK_FILE)) throw new Error('Recovery job lock already exists. Another job may be running.');
  writeJson(LOCK_FILE,{jobId,createdAt:nowIso(),pid:process.pid});
}
function releaseLock(){ try{ if(fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE); }catch(_){} }

function runCommand(command,args,logger){
  return new Promise(resolve=>{
    logger.log(`▶️  Run: ${command} ${args.join(' ')}`);
    const child=spawn(command,args,{cwd:ROOT_DIR,shell:true,stdio:['ignore','pipe','pipe']});
    child.stdout.on('data',c=>{ for(const line of c.toString().split(/\r?\n/).filter(Boolean)) logger.log(`${command}: ${line}`); });
    child.stderr.on('data',c=>{ for(const line of c.toString().split(/\r?\n/).filter(Boolean)) logger.log(`${command} stderr: ${line}`); });
    child.on('error',e=>resolve({ok:false,exitCode:1,error:e.message||String(e)}));
    child.on('close',code=>resolve({ok:code===0,exitCode:code}));
  });
}

function findLatestManifest(){
  if(!fs.existsSync(BACKUPS_DIR)) return null;
  return fs.readdirSync(BACKUPS_DIR).filter(f=>f.endsWith('.manifest.json')).map(f=>{
    const p=path.join(BACKUPS_DIR,f); return {fileName:f,filePath:p,mtimeMs:fs.statSync(p).mtimeMs};
  }).sort((a,b)=>b.mtimeMs-a.mtimeMs)[0]||null;
}
function getManifestDetails(p){
  if(!p||!fs.existsSync(p)) return null;
  const m=readJson(p);
  return {manifestPath:p,backupVersion:m.backupVersion||null,sqlFilePath:m.files?.sqlFilePath||null,sha256:m.files?.sha256||null,summary:m.summary||null,verification:m.verification||null};
}

async function stepHealthCheck(job,logger,args){
  if(args.skipHealthCheck) return job.workflow.steps.HEALTH_CHECK;
  startStep(job,'HEALTH_CHECK','node recovery/health/healthCheck.js');
  const script=path.join(ROOT_DIR,'recovery','health','healthCheck.js');
  if(!fs.existsSync(script)) return finishStep(job,'HEALTH_CHECK',{ok:false,exitCode:51,error:'recovery/health/healthCheck.js not found'});
  const result=await runCommand('node',['recovery/health/healthCheck.js'],logger);
  const latest=path.join(ROOT_DIR,'recovery','reports','health-check.latest.json');
  const details={latestReport:fs.existsSync(latest)?latest:null};
  return finishStep(job,'HEALTH_CHECK',{ok:result.ok,exitCode:result.exitCode,error:result.error||null,details});
}
async function stepBackup(job,logger){
  startStep(job,'BACKUP','node qb.js');
  const result=await runCommand('node',['qb.js'],logger);
  const latest=findLatestManifest();
  return finishStep(job,'BACKUP',{ok:result.ok&&!!latest,exitCode:result.ok?(latest?0:11):result.exitCode,error:result.error||(!latest?'latest manifest not found after backup':null),details:{latestManifest:latest?.filePath||null,manifest:latest?getManifestDetails(latest.filePath):null}});
}
async function stepVerifyBackup(job){
  startStep(job,'VERIFY_BACKUP','manifest.verification check');
  const v=job.workflow.steps.BACKUP.details?.manifest?.verification||null;
  return finishStep(job,'VERIFY_BACKUP',{ok:v?.ok===true,exitCode:v?.ok?0:22,error:v?.ok?null:'Backup manifest verification failed or missing',details:{verification:v}});
}
async function stepRestore(job,logger){
  const manifestPath=job.workflow.steps.BACKUP.details?.latestManifest;
  job.workflow.steps.RESTORE_RECOVERY={name:'RESTORE_RECOVERY',status:STEP_STATUS.PENDING,startedAt:null,finishedAt:null,durationMs:null,exitCode:null,command:null,details:{},error:null};
  startStep(job,'RESTORE_RECOVERY',`node qbrs.js --manifest "${manifestPath}" --init --yes`);
  if(!manifestPath) return finishStep(job,'RESTORE_RECOVERY',{ok:false,exitCode:31,error:'manifest missing'});
  const result=await runCommand('node',['qbrs.js','--manifest',manifestPath,'--init','--yes'],logger);
  return finishStep(job,'RESTORE_RECOVERY',{ok:result.ok,exitCode:result.exitCode,error:result.error||null,details:{manifestPath}});
}
async function stepVerifyRecovery(job,logger){
  startStep(job,'VERIFY_RECOVERY','node recovery/verify/qbv.js');
  const script=path.join(ROOT_DIR,'recovery','verify','qbv.js');
  if(!fs.existsSync(script)) return finishStep(job,'VERIFY_RECOVERY',{ok:false,exitCode:41,error:'recovery/verify/qbv.js not found'});
  const result=await runCommand('node',['recovery/verify/qbv.js'],logger);
  const latest=path.join(ROOT_DIR,'recovery','reports','verification-report.latest.json');
  const details={latestReport:fs.existsSync(latest)?latest:null};
  return finishStep(job,'VERIFY_RECOVERY',{ok:result.ok,exitCode:result.exitCode,error:result.error||null,details});
}
async function stepUpload(job,logger,args){
  if(!uploadActive(args)) return job.workflow.steps.UPLOAD;
  const manifestPath=job.workflow.steps.BACKUP.details?.latestManifest;
  startStep(job,'UPLOAD',`node recovery/upload/uploadBackup.js --manifest "${manifestPath}"`);
  if(!manifestPath) return finishStep(job,'UPLOAD',{ok:false,exitCode:61,error:'manifest missing'});
  const result=await runCommand('node',['recovery/upload/uploadBackup.js','--manifest',manifestPath],logger);
  const latest=path.join(ROOT_DIR,'recovery','reports','upload-report.latest.json');
  const details={latestReport:fs.existsSync(latest)?latest:null};
  return finishStep(job,'UPLOAD',{ok:result.ok,exitCode:result.exitCode,error:result.error||null,details});
}
async function stepRetention(job,logger,args){
  if(!retentionActive(args)) return job.workflow.steps.RETENTION;
  const modeArg = retentionApply(args) ? '--apply' : '--dry-run';
  startStep(job,'RETENTION',`node recovery/retention/retentionPolicy.js ${modeArg}`);
  const result=await runCommand('node',['recovery/retention/retentionPolicy.js',modeArg],logger);
  const latest=path.join(ROOT_DIR,'recovery','reports','retention-report.latest.json');
  const details={mode:modeArg,latestReport:fs.existsSync(latest)?latest:null};
  return finishStep(job,'RETENTION',{ok:result.ok,exitCode:result.exitCode,error:result.error||null,details});
}

function computeOverall(job,args){
  const required=['HEALTH_CHECK','BACKUP'];
  if(job.workflow.steps.HEALTH_CHECK.status===STEP_STATUS.SKIPPED) required.shift();
  if(job.mode==='backup-workflow') required.push('VERIFY_BACKUP');
  if(job.mode==='full-drill') required.push('VERIFY_BACKUP','RESTORE_RECOVERY','VERIFY_RECOVERY');
  if(uploadActive(args)) required.push('UPLOAD');
  if(retentionActive(args)) required.push('RETENTION');
  const requiredFailed=required.map(n=>job.workflow.steps[n]).filter(s=>!s||s.status!==STEP_STATUS.PASS);
  const failed=Object.values(job.workflow.steps).filter(s=>s.status===STEP_STATUS.FAIL);
  return {ok:failed.length===0&&requiredFailed.length===0,failedSteps:failed.map(s=>s.name),requiredFailedSteps:requiredFailed.map(s=>s?.name||'UNKNOWN'),requiredSteps:required};
}
function renderReport(job){
  const lines=['========================================','AlphaTech Recovery Workflow Report','========================================',`Job ID     : ${job.jobId}`,`Mode       : ${job.mode}`,`Overall    : ${job.ok?'PASS':'FAIL'}`,'','Steps','----------------------------------------'];
  for(const s of Object.values(job.workflow.steps)){ lines.push(`${s.name.padEnd(18)} ${s.status.padEnd(8)} ${s.durationMs??''}ms`); if(s.error) lines.push(`  error: ${s.error}`); if(s.details?.reason) lines.push(`  reason: ${s.details.reason}`); }
  lines.push('----------------------------------------',`Exit Code: ${job.exitCode}`,'========================================');
  return lines.join('\n')+'\n';
}
function finalizeReport(job,args){
  const s=job.workflow.steps.REPORT; s.status=STEP_STATUS.RUNNING; s.startedAt=new Date().toISOString();
  ensureDir(REPORT_DIR);
  const overall=computeOverall(job,args); job.ok=overall.ok; job.workflow.overall=overall;
  const json=path.join(REPORT_DIR,`workflow-report-${job.jobId}.json`), txt=path.join(REPORT_DIR,`workflow-report-${job.jobId}.txt`);
  const latestJson=path.join(REPORT_DIR,'workflow-report.latest.json'), latestTxt=path.join(REPORT_DIR,'workflow-report.latest.txt');
  writeJson(json,job); fs.writeFileSync(txt,renderReport(job),'utf8'); writeJson(latestJson,job); fs.writeFileSync(latestTxt,renderReport(job),'utf8');
  s.finishedAt=new Date().toISOString(); s.durationMs=Date.now()-Date.parse(s.startedAt); s.status=STEP_STATUS.PASS; s.details={reportJsonPath:json,reportTxtPath:txt,latestJsonPath:latestJson,latestTxtPath:latestTxt};
}
function finalizeJob(job,logger,exitCode){
  job.finishedAt=new Date().toISOString(); job.durationMs=Date.now()-Date.parse(job.startedAt); job.exitCode=exitCode; job.ok=exitCode===0;
  writeJson(path.join(JOB_DIR,`job-${job.jobId}.json`),job); writeJson(path.join(JOB_DIR,'job.latest.json'),job);
  logger.log(`🧾 Job manifest: ${path.join(JOB_DIR,`job-${job.jobId}.json`)}`);
  logger.log(`${job.ok?'✅':'❌'} Job result: ${job.ok?'PASS':'FAIL'} exitCode=${exitCode}`);
}

async function main(){
  const args=parseArgs(process.argv);
  ensureDir(JOB_DIR); ensureDir(LOG_DIR); ensureDir(REPORT_DIR);
  const startedAt=new Date().toISOString(), jobId=safeIdFromIso(startedAt), logger=createLogger(jobId);
  const job={jobVersion:JOB_VERSION,jobId,mode:args.mode,startedAt,finishedAt:null,durationMs:null,ok:false,exitCode:null,workflow:{status:'RUNNING',steps:initializeWorkflow(args.mode,args),overall:null}};
  let exitCode=0;
  try{
    acquireLock(jobId);
    logger.log('============================================================'); logger.log(`🧭 AlphaTech Recovery Retention Workflow ${JOB_VERSION}`); logger.log('============================================================'); logger.log(`Mode: ${args.mode}`);
    const health=await stepHealthCheck(job,logger,args); if(health.status===STEP_STATUS.FAIL){ exitCode=50; finalizeReport(job,args); return; }
    const backup=await stepBackup(job,logger); if(backup.status!==STEP_STATUS.PASS){ exitCode=10; finalizeReport(job,args); return; }
    if(args.mode!=='backup-only'){ const vb=await stepVerifyBackup(job); if(vb.status!==STEP_STATUS.PASS){ exitCode=20; finalizeReport(job,args); return; } }
    if(args.mode==='full-drill'){ const restore=await stepRestore(job,logger); if(restore.status!==STEP_STATUS.PASS){ exitCode=30; finalizeReport(job,args); return; } const vr=await stepVerifyRecovery(job,logger); if(vr.status!==STEP_STATUS.PASS){ exitCode=40; finalizeReport(job,args); return; } }
    const upload=await stepUpload(job,logger,args); if(upload.status===STEP_STATUS.FAIL){ exitCode=60; finalizeReport(job,args); return; }
    const retention=await stepRetention(job,logger,args); if(retention.status===STEP_STATUS.FAIL){ exitCode=70; finalizeReport(job,args); return; }
    finalizeReport(job,args); exitCode=computeOverall(job,args).ok?0:90;
  }catch(e){ logger.log(`❌ Job runner failed: ${e.stack||e.message||String(e)}`); exitCode=1; }
  finally{ job.workflow.status=exitCode===0?'SUCCESS':'FAILED'; finalizeJob(job,logger,exitCode); releaseLock(); process.exitCode=exitCode; }
}
main();
