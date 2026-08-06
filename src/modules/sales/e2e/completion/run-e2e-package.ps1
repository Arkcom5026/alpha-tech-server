param(
  [Parameter(Mandatory = $false)]
  [int]$SaleId,

  [Parameter(Mandatory = $false)]
  [int]$BranchId
)

$ErrorActionPreference = 'Stop'
$ServerRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..\..')

Push-Location $ServerRoot
try {
  node src/modules/sales/e2e/completion/saleCompletionFixture.contract.test.js
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  node src/modules/sales/e2e/completion/saleCompletionOutcome.contract.test.js
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  if ($SaleId -gt 0 -and $BranchId -gt 0) {
    node src/modules/sales/e2e/completion/verifySaleCompletionOutcome.js $SaleId $BranchId
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  } else {
    Write-Host 'Contract tests passed. Supply -SaleId and -BranchId after the Browser run to execute the read-only verifier against the selected E2E runtime authority.' -ForegroundColor Yellow
  }
} finally {
  Pop-Location
}
