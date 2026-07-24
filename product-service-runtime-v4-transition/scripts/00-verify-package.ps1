$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$required = @(
  "schema.prisma",
  "README.md",
  "sql\01-pre-migration-audit.sql",
  "sql\02-post-migration-reconciliation.sql",
  "scripts\01-capture-safety-evidence.ps1"
)
foreach ($relative in $required) {
  $path = Join-Path $root $relative
  if (-not (Test-Path $path)) { throw "Missing package file: $relative" }
}
Write-Host "Package verification: PASS" -ForegroundColor Green
