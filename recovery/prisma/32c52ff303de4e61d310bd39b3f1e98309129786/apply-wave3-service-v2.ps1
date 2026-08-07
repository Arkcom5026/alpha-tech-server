$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$ExpectedBranch='feature/prisma-multifile-domain-organization'
$CertifiedSha='3a707e514f3fe8a73b44dc6ff314748445d8257b'
function Write-Utf8NoBom([string]$Path,[string]$Content){[IO.File]::WriteAllText($Path,$Content,(New-Object Text.UTF8Encoding($false)))}
function Get-Block([string]$Text,[string]$Kind,[string]$Name){
  $m=[regex]::Match($Text,'(?m)^'+[regex]::Escape($Kind)+'\s+'+[regex]::Escape($Name)+'\s*\{')
  if(!$m.Success){throw "Missing $Kind $Name"}
  $b=$Text.IndexOf('{',$m.Index);$d=0;$e=-1;$inString=$false;$escape=$false;$inComment=$false
  for($i=$b;$i-lt$Text.Length;$i++){
    $c=$Text[$i]
    if($inComment){if($c-eq"`n"){$inComment=$false};continue}
    if($inString){if($escape){$escape=$false;continue};if($c-eq'\'){$escape=$true;continue};if($c-eq'"'){$inString=$false};continue}
    if($c-eq'/'-and$i+1-lt$Text.Length-and$Text[$i+1]-eq'/'){$inComment=$true;$i++;continue}
    if($c-eq'"'){$inString=$true;continue}
    if($c-eq'{'){$d++;continue}
    if($c-eq'}'){$d--;if($d-eq0){$e=$i+1;break}}
  }
  if($e-lt0){throw "Unclosed $Kind $Name"}
  [pscustomobject]@{Start=$m.Index;End=$e;Text=$Text.Substring($m.Index,$e-$m.Index)}
}
Set-Location ((git rev-parse --show-toplevel).Trim())
if((git branch --show-current).Trim()-ne$ExpectedBranch){throw "Expected branch $ExpectedBranch"}
if(git status --porcelain --untracked-files=all){throw 'Working tree must be clean.'}
& git diff --quiet $CertifiedSha -- prisma ':!prisma/migrations'
if($LASTEXITCODE-ne0){throw "Current Prisma schema tree differs from certified SHA $CertifiedSha"}
$targets=[ordered]@{
 'prisma/service/device-intake.prisma'=@(
  @('enum','DeviceIntakeStatus'),@('enum','DevicePriority'),@('enum','AccessoryType'),@('enum','DeviceConditionLevel'),@('enum','DeviceIntakeAuditEvent'),
  @('model','DeviceIntake'),@('model','DeviceIntakeSnapshot'),@('model','DeviceIntakeCondition'),@('model','DeviceIntakeAccessory'),@('model','DeviceIntakeConsent'),@('model','DeviceIntakeAudit'),@('model','DeviceIntakePhoto'),@('model','DeviceIntakeDocument'),@('model','DeviceIntakeChecklist'))
 'prisma/service/repair-claim.prisma'=@(
  @('enum','DeviceCategory'),@('enum','DeviceSourceType'),@('enum','RepairEstimateApprovalStatus'),@('enum','DeviceStatus'),@('enum','DeviceOwnershipType'),@('enum','DeviceActorType'),@('enum','DevicePassportEventType'),@('enum','WarrantyClaimRepairLinkState'),@('enum','WarrantyClaimStatus'),@('enum','WarrantyClaimResolution'),@('enum','RepairDiagnosisStatus'),@('enum','RepairQcStatus'),@('enum','RepairDeliveryStatus'),@('enum','RepairDeliveryMethod'),
  @('model','RepairJob'),@('model','RepairTrackingAccess'),@('model','RepairEstimateApproval'),@('model','RepairPartItem'),@('model','WarrantyClaim'),@('model','RepairDiagnosis'),@('model','RepairLaborItem'),@('model','RepairQualityCheck'),@('model','RepairDelivery'),@('model','Device'),@('model','DeviceOwnershipHistory'),@('model','DevicePassportEvent'),@('model','WarrantyClaimEvent'),@('model','WarrantyClaimCompletionCommand'))
}
$root=if($env:ALPHA_TECH_RECOVERY_ROOT){$env:ALPHA_TECH_RECOVERY_ROOT}else{Join-Path $env:SystemDrive 'alpha-tech-recovery'}
$backup=Join-Path $root ('prisma-wave3-v2-preapply-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force $backup|Out-Null
Get-ChildItem prisma -Recurse -File -Filter *.prisma|Where-Object{$_.FullName-notmatch'[\\/]migrations[\\/]'}|ForEach-Object{$rel=$_.FullName.Substring((Resolve-Path '.').Path.Length+1);$dst=Join-Path $backup $rel;New-Item -ItemType Directory -Force (Split-Path $dst -Parent)|Out-Null;Copy-Item $_.FullName $dst;if((Get-FileHash $_.FullName -Algorithm SHA256).Hash-ne(Get-FileHash $dst -Algorithm SHA256).Hash){throw "Backup hash mismatch: $rel"}}
$mainPath='prisma/schema.prisma';$main=[IO.File]::ReadAllText((Resolve-Path $mainPath));$remove=New-Object Collections.Generic.List[object]
foreach($path in $targets.Keys){$parts=New-Object Collections.Generic.List[string];foreach($d in $targets[$path]){$b=Get-Block $main $d[0] $d[1];$parts.Add($b.Text.Trim()+"`r`n");$remove.Add($b)};$parent=Split-Path $path -Parent;if(!(Test-Path $parent)){New-Item -ItemType Directory -Force $parent|Out-Null};Write-Utf8NoBom $path (($parts-join"`r`n").TrimEnd()+"`r`n")}
foreach($b in @($remove|Sort-Object Start -Descending)){$s=$b.Start;$e=$b.End;while($s-gt0-and($main[$s-1]-eq"`r"-or$main[$s-1]-eq"`n")){$s--};while($e-lt$main.Length-and($main[$e]-eq"`r"-or$main[$e]-eq"`n")){$e++};$main=$main.Remove($s,$e-$s)}
Write-Utf8NoBom $mainPath ($main.TrimEnd()+"`r`n")
if(git diff --name-only -- prisma/migrations){throw 'Migration directory changed.'}
Write-Host 'Wave 3 service-domain V2 candidate created.'
Write-Host "External recovery: $backup"
Write-Host 'No migration or database command was executed.'