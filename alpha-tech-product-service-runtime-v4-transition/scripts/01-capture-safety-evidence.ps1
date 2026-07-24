$ErrorActionPreference = "Stop"

$repoRoot = (Get-Location).Path
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$out = Join-Path $repoRoot "migration-evidence\product-service-v4-$stamp"
New-Item -ItemType Directory -Force -Path $out | Out-Null

Write-Host "Capturing evidence to: $out" -ForegroundColor Cyan

git status --short | Out-File (Join-Path $out "git-status.txt") -Encoding utf8
git rev-parse HEAD | Out-File (Join-Path $out "git-head.txt") -Encoding utf8
npx prisma migrate status 2>&1 | Out-File (Join-Path $out "prisma-migrate-status.txt") -Encoding utf8
npx prisma validate 2>&1 | Out-File (Join-Path $out "prisma-validate.txt") -Encoding utf8
Get-FileHash .\prisma\schema.prisma -Algorithm SHA256 |
  Format-List | Out-File (Join-Path $out "schema-sha256.txt") -Encoding utf8
  Copy-Item -LiteralPath .\prisma\schema.prisma (Join-Path $out "schema.prisma.snapshot")
Get-ChildItem .\prisma\migrations |
  Sort-Object Name |
  Select-Object Name |
  Format-Table -AutoSize |
  Out-File (Join-Path $out "migration-list.txt") -Encoding utf8

Write-Host "Evidence capture: PASS" -ForegroundColor Green
Write-Host $out
