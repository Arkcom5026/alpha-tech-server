$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ExpectedBranch = 'feature/prisma-multifile-domain-organization'
$BaseHead = '32c52ff303de4e61d310bd39b3f1e98309129786'
$RecoveryRoot = "recovery/prisma/$BaseHead"
$OriginalSchema = 'prisma/schema.prisma'
$RecoverySchema = "$RecoveryRoot/schema.prisma"

function Assert-Equal($Name, $Actual, $Expected) {
  if ($Actual -ne $Expected) { throw "$Name mismatch. Expected '$Expected' but found '$Actual'." }
}
function Write-Utf8NoBom($Path, $Content) {
  [IO.File]::WriteAllText($Path, $Content, (New-Object Text.UTF8Encoding($false)))
}
function Invoke-NativeLogged($LogPath, [scriptblock]$Command) {
  $saved = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { $output = & $Command 2>&1; $code = $LASTEXITCODE }
  finally { $ErrorActionPreference = $saved }
  $text = (($output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine)
  Write-Utf8NoBom $LogPath ($text + [Environment]::NewLine)
  $output | ForEach-Object { Write-Host $_ }
  if ($code -ne 0) { throw "Native command failed with exit code $code. See $LogPath" }
}
function Get-PackageVersion($Text, $Path) {
  $p = '"' + [regex]::Escape($Path) + '"\s*:\s*\{(?s:.*?)"version"\s*:\s*"([^"]+)"'
  $m = [regex]::Match($Text, $p)
  if (-not $m.Success) { throw "Version not found for $Path" }
  $m.Groups[1].Value
}

Set-Location ((git rev-parse --show-toplevel).Trim())
Assert-Equal 'Branch' ((git branch --show-current).Trim()) $ExpectedBranch
$head = (git rev-parse HEAD).Trim()
if (git status --porcelain) { throw 'Working tree must be clean before Wave 0 verification.' }

$originalBlob = (git rev-parse "HEAD:$OriginalSchema").Trim()
$recoveryBlob = (git rev-parse "HEAD:$RecoverySchema").Trim()
Assert-Equal 'Recovery Git blob' $recoveryBlob $originalBlob
$originalSha = (Get-FileHash $OriginalSchema -Algorithm SHA256).Hash
$recoverySha = (Get-FileHash $RecoverySchema -Algorithm SHA256).Hash
Assert-Equal 'Recovery SHA-256' $recoverySha $originalSha

$schemaFiles = @(
  git ls-files prisma |
  Where-Object { $_ -match '^prisma/.+\.prisma$' -and $_ -notmatch '^prisma/migrations/' } |
  Sort-Object -Unique
)
if ($schemaFiles.Count -eq 0) { throw 'No Prisma schema files found.' }

$mainText = Get-Content -Raw $OriginalSchema
$mainModels = ([regex]::Matches($mainText, '(?m)^model\s+\w+\s*\{')).Count
$mainEnums = ([regex]::Matches($mainText, '(?m)^enum\s+\w+\s*\{')).Count
Assert-Equal 'Main schema model count' $mainModels 128
Assert-Equal 'Main schema enum count' $mainEnums 107

$totalModels = 0; $totalEnums = 0
foreach ($file in $schemaFiles) {
  $text = Get-Content -Raw $file
  $totalModels += ([regex]::Matches($text, '(?m)^model\s+\w+\s*\{')).Count
  $totalEnums += ([regex]::Matches($text, '(?m)^enum\s+\w+\s*\{')).Count
}

$lockText = Get-Content -Raw package-lock.json
$prismaVersion = Get-PackageVersion $lockText 'node_modules/prisma'
$clientVersion = Get-PackageVersion $lockText 'node_modules/@prisma/client'
Assert-Equal 'Prisma CLI' $prismaVersion '6.16.2'
Assert-Equal 'Prisma Client' $clientVersion '6.16.2'

$packageText = Get-Content -Raw package.json
$schemaPathMatch = [regex]::Match($packageText, '"prisma"\s*:\s*\{(?s:.*?)"schema"\s*:\s*"([^"]+)"')
if (-not $schemaPathMatch.Success) { throw 'Prisma schema path not found.' }
$schemaPath = $schemaPathMatch.Groups[1].Value
Assert-Equal 'Prisma schema path' $schemaPath 'prisma'

$evidenceBase = if ($env:ALPHA_TECH_RECOVERY_ROOT) { $env:ALPHA_TECH_RECOVERY_ROOT } else { Join-Path $env:SystemDrive 'alpha-tech-recovery' }
$evidence = Join-Path $evidenceBase "prisma-wave0-$BaseHead-$head"
New-Item -ItemType Directory -Force $evidence | Out-Null

$schemaTree = (git ls-tree -r HEAD -- $schemaFiles) -join [Environment]::NewLine
Write-Utf8NoBom (Join-Path $evidence 'schema-tree.txt') ($schemaTree + [Environment]::NewLine)
$migrationTree = (git ls-tree -r HEAD -- prisma/migrations) -join [Environment]::NewLine
Write-Utf8NoBom (Join-Path $evidence 'migration-tree.txt') ($migrationTree + [Environment]::NewLine)

$tempRoot = Join-Path ([IO.Path]::GetTempPath()) "alpha-tech-prisma-wave0-$PID"
$tempPrisma = Join-Path $tempRoot 'prisma'
New-Item -ItemType Directory -Force $tempPrisma | Out-Null

foreach ($file in $schemaFiles) {
  $relative = $file.Substring(7)
  $dest = Join-Path $tempPrisma $relative
  $parent = Split-Path -Parent $dest
  if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Force $parent | Out-Null }
  Copy-Item $file $dest
}

