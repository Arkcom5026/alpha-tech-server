param(
  [Parameter(Mandatory = $false)]
  [int]$RepairJobId
)

$ErrorActionPreference = 'Stop'
$ServerRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..\..')

Push-Location $ServerRoot
try {
  node src/modules/repair/e2e/intake-completion/repairIntakeFixture.contract.test.js
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  node src/modules/repair/e2e/intake-completion/repairIntakeOutcome.contract.test.js
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  if ($RepairJobId -gt 0) {
    node src/modules/repair/e2e/intake-completion/verifyRepairIntakeOutcome.js $RepairJobId
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  } else {
    Write-Host 'Contract tests passed. Supply -RepairJobId after the Browser run to execute the read-only verifier against the selected E2E runtime authority.' -ForegroundColor Yellow
  }
} finally {
  Pop-Location
}
