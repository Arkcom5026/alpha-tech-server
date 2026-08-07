$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ExpectedBranch = 'feature/prisma-multifile-domain-organization'
$BaseHead = '32c52ff303de4e61d310bd39b3f1e98309129786'
$RecoveryRoot = "recovery/prisma/$BaseHead"
$OriginalSchema = 'prisma/schema.prisma'
$RecoverySchema = "$RecoveryRoot/schema.prisma"
$EvidenceDir = "$RecoveryRoot/local-evidence"

function Assert-Equal([string]$Name, $Actual, $Expected) {
  if ($Actual -ne $Expected) {
    throw "$Name mismatch. Expected '$Expected' but found '$Actual'."
  }
}

New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null

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

$lock = Get-Content -Raw package-lock.json | ConvertFrom-Json -Depth 100
$prismaVersion = $lock.packages.'node_modules/prisma'.version
$clientVersion = $lock.packages.'node_modules/@prisma/client'.version
Assert-Equal 'Prisma CLI lock version' $prismaVersion '6.16.2'
Assert-Equal '@prisma/client lock version' $clientVersion '6.16.2'

$package = Get-Content -Raw package.json | ConvertFrom-Json
Assert-Equal 'Prisma schema path' $package.prisma.schema 'prisma'

$migrationInventoryPath = Join-Path $EvidenceDir 'migration-tree.txt'
git ls-tree -r HEAD -- prisma/migrations | Set-Content -Encoding utf8NoBOM $migrationInventoryPath
$migrationTreeSha256 = (Get-FileHash -Algorithm SHA256 $migrationInventoryPath).Hash

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "alpha-tech-prisma-wave0-$PID"
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
$tempSchema = Join-Path $tempRoot 'schema.prisma'
Copy-Item -LiteralPath $OriginalSchema -Destination $tempSchema

try {
  npx prisma format --schema $tempSchema | Tee-Object -FilePath (Join-Path $EvidenceDir 'prisma-format.txt')
  $formattedSha256 = (Get-FileHash -Algorithm SHA256 $tempSchema).Hash

  npx prisma validate --schema prisma | Tee-Object -FilePath (Join-Path $EvidenceDir 'prisma-validate.txt')
  npx prisma generate --schema prisma | Tee-Object -FilePath (Join-Path $EvidenceDir 'prisma-generate.txt')

  git diff --exit-code -- prisma/schema.prisma prisma/migrations

  $result = [ordered]@{
    verifiedAtUtc = [DateTime]::UtcNow.ToString('o')
    branch = $branch
    head = $head
    baseHead = $BaseHead
    workingTreeClean = $true
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

  $result | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8NoBOM (Join-Path $EvidenceDir 'wave0-result.json')
  Write-Host 'Wave 0 verification PASS. Original schema and migrations remain unchanged.'
}
finally {
  if (Test-Path $tempRoot) {
    Remove-Item -Recurse -Force $tempRoot
  }
}
