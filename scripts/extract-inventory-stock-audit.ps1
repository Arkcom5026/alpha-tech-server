param(
  [string]$SourceBranch = 'origin/feature/inventory-stock-audit-query-slices'
)

$ErrorActionPreference = 'Stop'

$expectedBranch = 'agent/inventory-stock-audit-extraction'
$currentBranch = (git branch --show-current).Trim()
if ($currentBranch -ne $expectedBranch) {
  throw "Run this script on $expectedBranch (current: $currentBranch)"
}

$paths = @(
  'src/modules/inventory/audit/finalize/finalizeAuditController.js',
  'src/modules/inventory/audit/finalize/finalizeAuditRepository.js',
  'src/modules/inventory/audit/finalize/finalizeAuditService.js',
  'src/modules/inventory/audit/finalize/finalizeAuditSlice.test.js',
  'src/modules/inventory/audit/query/active/getActiveAuditController.js',
  'src/modules/inventory/audit/query/active/getActiveAuditRepository.js',
  'src/modules/inventory/audit/query/active/getActiveAuditService.js',
  'src/modules/inventory/audit/query/items/listAuditItemsController.js',
  'src/modules/inventory/audit/query/items/listAuditItemsRepository.js',
  'src/modules/inventory/audit/query/items/listAuditItemsService.js',
  'src/modules/inventory/audit/query/items/listAuditItemsSlice.test.js',
  'src/modules/inventory/audit/query/overview/getAuditOverviewController.js',
  'src/modules/inventory/audit/query/overview/getAuditOverviewRepository.js',
  'src/modules/inventory/audit/query/overview/getAuditOverviewService.js',
  'src/modules/inventory/audit/routes/stockAuditRoutes.js',
  'src/modules/inventory/audit/scan/scanAuditController.js',
  'src/modules/inventory/audit/scan/scanAuditRepository.js',
  'src/modules/inventory/audit/scan/scanAuditService.js',
  'src/modules/inventory/audit/scan/scanAuditSlice.test.js',
  'src/modules/inventory/audit/shared/stockAuditHttp.js',
  'src/modules/inventory/audit/start/startAuditController.js',
  'src/modules/inventory/audit/start/startAuditRepository.js',
  'src/modules/inventory/audit/start/startAuditService.js',
  'src/modules/inventory/audit/start/startAuditSlice.test.js',
  'src/modules/inventory/audit/stockAuditQuerySlices.test.js'
)

git fetch origin --prune
if ($LASTEXITCODE -ne 0) { throw 'git fetch failed' }

foreach ($path in $paths) {
  git cat-file -e "$SourceBranch`:$path" 2>$null
  if ($LASTEXITCODE -ne 0) { throw "Missing source path: $path" }

  $directory = Split-Path -Parent $path
  if ($directory) { New-Item -ItemType Directory -Force -Path $directory | Out-Null }

  git show "$SourceBranch`:$path" | Set-Content -Path $path -Encoding utf8
}

@'
'use strict';

module.exports = require('../src/modules/inventory/audit/routes/stockAuditRoutes');
'@ | Set-Content -Path 'routes/stockAuditRoutes.js' -Encoding utf8

Write-Host 'Inventory Stock Audit capability extracted.' -ForegroundColor Green
Write-Host 'Next: run syntax/tests, inspect diff, commit, and push.' -ForegroundColor Cyan
