$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$ExpectedBranch='feature/prisma-multifile-domain-organization'
$CertifiedSha='3a707e514f3fe8a73b44dc6ff314748445d8257b'
$ExpectedTotalModels=135;$ExpectedTotalEnums=114;$ExpectedMainModels=83;$ExpectedMainEnums=63
function Write-Utf8NoBom([string]$Path,[string]$Content){[IO.File]::WriteAllText($Path,$Content,(New-Object Text.UTF8Encoding($false)))}
function Normalize([string]$Text){(($Text-replace"`r`n","`n"-replace"`r","`n").Trim())+"`n"}
function Get-DeclBlock([string]$Text,[string]$Kind,[string]$Name){
  $all=[regex]::Matches($Text,'(?m)^(generator|datasource|model|enum)\s+([A-Za-z_]\w*)\s*\{')
  $hit=$null;$idx=-1
  for($i=0;$i-lt$all.Count;$i++){
    if($all[$i].Groups[1].Value-eq$Kind-and$all[$i].Groups[2].Value-eq$Name){$hit=$all[$i];$idx=$i;break}
  }
  if($null-eq$hit){throw "Missing $Kind $Name"}
  $segmentEnd=if($idx+1-lt$all.Count){$all[$idx+1].Index}else{$Text.Length}
  $segment=$Text.Substring($hit.Index,$segmentEnd-$hit.Index)
  $close=$segment.LastIndexOf('}')
  if($close-lt0){throw "Missing closing brace for $Kind $Name"}
  $segment.Substring(0,$close+1)
}
function Invoke-Logged([string]$Log,[scriptblock]$Command){$saved=$ErrorActionPreference;$ErrorActionPreference='Continue';try{$o=&$Command 2>&1;$c=$LASTEXITCODE}finally{$ErrorActionPreference=$saved};$t=(($o|ForEach-Object{$_.ToString()})-join[Environment]::NewLine);Write-Utf8NoBom $Log ($t+[Environment]::NewLine);$o|ForEach-Object{Write-Host $_};if($c-ne0){throw "Native command failed with exit code $c. See $Log"}}
Set-Location ((git rev-parse --show-toplevel).Trim())
if((git branch --show-current).Trim()-ne$ExpectedBranch){throw "Expected branch $ExpectedBranch"}
$targets=[ordered]@{
 'prisma/service/device-intake.prisma'=@(
  @('enum','DeviceIntakeStatus'),@('enum','DevicePriority'),@('enum','AccessoryType'),@('enum','DeviceConditionLevel'),@('enum','DeviceIntakeAuditEvent'),
  @('model','DeviceIntake'),@('model','DeviceIntakeSnapshot'),@('model','DeviceIntakeCondition'),@('model','DeviceIntakeAccessory'),@('model','DeviceIntakeConsent'),@('model','DeviceIntakeAudit'),@('model','DeviceIntakePhoto'),@('model','DeviceIntakeDocument'),@('model','DeviceIntakeChecklist'))
 'prisma/service/repair-claim.prisma'=@(
  @('enum','DeviceCategory'),@('enum','DeviceSourceType'),@('enum','RepairEstimateApprovalStatus'),@('enum','DeviceStatus'),@('enum','DeviceOwnershipType'),@('enum','DeviceActorType'),@('enum','DevicePassportEventType'),@('enum','WarrantyClaimRepairLinkState'),@('enum','WarrantyClaimStatus'),@('enum','WarrantyClaimResolution'),@('enum','RepairDiagnosisStatus'),@('enum','RepairQcStatus'),@('enum','RepairDeliveryStatus'),@('enum','RepairDeliveryMethod'),
  @('model','RepairJob'),@('model','RepairTrackingAccess'),@('model','RepairEstimateApproval'),@('model','RepairPartItem'),@('model','WarrantyClaim'),@('model','RepairDiagnosis'),@('model','RepairLaborItem'),@('model','RepairQualityCheck'),@('model','RepairDelivery'),@('model','Device'),@('model','DeviceOwnershipHistory'),@('model','DevicePassportEvent'),@('model','WarrantyClaimEvent'),@('model','WarrantyClaimCompletionCommand'))
}
$allowed=@('prisma/schema.prisma')+@($targets.Keys);$changed=@(git status --porcelain --untracked-files=all|ForEach-Object{$_.Substring(3)});$bad=@($changed|Where-Object{$_-notin$allowed});if($bad){throw "Unexpected working-tree paths:`n$($bad-join"`n")"}
$base=(git show "$CertifiedSha`:prisma/schema.prisma")-join"`n";$main=[IO.File]::ReadAllText((Resolve-Path 'prisma/schema.prisma'));$count=0
foreach($path in $targets.Keys){if(!(Test-Path $path)){throw "Missing $path"};$candidate=[IO.File]::ReadAllText((Resolve-Path $path));foreach($d in $targets[$path]){$bb=Normalize(Get-DeclBlock $base $d[0] $d[1]);$cb=Normalize(Get-DeclBlock $candidate $d[0] $d[1]);if($bb-ne$cb){throw "Block content changed: $($d[0]) $($d[1])"};if([regex]::IsMatch($main,'(?m)^'+[regex]::Escape($d[0])+'\s+'+[regex]::Escape($d[1])+'\s*\{')){throw "Block remains in main: $($d[1])"};$count++}}
foreach($required in @('TaxCandidate','ProductReservationActorType','PurchaseOrderStatus','ReceiptSource')){if(-not[regex]::IsMatch($main,'(?m)^(model|enum)\s+'+[regex]::Escape($required)+'\s*\{')){throw "Protected declaration missing from main: $required"}}
$files=@(Get-ChildItem prisma -Recurse -File -Filter *.prisma|Where-Object{$_.FullName-notmatch'[\\/]migrations[\\/]'});$tm=0;$te=0;foreach($f in $files){$x=[IO.File]::ReadAllText($f.FullName);$tm+=([regex]::Matches($x,'(?m)^model\s+\w+\s*\{')).Count;$te+=([regex]::Matches($x,'(?m)^enum\s+\w+\s*\{')).Count};$mm=([regex]::Matches($main,'(?m)^model\s+\w+\s*\{')).Count;$me=([regex]::Matches($main,'(?m)^enum\s+\w+\s*\{')).Count
if($tm-ne$ExpectedTotalModels-or$te-ne$ExpectedTotalEnums-or$mm-ne$ExpectedMainModels-or$me-ne$ExpectedMainEnums){throw "Inventory mismatch: total $tm/$te main $mm/$me"};if(git diff --name-only -- prisma/migrations){throw 'Migration directory changed.'}
$root=if($env:ALPHA_TECH_RECOVERY_ROOT){$env:ALPHA_TECH_RECOVERY_ROOT}else{Join-Path $env:SystemDrive 'alpha-tech-recovery'};$e=Join-Path $root ('prisma-wave3-v3-verify-'+(Get-Date -Format 'yyyyMMdd-HHmmss'));New-Item -ItemType Directory -Force $e|Out-Null;$tmp=Join-Path ([IO.Path]::GetTempPath()) "alpha-tech-prisma-wave3-v3-$PID";$tp=Join-Path $tmp 'prisma';New-Item -ItemType Directory -Force $tp|Out-Null
foreach($f in $files){$rel=$f.FullName.Substring((Resolve-Path 'prisma').Path.Length).TrimStart('\','/');$dst=Join-Path $tp $rel;New-Item -ItemType Directory -Force (Split-Path $dst -Parent)|Out-Null;Copy-Item $f.FullName $dst}
try{Invoke-Logged (Join-Path $e 'prisma-format.txt'){& npx.cmd prisma format --schema $tp};Invoke-Logged (Join-Path $e 'prisma-validate.txt'){& npx.cmd prisma validate --schema $tp};$ts=Join-Path $tp 'schema.prisma';$txt=[IO.File]::ReadAllText($ts);$txt=$txt-replace'output\s*=\s*"\.\./node_modules/\.prisma/client"','output = "../generated-client"';Write-Utf8NoBom $ts $txt;Invoke-Logged (Join-Path $e 'prisma-generate.txt'){& npx.cmd prisma generate --schema $tp};Write-Host "Wave 3 service-domain V3 verification PASS. Evidence: $e";Write-Host "Schema files: $($files.Count); models: $tm; enums: $te; moved blocks: $count"}finally{if(Test-Path $tmp){Remove-Item -Recurse -Force $tmp}}
