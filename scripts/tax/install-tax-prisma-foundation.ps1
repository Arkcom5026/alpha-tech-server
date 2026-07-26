$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$schemaPath = Join-Path $repoRoot 'prisma\schema.prisma'
$candidatePath = Join-Path $repoRoot 'docs\tax\prisma\tax-foundation.additive.prisma'
$backupPath = Join-Path $repoRoot 'prisma\schema.before-tax-foundation.prisma'

if (-not (Test-Path $schemaPath)) {
  throw "Prisma schema not found: $schemaPath"
}

if (-not (Test-Path $candidatePath)) {
  throw "Tax foundation candidate not found: $candidatePath"
}

$branch = (git -C $repoRoot branch --show-current).Trim()
if ($branch -ne 'feature/tax-platform-authority') {
  throw "Wrong branch: $branch. Expected feature/tax-platform-authority"
}

$schema = Get-Content $schemaPath -Raw
if ($schema -match '(?m)^model\s+TaxCandidate\s*\{') {
  Write-Host 'Tax Prisma foundation is already installed. No changes made.' -ForegroundColor Yellow
  exit 0
}

Copy-Item $schemaPath $backupPath -Force

$candidate = Get-Content $candidatePath -Raw
$separator = "`r`n`r`n"
Set-Content -Path $schemaPath -Value ($schema.TrimEnd() + $separator + $candidate.Trim() + "`r`n") -Encoding utf8

Write-Host 'Tax Prisma foundation appended successfully.' -ForegroundColor Green
Write-Host "Backup: $backupPath"
Write-Host 'Next commands:'
Write-Host '  npx prisma format'
Write-Host '  npx prisma validate'
Write-Host '  npx prisma generate'
Write-Host '  npx prisma migrate dev --name add_tax_platform_foundation --create-only'