try {
  # All commands run against the temporary Prisma directory. The generator output
  # therefore resolves under the temporary root and cannot collide with a running
  # server process that has locked the repository's query engine DLL.
  Invoke-NativeLogged (Join-Path $evidence 'prisma-format.txt') { & npx.cmd prisma format --schema $tempPrisma }
  Invoke-NativeLogged (Join-Path $evidence 'prisma-validate.txt') { & npx.cmd prisma validate --schema $tempPrisma }
  Invoke-NativeLogged (Join-Path $evidence 'prisma-generate.txt') { & npx.cmd prisma generate --schema $tempPrisma }

  $tempGeneratedClient = Join-Path $tempRoot 'node_modules/.prisma/client'
  if (-not (Test-Path $tempGeneratedClient)) {
    throw "Temporary Prisma Client output was not created at $tempGeneratedClient"
  }

  git diff --exit-code -- prisma
  if ($LASTEXITCODE -ne 0) { throw 'Prisma directory changed during verification.' }
  if (git status --porcelain) { throw 'Working tree became dirty during verification.' }

  $result = [ordered]@{
    verifiedAtUtc=[DateTime]::UtcNow.ToString('o'); branch=$ExpectedBranch; head=$head; baseHead=$BaseHead
    evidenceDirectory=$evidence; originalSchemaBlob=$originalBlob; recoverySchemaBlob=$recoveryBlob
    originalSchemaSha256=$originalSha; recoverySchemaSha256=$recoverySha
    schemaFileCount=$schemaFiles.Count; schemaFiles=$schemaFiles
    mainSchemaModelCount=$mainModels; mainSchemaEnumCount=$mainEnums
    totalModelCount=$totalModels; totalEnumCount=$totalEnums
    prismaCliVersion=$prismaVersion; prismaClientVersion=$clientVersion; prismaSchemaPath=$schemaPath
    verificationSchemaPath=$tempPrisma; generatedClientPath=$tempGeneratedClient
    originalPrismaDirectoryMutated=$false; repositoryNodeModulesMutated=$false
    migrationExecution='PROHIBITED'; databaseTarget='NONE'
  }
  Write-Utf8NoBom (Join-Path $evidence 'wave0-result.json') (($result | ConvertTo-Json -Depth 10) + [Environment]::NewLine)
  Write-Host "Wave 0 verification PASS. Evidence: $evidence"
  Write-Host "Schema files: $($schemaFiles.Count); total models: $totalModels; total enums: $totalEnums"
  Write-Host 'Original Prisma directory, repository node_modules, and migrations remain unchanged.'
}
finally {
  if (Test-Path $tempRoot) { Remove-Item -Recurse -Force $tempRoot }
}
