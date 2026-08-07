$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ExpectedBranch = 'feature/prisma-multifile-domain-organization'
$BaseHead = '32c52ff303de4e61d310bd39b3f1e98309129786'
$RecoveryRoot = "recovery/prisma/$BaseHead"
$OriginalSchema = 'prisma/schema.prisma'
$RecoverySchema = "$RecoveryRoot/schema.prisma"

function Assert-Equal([string]$Name, $Actual, $Expected) {
  if ($Actual -ne $Expected) {
    throw "$Name mismatch. Expected '$Expected' but found '$Actual'."
  }
}

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8)
}

function Invoke-LoggedNative([string]$LogPath, [scriptblock]$Command) {
  $output = & $Command 2>&1
  $exitCode = $LASTEXITCODE
  $text = (($output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine)
  Write-Utf8NoBom -Path $LogPath -Content ($text + [Environment]::NewLine)
  if ($output) { $output | ForEach-Object { Write-Host $_ } }
  if ($exitCode -ne 0) {
    throw "Native command failed with exit code $exitCode. See $LogPath"
  }
}

$RepoRoot = (git rev-parse --show-toplevel).Trim()
Set-Location $RepoRoot

$branch = (git branch --show-current).Trim()
Assert-Equal 'Branch' $branch $ExpectedBranch

$head = (git rev-parse HEAD).Trim()
$status = git status --porcelain
if ($status) {
  throw "Working tree must be clean before Wave 0 verification.`n$status"
}

$originalBlob = (git rev-parse "HEAD:$OriginalSchema").Trim()
$recoveryBlob = (git rev-parse "HEAD:$RecoverySchema").Trim()
Assert-Equal 'Recovery Git blob' $recoveryBlob $originalBlob

$originalSha256 = (Get-FileHash -Algorithm SHA256 $OriginalSchema).Hash
$recoverySha256 = (Get-FileHash -Algorithm SHA256 $RecoverySchema).Hash
Assert-Equal 'Recovery SHA-256' $recoverySha256 $originalSha256

$schemaText = Get-Content -Raw $OriginalSchema
$modelCount = ([regex]::Matches($schemaText, '(?m)^model\s+[A-Za-z_]\w*\s*\{')).Count
$enumCount = ([regex]::Matches($schemaText, '(?m)^enum\s+[A-Za-z_]\w*\s*\{')).Count
Assert-Equal 'Model count' $modelCount 128
Assert-Equal 'Enum count' $enumCount 107

# Windows PowerShell 5.1 does not support ConvertFrom-Json -Depth.
$lock = Get-Content -Raw package-lock.json | ConvertFrom-Json
$prismaVersion = $lock.packages.'node_modules/prisma'.version
$clientVersion = $lock.packages.'node_modules/@prisma/client'.version
Assert-Equal 'Prisma CLI lock version' $prismaVersion '6.16.2'
Assert-Equal '@prisma/client lock version' $clientVersion '6.16.2'

$package = Get-Content -Raw package.json | ConvertFrom-Json
Assert-Equal 'Prisma schema path' $package.prisma.schema 'prisma'

$EvidenceBase = if ($env:ALPHA_TECH_RECOVERY_ROOT) {
  $env:ALPHA_TECH_RECOVERY_ROOT
} else {
  Join-Path $env:SystemDrive 'alpha-tech-recovery'
}
$EvidenceDir = Join-Path $EvidenceBase "prisma-wave0-$BaseHead-$head"
New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null

$migrationInventoryPath = Join-Path $EvidenceDir 'migration-tree.txt'
$migrationInventory = (git ls-tree -r HEAD -- prisma/migrations) -join [Environment]::NewLine
Write-Utf8NoBom -Path $migrationInventoryPath -Content ($migrationInventory + [Environment]::NewLine)
$migrationTreeSha256 = (Get-FileHash -Algorithm SHA256 $migrationInventoryPath).Hash

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "alpha-tech-prisma-wave0-$PID"
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
$tempSchema = Join-Path $tempRoot 'schema.prisma'
Copy-Item -LiteralPath $OriginalSchema -Destination $tempSchema

try {
  Invoke-LoggedNative (Join-Path $EvidenceDir 'prisma-format.txt') { & npx.cmd prisma format --schema $tempSchema }
  $formattedSha256 = (Get-FileHash -Algorithm SHA256 $tempSchema).Hash

  Invoke-LoggedNative (Join-Path $EvidenceDir 'prisma-validate.txt') { & npx.cmd prisma validate --schema prisma }
  Invoke-LoggedNative (Join-Path $EvidenceDir 'prisma-generate.txt') { & npx.cmd prisma generate --schema prisma }

  git diff --exit-code -- prisma/schema.prisma prisma/migrations
  if ($LASTEXITCODE -ne 0) {
    throw 'Original schema or migration directory changed during verification.'
  }

  $postStatus = git status --porcelain
  if ($postStatus) {
    throw "Working tree became dirty during Wave 0 verification.`n$postStatus"
  }

  $result = [ordered]@{
    verifiedAtUtc = [DateTime]::UtcNow.ToString('o')
    branch = $branch
    head = $head
    baseHead = $BaseHead
    workingTreeClean = $true
    evidenceDirectory = $EvidenceDir
    originalSchemaBlob = $originalBlob
    recoverySchemaBlob = $recoveryBlob
    originalSchemaSha256 = $originalSha256
    recoverySchemaSha256 = $recoverySha256
    formattedTemporarySchemaSha256 = $formattedSha256
    formatterChangedTemporaryCopy = ($formattedSha256 -ne $originalSha256)
    modelCount = $modelCount
    enumCount = $enumCount
    prismaCliVersion = $prismaVersion
    prismaClientVersion = $clientVersion
    prismaSchemaPath = $package.prisma.schema
    migrationTreeSha256 = $migrationTreeSha256
    originalSchemaMutated = $false
    migrationDirectoryMutated = $false
    databaseTarget = 'NONE'
    migrationExecution = 'PROHIBITED'
  }

  $resultJson = $result | ConvertTo-Json -Depth 10
  Write-Utf8NoBom -Path (Join-Path $EvidenceDir 'wave0-result.json') -Content ($resultJson + [Environment]::NewLine)
  Write-Host "Wave 0 verification PASS. Evidence: $EvidenceDir"
  Write-Host 'Original schema and migrations remain unchanged.'
}
finally {
  if (Test-Path $tempRoot) {
    Remove-Item -Recurse -Force $tempRoot
  }
}
