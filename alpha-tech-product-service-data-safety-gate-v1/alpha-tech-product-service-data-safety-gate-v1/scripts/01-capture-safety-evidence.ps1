$ErrorActionPreference = 'Stop'

$root = (Get-Location).Path
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$out = Join-Path $root "migration-evidence/product-service-$stamp"
New-Item -ItemType Directory -Force -Path $out | Out-Null

Write-Host "Writing evidence to $out" -ForegroundColor Cyan

git status --short | Out-File -Encoding utf8 (Join-Path $out 'git-status.txt')
git rev-parse HEAD | Out-File -Encoding ascii (Join-Path $out 'git-head.txt')
npx prisma migrate status 2>&1 | Tee-Object -FilePath (Join-Path $out 'prisma-migrate-status.txt')
npx prisma validate 2>&1 | Tee-Object -FilePath (Join-Path $out 'prisma-validate.txt')
Get-FileHash prisma/schema.prisma -Algorithm SHA256 | Format-List | Out-File -Encoding utf8 (Join-Path $out 'schema-sha256.txt')
Get-ChildItem prisma/migrations | Sort-Object Name | Select-Object Name | Format-Table -HideTableHeaders | Out-File -Encoding utf8 (Join-Path $out 'migration-list.txt')

Copy-Item prisma/schema.prisma (Join-Path $out 'schema.prisma.snapshot')

Write-Host "Evidence shell captured. Execute each SQL file read-only and save its output in this directory." -ForegroundColor Yellow
Write-Host "Do not run migrate reset or db push against production." -ForegroundColor Red
