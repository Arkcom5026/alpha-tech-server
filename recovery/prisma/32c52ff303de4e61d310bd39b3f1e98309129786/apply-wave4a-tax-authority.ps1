$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$ExpectedBranch='feature/prisma-multifile-domain-organization'
$CertifiedSha='53cdbe3898ee76769af6986f96d82830c2e7eb29'
function Write-Utf8NoBom([string]$Path,[string]$Content){[IO.File]::WriteAllText($Path,$Content,(New-Object Text.UTF8Encoding($false)))}
function Get-Block([string]$Text,[string]$Kind,[string]$Name){$m=[regex]::Match($Text,'(?m)^'+[regex]::Escape($Kind)+'\s+'+[regex]::Escape($Name)+'\s*\{');if(!$m.Success){throw "Missing $Kind $Name"};$tail=$Text.Substring($m.Index);$close=[regex]::Match($tail,'(?m)^\s*}\s*(?:\r?\n|$)');if(!$close.Success){throw "Missing closing brace for $Kind $Name"};$end=$m.Index+$close.Index+$close.Length;[pscustomobject]@{Start=$m.Index;End=$end;Text=$Text.Substring($m.Index,$end-$m.Index).TrimEnd()}}
Set-Location ((git rev-parse --show-toplevel).Trim())
if((git branch --show-current).Trim()-ne$ExpectedBranch){throw "Expected branch $ExpectedBranch"}
if(git status --porcelain --untracked-files=all){throw 'Working tree must be clean.'}
& git diff --quiet $CertifiedSha -- prisma; if($LASTEXITCODE-ne0){throw "Current Prisma tree differs from certified SHA $CertifiedSha"}
$targets=[ordered]@{
 'prisma/tax/tax-document.prisma'=@(
  @('enum','TaxIssuerProfileStatus'),@('model','TaxIssuerProfile'),@('model','TaxCandidate'),@('model','TaxDocument'),@('model','TaxDocumentLifecycleEvent'),
  @('enum','TaxCandidateStatus'),@('enum','TaxDocumentType'),@('enum','TaxLifecycleStatus'),@('enum','TaxSourceType'),@('enum','TaxEventType'),@('enum','TaxLedgerType'),@('enum','TaxPeriodStatus'))
 'prisma/tax/tax-invoice.prisma'=@(
  @('enum','TaxInvoiceKind'),@('model','InputTaxFilingBatch'),@('model','SalesTaxFilingBatch'),@('model','SalesTaxFilingItem'),@('model','InputTaxFilingItem'),
  @('enum','InputTaxFilingStatus'),@('enum','InputTaxDocumentMode'),@('enum','TaxDocumentReceiptSource'),@('enum','InputTaxFilingItemStatus'),@('enum','SalesTaxFilingStatus'))
}
$root=if($env:ALPHA_TECH_RECOVERY_ROOT){$env:ALPHA_TECH_RECOVERY_ROOT}else{Join-Path $env:SystemDrive 'alpha-tech-recovery'}
$backup=Join-Path $root ('prisma-wave4a-preapply-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force $backup|Out-Null
Get-ChildItem prisma -Recurse -File -Filter *.prisma|Where-Object{$_.FullName-notmatch'[\\/]migrations[\\/]'}|ForEach-Object{$rel=$_.FullName.Substring((Resolve-Path '.').Path.Length+1);$dst=Join-Path $backup $rel;New-Item -ItemType Directory -Force (Split-Path $dst -Parent)|Out-Null;Copy-Item $_.FullName $dst;if((Get-FileHash $_.FullName -Algorithm SHA256).Hash-ne(Get-FileHash $dst -Algorithm SHA256).Hash){throw "Backup hash mismatch: $rel"}}
$mainPath='prisma/schema.prisma';$main=[IO.File]::ReadAllText((Resolve-Path $mainPath));$remove=New-Object Collections.Generic.List[object]
foreach($path in $targets.Keys){$parts=New-Object Collections.Generic.List[string];foreach($d in $targets[$path]){$b=Get-Block $main $d[0] $d[1];$parts.Add($b.Text);$remove.Add($b)};$parent=Split-Path $path -Parent;if(!(Test-Path $parent)){New-Item -ItemType Directory -Force $parent|Out-Null};Write-Utf8NoBom $path (($parts-join"`r`n`r`n")+"`r`n")}
foreach($b in @($remove|Sort-Object Start -Descending)){$main=$main.Remove($b.Start,$b.End-$b.Start)}
Write-Utf8NoBom $mainPath $main
if(git diff --name-only -- prisma/migrations){throw 'Migration directory changed.'}
Write-Host 'Wave 4A tax-authority candidate created.'
Write-Host "External recovery: $backup"
Write-Host 'No migration or database command was executed.'