$ErrorActionPreference = "Stop"

$repoRoot = (Get-Location).Path
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$out = Join-Path $repoRoot "migration-evidence\product-service-v4-$stamp"

New-Item -ItemType Directory -Force -Path $out | Out-Null

Write-Host "Capturing evidence to: $out" -ForegroundColor Cyan

function Invoke-LoggedCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [scriptblock]$Command,

        [Parameter(Mandatory = $true)]
        [string]$LogFile
    )

    Write-Host "[RUN ] $Name" -ForegroundColor Cyan

    $previousErrorActionPreference = $ErrorActionPreference
    $output = @()
    $exitCode = $null

    try {
        # Windows PowerShell can promote native stderr output to NativeCommandError
        # when ErrorActionPreference is Stop. Prisma writes normal informational
        # messages to stderr, so temporarily continue and trust the native exit code.
        $ErrorActionPreference = "Continue"

        $output = & $Command 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    $output | Out-File -LiteralPath $LogFile -Encoding utf8

    if ($null -eq $exitCode) {
        throw "$Name did not return a native exit code. See log: $LogFile"
    }

    if ($exitCode -ne 0) {
        throw "$Name failed (ExitCode=$exitCode). See log: $LogFile"
    }

    Write-Host "[PASS] $Name" -ForegroundColor Green
}

$schemaPath = Join-Path $repoRoot "prisma\schema.prisma"
$migrationsPath = Join-Path $repoRoot "prisma\migrations"

if (-not (Test-Path -LiteralPath $schemaPath -PathType Leaf)) {
    throw "Prisma schema was not found: $schemaPath"
}

Invoke-LoggedCommand `
    -Name "git status" `
    -Command { git status --short } `
    -LogFile (Join-Path $out "git-status.txt")

Invoke-LoggedCommand `
    -Name "git rev-parse HEAD" `
    -Command { git rev-parse HEAD } `
    -LogFile (Join-Path $out "git-head.txt")

Invoke-LoggedCommand `
    -Name "prisma migrate status" `
    -Command { npx prisma migrate status } `
    -LogFile (Join-Path $out "prisma-migrate-status.txt")

Invoke-LoggedCommand `
    -Name "prisma validate" `
    -Command { npx prisma validate } `
    -LogFile (Join-Path $out "prisma-validate.txt")

Get-FileHash -LiteralPath $schemaPath -Algorithm SHA256 |
    Format-List |
    Out-File -LiteralPath (Join-Path $out "schema-sha256.txt") -Encoding utf8

Copy-Item `
    -LiteralPath $schemaPath `
    -Destination (Join-Path $out "schema.prisma.snapshot") `
    -Force

if (Test-Path -LiteralPath $migrationsPath -PathType Container) {
    Get-ChildItem -LiteralPath $migrationsPath -Directory |
        Sort-Object Name |
        Select-Object Name |
        Format-Table -AutoSize |
        Out-File -LiteralPath (Join-Path $out "migration-list.txt") -Encoding utf8
}
else {
    "No prisma migrations directory found: $migrationsPath" |
        Out-File -LiteralPath (Join-Path $out "migration-list.txt") -Encoding utf8
}

Write-Host ""
Write-Host "Evidence capture: PASS" -ForegroundColor Green
Write-Host $out