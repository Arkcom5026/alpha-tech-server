$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ExpectedBranch = 'feature/prisma-multifile-domain-organization'
$CertifiedSha = '628a69fd59bbdc382237b3de896a1dae1c40ed1a'
$MainSchema = 'prisma/schema.prisma'

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding($false)))
}
function Get-TopLevelBlock([string]$Text, [string]$Kind, [string]$Name) {
  $pattern = '(?m)^' + [regex]::Escape($Kind) + '\s+' + [regex]::Escape($Name) + '\s*\{'
  $match = [regex]::Match($Text, $pattern)
  if (-not $match.Success) { throw "Missing $Kind $Name" }
  $braceStart = $Text.IndexOf('{', $match.Index)
  $depth = 0; $end = -1
  for ($i = $braceStart; $i -lt $Text.Length; $i++) {
    if ($Text[$i] -eq '{') { $depth++ }
    elseif ($Text[$i] -eq '}') { $depth--; if ($depth -eq 0) { $end = $i + 1; break } }
  }
  if ($end -lt 0) { throw "Unclosed $Kind $Name" }
  $Text.Substring($match.Index, $end - $match.Index)
}
function Remove-TopLevelBlock([string]$Text, [string]$Kind, [string]$Name) {
  $block = Get-TopLevelBlock $Text $Kind $Name
  $start = $Text.IndexOf($block)
  $end = $start + $block.Length
  while ($end -lt $Text.Length -and ($Text[$end] -eq "`r" -or $Text[$end] -eq "`n")) { $end++ }
  $Text.Remove($start, $end - $start)
}

Set-Location ((git rev-parse --show-toplevel).Trim())
if ((git branch --show-current).Trim() -ne $ExpectedBranch) { throw "Expected branch $ExpectedBranch" }
if (git status --porcelain --untracked-files=all) { throw 'Working tree must be clean before Wave 2 apply.' }
if (git diff --name-only "$CertifiedSha..HEAD" -- prisma) { throw 'Current Prisma tree differs from certified Wave 1 SHA.' }

$targets = [ordered]@{
  'prisma/tax/tax-expense.prisma' = @(
    @('enum','TaxExpenseStatus'), @('enum','TaxExpenseCounterpartyType'), @('enum','ExpensePayeeType'),
    @('enum','TaxExpenseVatTreatment'), @('enum','TaxExpenseCitTreatment'), @('enum','TaxExpenseWhtTreatment'),
    @('enum','TaxExpenseEvidenceStatus'), @('enum','TaxExpenseAssessmentStatus'), @('enum','TaxExpenseAttachmentType'),
    @('enum','TaxExpenseLifecycleEventType'), @('model','TaxExpenseCategory'), @('model','ExpensePayee'),
    @('model','TaxExpense'), @('model','TaxExpenseItem'), @('model','TaxExpenseAssessment'),
    @('model','TaxExpenseLifecycleEvent'), @('model','TaxExpenseAttachment')
  )
  'prisma/commerce/barcode.prisma' = @(
    @('enum','BarcodeStatus'), @('enum','BarcodeKind'), @('model','BarcodeCounter'), @('model','BarcodeReceiptItem')
  )
  'prisma/foundation/geography.prisma' = @(
    @('model','Province'), @('model','District'), @('model','Subdistrict')
  )
}
foreach ($path in $targets.Keys) { if (Test-Path $path) { throw "Target already exists: $path" } }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$recoveryBase = if ($env:ALPHA_TECH_RECOVERY_ROOT) { $env:ALPHA_TECH_RECOVERY_ROOT } else { Join-Path $env:SystemDrive 'alpha-tech-recovery' }
$backup = Join-Path $recoveryBase "prisma-wave2-preapply-$stamp"
New-Item -ItemType Directory -Force -Path $backup | Out-Null
$trackedPrisma = @(git ls-files prisma | Where-Object { $_ -match '^prisma/.+\.prisma$' -and $_ -notmatch '^prisma/migrations/' })
foreach ($file in $trackedPrisma) {
  $dest = Join-Path $backup $file
  $parent = Split-Path -Parent $dest
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
  Copy-Item -LiteralPath $file -Destination $dest
  if ((Get-FileHash $file -Algorithm SHA256).Hash -ne (Get-FileHash $dest -Algorithm SHA256).Hash) { throw "Backup hash mismatch: $file" }
}

$main = [System.IO.File]::ReadAllText((Resolve-Path $MainSchema))
$baseline = (git show "$CertifiedSha`:$MainSchema") -join "`n"
if (-not $baseline) { throw 'Unable to read certified schema baseline.' }

foreach ($path in $targets.Keys) {
  $parts = New-Object System.Collections.Generic.List[string]
  foreach ($def in $targets[$path]) {
    $parts.Add((Get-TopLevelBlock $baseline $def[0] $def[1]).Trim())
    $main = Remove-TopLevelBlock $main $def[0] $def[1]
  }
  $parent = Split-Path -Parent $path
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
  Write-Utf8NoBom $path (($parts -join "`r`n`r`n") + "`r`n")
}

$main = $main.TrimEnd("`r","`n") + "`r`n"
Write-Utf8NoBom $MainSchema $main

if (git diff --name-only -- prisma/migrations) { throw 'Migration directory changed unexpectedly.' }
Write-Host 'Wave 2 independent-domain candidate created.'
Write-Host "External recovery: $backup"
Write-Host 'No migration or database command was executed.'
Write-Host 'Run git status --short --untracked-files=all and the Wave 2 verifier before committing.'
