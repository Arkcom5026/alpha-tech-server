param(
  [string]$SourceBranch = 'origin/feature/employee-vertical-slice-migration'
)

$ErrorActionPreference = 'Stop'

$expectedBranch = 'agent/employee-vertical-slice-extraction'
$currentBranch = (git branch --show-current).Trim()
if ($currentBranch -ne $expectedBranch) {
  throw "Run this script on $expectedBranch (current: $currentBranch)"
}

$paths = @(
  'src/modules/employee/create/createEmployeeController.js',
  'src/modules/employee/create/createEmployeeRepository.js',
  'src/modules/employee/create/createEmployeeService.js',
  'src/modules/employee/delete/deleteEmployeeController.js',
  'src/modules/employee/lookup/branches/branchLookupController.js',
  'src/modules/employee/lookup/branches/branchLookupRepository.js',
  'src/modules/employee/lookup/branches/branchLookupService.js',
  'src/modules/employee/lookup/positions/positionLookupController.js',
  'src/modules/employee/lookup/positions/positionLookupRepository.js',
  'src/modules/employee/lookup/positions/positionLookupService.js',
  'src/modules/employee/onboarding/onboardEmployeeController.js',
  'src/modules/employee/onboarding/onboardEmployeeRepository.js',
  'src/modules/employee/onboarding/onboardEmployeeService.js',
  'src/modules/employee/query/detail/detailEmployeeController.js',
  'src/modules/employee/query/detail/detailEmployeeRepository.js',
  'src/modules/employee/query/detail/detailEmployeeService.js',
  'src/modules/employee/query/list/listEmployeeController.js',
  'src/modules/employee/query/list/listEmployeeRepository.js',
  'src/modules/employee/query/list/listEmployeeService.js',
  'src/modules/employee/query/usersByRole/usersByRoleController.js',
  'src/modules/employee/query/usersByRole/usersByRoleRepository.js',
  'src/modules/employee/query/usersByRole/usersByRoleService.js',
  'src/modules/employee/role/updateEmployeeRoleController.js',
  'src/modules/employee/role/updateEmployeeRoleRepository.js',
  'src/modules/employee/role/updateEmployeeRoleService.js',
  'src/modules/employee/routes/employeeRoutes.js',
  'src/modules/employee/shared/employeeMapper.js',
  'src/modules/employee/shared/employeeUtils.js',
  'src/modules/employee/status/statusEmployeeController.js',
  'src/modules/employee/status/statusEmployeeRepository.js',
  'src/modules/employee/status/statusEmployeeService.js',
  'src/modules/employee/update/updateEmployeeController.js',
  'src/modules/employee/update/updateEmployeeRepository.js',
  'src/modules/employee/update/updateEmployeeService.js'
)

git fetch origin --prune
if ($LASTEXITCODE -ne 0) { throw 'git fetch failed' }

foreach ($path in $paths) {
  git cat-file -e "$SourceBranch`:$path" 2>$null
  if ($LASTEXITCODE -ne 0) { throw "Missing source path: $path" }

  git restore --source=$SourceBranch --worktree -- $path
  if ($LASTEXITCODE -ne 0) { throw "Failed restoring source path: $path" }
}

$routeContent = @'
'use strict';

module.exports = require('../src/modules/employee/routes/employeeRoutes');
'@

[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) 'routes/employeeRoutes.js'),
  $routeContent,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host 'Employee vertical slices extracted.' -ForegroundColor Green
Write-Host 'Legacy controllers remain until runtime certification.' -ForegroundColor DarkYellow
Write-Host 'Next: run syntax, route authority, and employee lifecycle verification.' -ForegroundColor Cyan
