$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$ExpectedBranch='feature/prisma-multifile-domain-organization'
$CertifiedSha='7704814755fa7fbc57fb6c3f13437ff66a44ccf7'
$ExpectedTotalModels=135;$ExpectedTotalEnums=114;$ExpectedMainModels=66;$ExpectedMainEnums=40
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
function Write-Utf8NoBom([string]$Path,[string]$Content){[IO.File]::WriteAllText($Path,$Content,(New-Object Text.UTF8Encoding($false)))}
function Normalize([string]$Text){(($Text-replace"`r`n","`n"-replace"`r","`n").Trim())+"`n"}
function Get-Block([string]$Text,[string]$Kind,[string]$Name){
  $m=[regex]::Match($Text,'(?m)^'+[regex]::Escape($Kind)+'\s+'+[regex]::Escape($Name)+'\s*\{')
  if(!$m.Success){throw "Missing $Kind $Name"}
  $next=[regex]::Match($Text.Substring($m.Index+$m.Length),'(?m)^(?:model|enum|generator|datasource)\s+[A-Za-z_][A-Za-z0-9_]*\s*\{')
  $segmentEnd=if($next.Success){$m.Index+$m.Length+$next.Index}else{$Text.Length}
  $segment=$Text.Substring($m.Index,$segmentEnd-$m.Index)
  $close=$segment.LastIndexOf('}')
  if($close-lt0){throw "Missing closing brace for $Kind $Name"}
  $Text.Substring($m.Index,$close+1).TrimEnd()
}
function Invoke-Logged([string]$Log,[scriptblock]$Command){$saved=$ErrorActionPreference;$ErrorActionPreference='Continue';try{$o=&$Command 2>&1;$c=$LASTEXITCODE}finally{$ErrorActionPreference=$saved};$t=(($o|ForEach-Object{$_.ToString()})-join[Environment]::NewLine);Write-Utf8NoBom $Log ($t+[Environment]::NewLine);$o|ForEach-Object{Write-Host $_};if($c-ne0){throw "Native command failed with exit code $c. See $Log"}}
Set-Location ((git rev-parse --show-toplevel).Trim())
if((git branch --show-current).Trim()-ne$ExpectedBranch){throw "Expected branch $ExpectedBranch"}
$allowed=@('prisma/schema.prisma',$TargetPath);$changed=@(git status --porcelain --untracked-files=all|ForEach-Object{$_.Substring(3)});$bad=@($changed|Where-Object{$_-notin$allowed});if($bad){throw "Unexpected working-tree paths:`n$($bad-join"`n")"}
if(!(Test-Path $TargetPath)){throw "Missing $TargetPath"}
$base=(git show "$CertifiedSha`:prisma/schema.prisma")-join"`n";$main=[IO.File]::ReadAllText((Resolve-Path 'prisma/schema.prisma'));$candidate=[IO.File]::ReadAllText((Resolve-Path $TargetPath));$count=0
foreach($d in $Targets){$bb=Normalize(Get-Block $base $d[0] $d[1]);$cb=Normalize(Get-Block $candidate $d[0] $d[1]);if($bb-ne$cb){throw "Block content changed: $($d[0]) $($d[1])"};if([regex]::IsMatch($main,'(?m)^'+[regex]::Escape($d[0])+'\s+'+[regex]::Escape($d[1])+'\s*\{')){throw "Block remains in main: $($d[1])"};$count++}
foreach($required in @('Branch','EmployeeProfile','Supplier','PurchaseOrderReceipt','Payment','PaymentItem','RefundTransaction','CustomerReceipt','CustomerReceiptAllocation','CustomerDeposit','DepositUsage','PaymentStatus','PaymentMethod','RefundMethod','ReceiptSource','PurchaseOrderStatus')){if(-not[regex]::IsMatch($main,'(?m)^(model|enum)\s+'+[regex]::Escape($required)+'\s*\{')){throw "Protected declaration missing from main: $required"}}
$files=@(Get-ChildItem prisma -Recurse -File -Filter *.prisma|Where-Object{$_.FullName-notmatch'[\\/]migrations[\\/]'});$tm=0;$te=0;foreach($f in $files){$x=[IO.File]::ReadAllText($f.FullName);$tm+=([regex]::Matches($x,'(?m)^model\s+\w+\s*\{')).Count;$te+=([regex]::Matches($x,'(?m)^enum\s+\w+\s*\{')).Count};$mm=([regex]::Matches($main,'(?m)^model\s+\w+\s*\{')).Count;$me=([regex]::Matches($main,'(?m)^enum\s+\w+\s*\{')).Count
if($tm-ne$ExpectedTotalModels-or$te-ne$ExpectedTotalEnums-or$mm-ne$ExpectedMainModels-or$me-ne$ExpectedMainEnums){throw "Inventory mismatch: total $tm/$te main $mm/$me"};if(git diff --name-only -- prisma/migrations){throw 'Migration directory changed.'}
$root=if($env:ALPHA_TECH_RECOVERY_ROOT){$env:ALPHA_TECH_RECOVERY_ROOT}else{Join-Path $env:SystemDrive 'alpha-tech-recovery'};$e=Join-Path $root ('prisma-wave4b1-verify-'+(Get-Date -Format 'yyyyMMdd-HHmmss'));New-Item -ItemType Directory -Force $e|Out-Null;$tmp=Join-Path ([IO.Path]::GetTempPath()) "alpha-tech-prisma-wave4b1-$PID";$tp=Join-Path $tmp 'prisma';New-Item -ItemType Directory -Force $tp|Out-Null
foreach($f in $files){$rel=$f.FullName.Substring((Resolve-Path 'prisma').Path.Length).TrimStart('\','/');$dst=Join-Path $tp $rel;New-Item -ItemType Directory -Force (Split-Path $dst -Parent)|Out-Null;Copy-Item $f.FullName $dst}
try{Invoke-Logged (Join-Path $e 'prisma-format.txt'){& npx.cmd prisma format --schema $tp};Invoke-Logged (Join-Path $e 'prisma-validate.txt'){& npx.cmd prisma validate --schema $tp};$ts=Join-Path $tp 'schema.prisma';$txt=[IO.File]::ReadAllText($ts);$txt=$txt-replace'output\s*=\s*"\.\./node_modules/\.prisma/client"','output = "../generated-client"';Write-Utf8NoBom $ts $txt;Invoke-Logged (Join-Path $e 'prisma-generate.txt'){& npx.cmd prisma generate --schema $tp};Write-Host "Wave 4B1 accounting verification PASS. Evidence: $e";Write-Host "Schema files: $($files.Count); models: $tm; enums: $te; moved blocks: $count"}finally{if(Test-Path $tmp){Remove-Item -Recurse -Force $tmp}}