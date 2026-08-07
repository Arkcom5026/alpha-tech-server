$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$ExpectedBranch='feature/prisma-multifile-domain-organization'
$CertifiedSha='7704814755fa7fbc57fb6c3f13437ff66a44ccf7'
$TargetPath='prisma/finance/accounting.prisma'
$Targets=@(
  @('model','SupplierPayment'),
  @('model','SupplierPaymentReceipt'),
  @('model','SupplierPayable'),
  @('model','SupplierPayableDispute'),
  @('model','SupplierPayableAdjustment'),
  @('model','SupplierPayableReceiptLink'),
  @('model','SupplierPaymentAllocation'),
  @('model','SupplierAdvance'),
  @('model','SupplierAdvanceAllocation'),
  @('enum','SupplierPayableStatus'),
  @('enum','SupplierPaymentLifecycleStatus'),
  @('enum','SupplierPaymentAllocationState'),
  @('enum','SupplierAdvanceStatus'),
  @('enum','SupplierPayableDisputeStatus'),
  @('enum','SupplierPayableAdjustmentDirection'),
  @('enum','SupplierPayableAdjustmentStatus'),
  @('enum','SupplierPayableAdjustmentType'),
  @('enum','PaymentType')
)
function Write-Utf8NoBomRetry([string]$Path,[string]$Content){
  $enc=New-Object Text.UTF8Encoding($false);$last=$null
  for($i=1;$i-le20;$i++){
    try{[IO.File]::WriteAllText($Path,$Content,$enc);return}catch{$last=$_.Exception;Start-Sleep -Milliseconds 250}
  }
  throw "Unable to write $Path after 20 attempts: $($last.Message)"
}
function Get-Block([string]$Text,[string]$Kind,[string]$Name){
  $m=[regex]::Match($Text,'(?m)^'+[regex]::Escape($Kind)+'\s+'+[regex]::Escape($Name)+'\s*\{')
  if(!$m.Success){throw "Missing $Kind $Name"}
  $next=[regex]::Match($Text.Substring($m.Index+$m.Length),'(?m)^(?:model|enum|generator|datasource)\s+[A-Za-z_][A-Za-z0-9_]*\s*\{')
  $segmentEnd=if($next.Success){$m.Index+$m.Length+$next.Index}else{$Text.Length}
  $segment=$Text.Substring($m.Index,$segmentEnd-$m.Index)
  $close=$segment.LastIndexOf('}')
  if($close-lt0){throw "Missing closing brace for $Kind $Name"}
  $end=$m.Index+$close+1
  [pscustomobject]@{Start=$m.Index;End=$end;Text=$Text.Substring($m.Index,$end-$m.Index).TrimEnd()}
}
Set-Location ((git rev-parse --show-toplevel).Trim())
if((git branch --show-current).Trim()-ne$ExpectedBranch){throw "Expected branch $ExpectedBranch"}
if(git status --porcelain --untracked-files=all){throw 'Working tree must be clean.'}
& git diff --quiet $CertifiedSha -- prisma
if($LASTEXITCODE-ne0){throw "Current Prisma tree differs from certified SHA $CertifiedSha"}
$root=if($env:ALPHA_TECH_RECOVERY_ROOT){$env:ALPHA_TECH_RECOVERY_ROOT}else{Join-Path $env:SystemDrive 'alpha-tech-recovery'}
$backup=Join-Path $root ('prisma-wave4b1-preapply-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force $backup|Out-Null
$schemaFiles=Get-ChildItem prisma -Recurse -File -Filter *.prisma|Where-Object{$_.FullName-notmatch'[\\/]migrations[\\/]'}
foreach($f in $schemaFiles){$rel=$f.FullName.Substring((Resolve-Path '.').Path.Length+1);$dst=Join-Path $backup $rel;New-Item -ItemType Directory -Force (Split-Path $dst -Parent)|Out-Null;Copy-Item $f.FullName $dst;if((Get-FileHash $f.FullName -Algorithm SHA256).Hash-ne(Get-FileHash $dst -Algorithm SHA256).Hash){throw "Backup hash mismatch: $rel"}}
$mainPath='prisma/schema.prisma';$main=[IO.File]::ReadAllText((Resolve-Path $mainPath));$remove=New-Object Collections.Generic.List[object];$parts=New-Object Collections.Generic.List[string]
foreach($d in $Targets){$b=Get-Block $main $d[0] $d[1];$parts.Add($b.Text);$remove.Add($b)}
$parent=Split-Path $TargetPath -Parent;if(!(Test-Path $parent)){New-Item -ItemType Directory -Force $parent|Out-Null}
try{
  Write-Utf8NoBomRetry $TargetPath (($parts-join"`r`n`r`n")+"`r`n")
  foreach($b in @($remove|Sort-Object Start -Descending)){$main=$main.Remove($b.Start,$b.End-$b.Start)}
  Write-Utf8NoBomRetry $mainPath $main
  if(git diff --name-only -- prisma/migrations){throw 'Migration directory changed.'}
}catch{
  Write-Warning "Wave 4B1 apply failed; restoring Prisma files from external recovery: $backup"
  git restore --source=HEAD --worktree -- prisma/schema.prisma | Out-Null
  Remove-Item $TargetPath -Force -ErrorAction SilentlyContinue
  throw
}
Write-Host 'Wave 4B1 accounting candidate created.'
Write-Host "External recovery: $backup"
Write-Host 'No migration or database command was executed.'