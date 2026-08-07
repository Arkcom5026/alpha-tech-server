$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ExpectedBranch = 'feature/prisma-multifile-domain-organization'
$ExpectedHead = '628a69fd59bbdc382237b3de896a1dae1c40ed1a'

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding($false)))
}

Set-Location ((git rev-parse --show-toplevel).Trim())

$branch = (git branch --show-current).Trim()
if ($branch -ne $ExpectedBranch) { throw "Expected branch $ExpectedBranch but found $branch" }

$head = (git rev-parse HEAD).Trim()
if ($head -ne $ExpectedHead) { throw "Expected HEAD $ExpectedHead but found $head" }

if (git status --porcelain --untracked-files=all) {
  throw 'Working tree must be clean before creating the Wave 2 checkpoint.'
}

$schemaFiles = @(
  git ls-files prisma |
  Where-Object { $_ -match '^prisma/.+\.prisma$' -and $_ -notmatch '^prisma/migrations/' } |
  Sort-Object -Unique
)
if ($schemaFiles.Count -ne 8) { throw "Expected 8 Prisma schema files but found $($schemaFiles.Count)" }

$recoveryBase = if ($env:ALPHA_TECH_RECOVERY_ROOT) {
  $env:ALPHA_TECH_RECOVERY_ROOT
} else {
  Join-Path $env:SystemDrive 'alpha-tech-recovery'
}
$checkpoint = Join-Path $recoveryBase "prisma-wave2-checkpoint-$ExpectedHead"
if (Test-Path $checkpoint) {
  throw "Checkpoint already exists: $checkpoint"
}

New-Item -ItemType Directory -Force -Path $checkpoint | Out-Null
$filesRoot = Join-Path $checkpoint 'files'
New-Item -ItemType Directory -Force -Path $filesRoot | Out-Null

$entries = New-Object System.Collections.Generic.List[object]
$totalModels = 0
$totalEnums = 0

foreach ($file in $schemaFiles) {
  $destination = Join-Path $filesRoot $file
  $parent = Split-Path -Parent $destination
  if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  Copy-Item -LiteralPath $file -Destination $destination

  $sourceHash = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
  $copyHash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash
  if ($sourceHash -ne $copyHash) { throw "SHA-256 mismatch after copying $file" }

  $sourceLength = (Get-Item -LiteralPath $file).Length
  $copyLength = (Get-Item -LiteralPath $destination).Length
  if ($sourceLength -ne $copyLength) { throw "Byte length mismatch after copying $file" }

  $blob = (git rev-parse "HEAD:$file").Trim()
  $text = [System.IO.File]::ReadAllText((Resolve-Path $file))
  $models = ([regex]::Matches($text, '(?m)^model\s+\w+\s*\{')).Count
  $enums = ([regex]::Matches($text, '(?m)^enum\s+\w+\s*\{')).Count
  $totalModels += $models
  $totalEnums += $enums

  $entries.Add([ordered]@{
    path = $file
    gitBlob = $blob
    sha256 = $sourceHash
    byteLength = $sourceLength
    modelCount = $models
    enumCount = $enums
    recoveryPath = $destination
  })
}

if ($totalModels -ne 135) { throw "Expected 135 models but found $totalModels" }
if ($totalEnums -ne 114) { throw "Expected 114 enums but found $totalEnums" }

$schemaTree = (git ls-tree -r HEAD -- $schemaFiles) -join [Environment]::NewLine
Write-Utf8NoBom (Join-Path $checkpoint 'schema-tree.txt') ($schemaTree + [Environment]::NewLine)

$migrationTree = (git ls-tree -r HEAD -- prisma/migrations) -join [Environment]::NewLine
Write-Utf8NoBom (Join-Path $checkpoint 'migration-tree.txt') ($migrationTree + [Environment]::NewLine)

$schemaTreeHash = (Get-FileHash (Join-Path $checkpoint 'schema-tree.txt') -Algorithm SHA256).Hash
$migrationTreeHash = (Get-FileHash (Join-Path $checkpoint 'migration-tree.txt') -Algorithm SHA256).Hash

$manifest = [ordered]@{
  createdAtUtc = [DateTime]::UtcNow.ToString('o')
  branch = $ExpectedBranch
  head = $ExpectedHead
  checkpointDirectory = $checkpoint
  schemaFileCount = $schemaFiles.Count
  totalModelCount = $totalModels
  totalEnumCount = $totalEnums
  schemaTreeSha256 = $schemaTreeHash
  migrationTreeSha256 = $migrationTreeHash
  migrationExecution = 'PROHIBITED'
  databaseTarget = 'NONE'
  files = $entries
}

Write-Utf8NoBom (Join-Path $checkpoint 'manifest.json') (($manifest | ConvertTo-Json -Depth 8) + [Environment]::NewLine)

if (git status --porcelain --untracked-files=all) {
  throw 'Repository working tree changed while creating the checkpoint.'
}

Write-Host 'Wave 2 recovery checkpoint PASS.'
Write-Host "Checkpoint: $checkpoint"
Write-Host "Schema files: $($schemaFiles.Count); models: $totalModels; enums: $totalEnums"
Write-Host "Schema tree SHA-256: $schemaTreeHash"
Write-Host "Migration tree SHA-256: $migrationTreeHash"
Write-Host 'Repository files, migrations, and database remain unchanged.'
