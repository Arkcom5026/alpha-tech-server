$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$ExpectedBranch='feature/prisma-multifile-domain-organization'
$CertifiedSha='3a707e514f3fe8a73b44dc6ff314748445d8257b'
function Write-Utf8NoBom([string]$Path,[string]$Content){[IO.File]::WriteAllText($Path,$Content,(New-Object Text.UTF8Encoding($false)))}
function Get-DeclBlock([string]$Text,[string]$Kind,[string]$Name){
  $all=[regex]::Matches($Text,'(?m)^(generator|datasource|model|enum)\s+([A-Za-z_]\w*)\s*\{')
  $hit=$null;$index=-1
  for($i=0;$i-lt$all.Count;$i++){if($all[$i].Groups[1].Value-eq$Kind-and$all[$i].Groups[2].Value-eq$Name){$hit=$all[$i];$index=$i;break}}
  if($null-eq$hit){throw "Missing $Kind $Name"}
  $end=if($index+1-lt$all.Count){$all[$index+1].Index}else{$Text.Length}
  $raw=$Text.Substring($hit.Index,$end-$hit.Index)
  [pscustomobject]@{Start=$hit.Index;End=$end;Text=$raw.TrimEnd()}
}
Set-Location ((git rev-parse --show-toplevel).Trim())
if((git branch --show-current).Trim()-ne$ExpectedBranch){throw "Expected branch $ExpectedBranch"}
if(git status --porcelain --untracked-files=all){throw 'Working tree must be clean.'}
& git diff --quiet $CertifiedSha -- prisma
if($LASTEXITCODE-ne0){throw "Current Prisma tree differs from certified SHA $CertifiedSha"}
$targets=[ordered]@{
 'prisma/service/device-intake.prisma'=@(
  @('enum','DeviceIntakeStatus'),@('enum','DevicePriority'),@('enum','AccessoryType'),@('enum','DeviceConditionLevel'),@('enum','DeviceIntakeAuditEvent'),
  @('model','DeviceIntake'),@('model','DeviceIntakeSnapshot'),@('model','DeviceIntakeCondition'),@('model','DeviceIntakeAccessory'),@('model','DeviceIntakeConsent'),@('model','DeviceIntakeAudit'),@('model','DeviceIntakePhoto'),@('model','DeviceIntakeDocument'),@('model','DeviceIntakeChecklist'))
 'prisma/service/repair-claim.prisma'=@(
  @('enum','DeviceCategory'),@('enum','DeviceSourceType'),@('enum','RepairEstimateApprovalStatus'),@('enum','DeviceStatus'),@('enum','DeviceOwnershipType'),@('enum','DeviceActorType'),@('enum','DevicePassportEventType'),@('enum','WarrantyClaimRepairLinkState'),@('enum','WarrantyClaimStatus'),@('enum','WarrantyClaimResolution'),@('enum','RepairDiagnosisStatus'),@('enum','RepairQcStatus'),@('enum','RepairDeliveryStatus'),@('enum','RepairDeliveryMethod'),
  @('model','RepairJob'),@('model','RepairTrackingAccess'),@('model','RepairEstimateApproval'),@('model','RepairPartItem'),@('model','WarrantyClaim'),@('model','RepairDiagnosis'),@('model','RepairLaborItem'),@('model','RepairQualityCheck'),@('model','RepairDelivery'),@('model','Device'),@('model','DeviceOwnershipHistory'),@('model','DevicePassportEvent'),@('model','WarrantyClaimEvent'),@('model','WarrantyClaimCompletionCommand'))
}
$root=if($env:ALPHA_TECH_RECOVERY_ROOT){$env:ALPHA_TECH_RECOVERY_ROOT}else{Join-Path $env:SystemDrive 'alpha-tech-recovery'}
$backup=Join-Path $root ('prisma-wave3-v3-preapply-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force $backup|Out-Null
Get-ChildItem prisma -Recurse -File -Filter *.prisma|Where-Object{$_.FullName-notmatch'[\\/]migrations[\\/]'}|ForEach-Object{$rel=$_.FullName.Substring((Resolve-Path '.').Path.Length+1);$dst=Join-Path $backup $rel;New-Item -ItemType Directory -Force (Split-Path $dst -Parent)|Out-Null;Copy-Item $_.FullName $dst;if((Get-FileHash $_.FullName -Algorithm SHA256).Hash-ne(Get-FileHash $dst -Algorithm SHA256).Hash){throw "Backup hash mismatch: $rel"}}
$mainPath='prisma/schema.prisma';$main=[IO.File]::ReadAllText((Resolve-Path $mainPath));$remove=New-Object Collections.Generic.List[object]
foreach($path in $targets.Keys){$parts=New-Object Collections.Generic.List[string];foreach($d in $targets[$path]){$b=Get-DeclBlock $main $d[0] $d[1];$parts.Add($b.Text);$remove.Add($b)};$parent=Split-Path $path -Parent;if(!(Test-Path $parent)){New-Item -ItemType Directory -Force $parent|Out-Null};Write-Utf8NoBom $path (($parts-join"`r`n`r`n").TrimEnd()+"`r`n")}
foreach($b in @($remove|Sort-Object Start -Descending)){$main=$main.Remove($b.Start,$b.End-$b.Start)}
Write-Utf8NoBom $mainPath ($main.TrimEnd()+"`r`n")
if(git diff --name-only -- prisma/migrations){throw 'Migration directory changed.'}
Write-Host 'Wave 3 service-domain V3 candidate created.'
Write-Host "External recovery: $backup"
Write-Host 'No migration or database command was executed.'