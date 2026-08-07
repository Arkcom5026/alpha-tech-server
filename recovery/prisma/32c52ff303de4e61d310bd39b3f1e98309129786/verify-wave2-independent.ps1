$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ExpectedBranch = 'feature/prisma-multifile-domain-organization'
$CertifiedSha = '628a69fd59bbdc382237b3de896a1dae1c40ed1a'
$ExpectedTotalModels = 135
$ExpectedTotalEnums = 114
$ExpectedMainModels = 106
$ExpectedMainEnums = 82

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding($false)))
}
function Normalize-Block([string]$Text) {
  (($Text -replace "`r`n", "`n" -replace "`r", "`n").Trim()) + "`n"
}
function Get-TopLevelBlock([string]$Text, [string]$Kind, [string]$Name) {
  $pattern = '(?m)^' + [regex]::Escape($Kind) + '\s+' + [regex]::Escape($Name) + '\s*\{'
  $match = [regex]::Match($Text, $pattern)
  if (-not $match.Success) { throw "Missing $Kind $Name" }
  $braceStart = $Text.IndexOf('{', $match.Index)
  $depth = 0; $end = -1
  for ($i=$braceStart; $i -lt $Text.Length; $i++) {
    if ($Text[$i] -eq '{') { $depth++ }
    elseif ($Text[$i] -eq '}') { $depth--; if ($depth -eq 0) { $end=$i+1; break } }
  }
  if ($end -lt 0) { throw "Unclosed $Kind $Name" }
  $Text.Substring($match.Index, $end-$match.Index)
}
function Invoke-NativeLogged([string]$LogPath, [scriptblock]$Command) {
  $saved=$ErrorActionPreference; $ErrorActionPreference='Continue'
  try { $output=& $Command 2>&1; $code=$LASTEXITCODE } finally { $ErrorActionPreference=$saved }
  $text=(($output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine)
  Write-Utf8NoBom $LogPath ($text+[Environment]::NewLine)
  $output | ForEach-Object { Write-Host $_ }
  if ($code -ne 0) { throw "Native command failed with exit code $code. See $LogPath" }
}

Set-Location ((git rev-parse --show-toplevel).Trim())
if ((git branch --show-current).Trim() -ne $ExpectedBranch) { throw "Expected branch $ExpectedBranch" }

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

$allowed = @('prisma/schema.prisma') + @($targets.Keys)
$changed = @(git status --porcelain --untracked-files=all | ForEach-Object { $_.Substring(3) })
$unexpected = @($changed | Where-Object { $_ -notin $allowed })
if ($unexpected) { throw "Unexpected working-tree paths:`n$($unexpected -join "`n")" }
foreach ($path in $targets.Keys) { if (-not (Test-Path $path)) { throw "Missing target $path" } }

$baseline = (git show "$CertifiedSha`:prisma/schema.prisma") -join "`n"
$main = [System.IO.File]::ReadAllText((Resolve-Path 'prisma/schema.prisma'))
$blockResults = New-Object System.Collections.Generic.List[object]
foreach ($path in $targets.Keys) {
  $candidate = [System.IO.File]::ReadAllText((Resolve-Path $path))
  foreach ($def in $targets[$path]) {
    $baseBlock = Normalize-Block (Get-TopLevelBlock $baseline $def[0] $def[1])
    $candidateBlock = Normalize-Block (Get-TopLevelBlock $candidate $def[0] $def[1])
    if ($baseBlock -ne $candidateBlock) { throw "Block content changed: $($def[0]) $($def[1])" }
    if ([regex]::IsMatch($main, '(?m)^'+[regex]::Escape($def[0])+'\s+'+[regex]::Escape($def[1])+'\s*\{')) {
      throw "Block still exists in prisma/schema.prisma: $($def[1])"
    }
    $blockResults.Add([ordered]@{ file=$path; kind=$def[0]; name=$def[1]; equivalent=$true })
  }
}

$schemaFiles = @(Get-ChildItem prisma -Recurse -File -Filter *.prisma | Where-Object { $_.FullName -notmatch '[\\/]migrations[\\/]' })
$totalModels=0; $totalEnums=0
foreach ($file in $schemaFiles) {
  $text=[System.IO.File]::ReadAllText($file.FullName)
  $totalModels += ([regex]::Matches($text,'(?m)^model\s+\w+\s*\{')).Count
  $totalEnums += ([regex]::Matches($text,'(?m)^enum\s+\w+\s*\{')).Count
}
$mainModels=([regex]::Matches($main,'(?m)^model\s+\w+\s*\{')).Count
$mainEnums=([regex]::Matches($main,'(?m)^enum\s+\w+\s*\{')).Count
if ($schemaFiles.Count -ne 11) { throw "Schema file count $($schemaFiles.Count) != 11" }
if ($totalModels -ne $ExpectedTotalModels) { throw "Total model count $totalModels != $ExpectedTotalModels" }
if ($totalEnums -ne $ExpectedTotalEnums) { throw "Total enum count $totalEnums != $ExpectedTotalEnums" }
if ($mainModels -ne $ExpectedMainModels) { throw "Main model count $mainModels != $ExpectedMainModels" }
if ($mainEnums -ne $ExpectedMainEnums) { throw "Main enum count $mainEnums != $ExpectedMainEnums" }
if (git diff --name-only -- prisma/migrations) { throw 'Migration directory changed.' }

$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$evidenceBase=if($env:ALPHA_TECH_RECOVERY_ROOT){$env:ALPHA_TECH_RECOVERY_ROOT}else{Join-Path $env:SystemDrive 'alpha-tech-recovery'}
$evidence=Join-Path $evidenceBase "prisma-wave2-verify-$stamp"
New-Item -ItemType Directory -Force $evidence | Out-Null
$tempRoot=Join-Path ([System.IO.Path]::GetTempPath()) "alpha-tech-prisma-wave2-$PID"
$tempPrisma=Join-Path $tempRoot 'prisma'
New-Item -ItemType Directory -Force $tempPrisma | Out-Null
foreach($file in $schemaFiles){
  $relative=$file.FullName.Substring((Resolve-Path 'prisma').Path.Length).TrimStart('\','/')
  $dest=Join-Path $tempPrisma $relative
  $parent=Split-Path -Parent $dest
  if(-not(Test-Path $parent)){New-Item -ItemType Directory -Force $parent|Out-Null}
  Copy-Item $file.FullName $dest
}

try {
  Invoke-NativeLogged (Join-Path $evidence 'prisma-format.txt') { & npx.cmd prisma format --schema $tempPrisma }
  Invoke-NativeLogged (Join-Path $evidence 'prisma-validate.txt') { & npx.cmd prisma validate --schema $tempPrisma }
  $tempSchema=Join-Path $tempPrisma 'schema.prisma'
  $tempText=[System.IO.File]::ReadAllText($tempSchema)
  $tempText=$tempText -replace 'output\s*=\s*"\.\./node_modules/\.prisma/client"','output = "../generated-client"'
  Write-Utf8NoBom $tempSchema $tempText
  Invoke-NativeLogged (Join-Path $evidence 'prisma-generate.txt') { & npx.cmd prisma generate --schema $tempPrisma }

  $result=[ordered]@{
    verifiedAtUtc=[DateTime]::UtcNow.ToString('o'); branch=$ExpectedBranch; head=(git rev-parse HEAD).Trim()
    certifiedWave1Sha=$CertifiedSha; evidenceDirectory=$evidence; schemaFileCount=$schemaFiles.Count
    totalModelCount=$totalModels; totalEnumCount=$totalEnums
    mainSchemaModelCount=$mainModels; mainSchemaEnumCount=$mainEnums
    movedBlockCount=$blockResults.Count; movedBlocks=$blockResults
    migrationDirectoryMutated=$false; databaseTarget='NONE'; migrationExecution='PROHIBITED'
  }
  Write-Utf8NoBom (Join-Path $evidence 'wave2-result.json') (($result|ConvertTo-Json -Depth 8)+"`n")
  Write-Host "Wave 2 independent-domain verification PASS. Evidence: $evidence"
  Write-Host "Schema files: $($schemaFiles.Count); models: $totalModels; enums: $totalEnums; moved blocks: $($blockResults.Count)"
}
finally { if(Test-Path $tempRoot){Remove-Item -Recurse -Force $tempRoot} }
