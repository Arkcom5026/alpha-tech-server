param(
  [switch]$Apply,
  [switch]$SkipValidate
)

$ErrorActionPreference = 'Stop'

function Get-PrismaDeclarations {
  param(
    [Parameter(Mandatory = $true)][string]$Content,
    [Parameter(Mandatory = $true)][string]$SourceLabel
  )

  $matches = [regex]::Matches(
    $Content,
    '(?m)^(?<kind>model|enum)\s+(?<name>[A-Za-z_][A-Za-z0-9_]*)\s*\{'
  )

  $declarations = @()

  foreach ($match in $matches) {
    $start = $match.Index
    $openBrace = $Content.IndexOf('{', $start)
    $depth = 0
    $end = -1

    for ($index = $openBrace; $index -lt $Content.Length; $index++) {
      $character = $Content[$index]

      if ($character -eq '{') {
        $depth++
      }
      elseif ($character -eq '}') {
        $depth--

        if ($depth -eq 0) {
          $end = $index
          break
        }
      }
    }

    if ($end -lt 0) {
      throw "Unclosed Prisma declaration '$($match.Groups['name'].Value)' in $SourceLabel"
    }

    $text = $Content.Substring($start, ($end - $start) + 1).Trim()

    $declarations += [pscustomobject]@{
      Kind = $match.Groups['kind'].Value
      Name = $match.Groups['name'].Value
      Text = $text
    }
  }

  return $declarations
}

function Normalize-PrismaDeclaration {
  param([Parameter(Mandatory = $true)][string]$Text)

  $withoutComments = [regex]::Replace($Text, '(?m)^\s*//.*(?:\r?\n|$)', '')
  return [regex]::Replace($withoutComments.Trim(), '\s+', ' ')
}

function Invoke-PrismaValidation {
  param([Parameter(Mandatory = $true)][string]$RepositoryRoot)

  Push-Location $RepositoryRoot
  try {
    & npx prisma validate
    if ($LASTEXITCODE -ne 0) {
      throw "Prisma validation failed with exit code $LASTEXITCODE"
    }
  }
  finally {
    Pop-Location
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
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
if ($LASTEXITCODE -ne 0) {
  throw 'Unable to resolve current Git branch.'
}

if ($branch -ne 'feature/tax-platform-authority') {
  throw "Wrong branch: $branch. Expected feature/tax-platform-authority"
}

$workingTree = @(git -C $repoRoot status --porcelain)
if ($LASTEXITCODE -ne 0) {
  throw 'Unable to inspect Git working tree.'
}

if ($workingTree.Count -gt 0) {
  throw 'Working tree must be clean before installing the Tax Prisma foundation.'
}

$schema = Get-Content $schemaPath -Raw
$candidate = Get-Content $candidatePath -Raw

$schemaDeclarations = @(Get-PrismaDeclarations -Content $schema -SourceLabel $schemaPath)
$candidateDeclarations = @(Get-PrismaDeclarations -Content $candidate -SourceLabel $candidatePath)

if ($candidateDeclarations.Count -eq 0) {
  throw 'Tax foundation candidate contains no Prisma model or enum declarations.'
}

$schemaByName = @{}
foreach ($declaration in $schemaDeclarations) {
  if ($schemaByName.ContainsKey($declaration.Name)) {
    throw "Current Prisma schema already contains duplicate declaration name '$($declaration.Name)'."
  }

  $schemaByName[$declaration.Name] = $declaration
}

$candidateNames = @{}
$missing = @()
$identical = @()
$conflicts = @()

foreach ($declaration in $candidateDeclarations) {
  if ($candidateNames.ContainsKey($declaration.Name)) {
    throw "Tax foundation candidate contains duplicate declaration name '$($declaration.Name)'."
  }
  $candidateNames[$declaration.Name] = $true

  if (-not $schemaByName.ContainsKey($declaration.Name)) {
    $missing += $declaration
    continue
  }

  $existing = $schemaByName[$declaration.Name]
  $sameKind = $existing.Kind -eq $declaration.Kind
  $sameDefinition = (Normalize-PrismaDeclaration $existing.Text) -eq (Normalize-PrismaDeclaration $declaration.Text)

  if ($sameKind -and $sameDefinition) {
    $identical += $declaration
  }
  else {
    $conflicts += [pscustomobject]@{
      Name = $declaration.Name
      ExistingKind = $existing.Kind
      CandidateKind = $declaration.Kind
    }
  }
}

Write-Host ''
Write-Host '=== TAX PRISMA FOUNDATION PLAN ===' -ForegroundColor Cyan
Write-Host "Repository : $repoRoot"
Write-Host "Branch     : $branch"
Write-Host "Missing    : $($missing.Count)"
Write-Host "Identical  : $($identical.Count)"
Write-Host "Conflicts  : $($conflicts.Count)"

if ($identical.Count -gt 0) {
  Write-Host ''
  Write-Host 'Already present with identical definitions:' -ForegroundColor Yellow
  $identical | ForEach-Object { Write-Host "  - $($_.Kind) $($_.Name)" }
}

if ($missing.Count -gt 0) {
  Write-Host ''
  Write-Host 'Declarations eligible for deterministic installation:' -ForegroundColor Green
  $missing | ForEach-Object { Write-Host "  + $($_.Kind) $($_.Name)" }
}

if ($conflicts.Count -gt 0) {
  Write-Host ''
  Write-Host 'Conflicting declarations:' -ForegroundColor Red
  $conflicts | ForEach-Object {
    Write-Host "  ! $($_.Name) (schema=$($_.ExistingKind), candidate=$($_.CandidateKind))"
  }

  throw 'Tax Prisma foundation installation blocked. Resolve conflicting declarations before applying changes.'
}

if ($missing.Count -eq 0) {
  Write-Host ''
  Write-Host 'Tax Prisma foundation is already installed. No changes made.' -ForegroundColor Green
  exit 0
}

if (-not $Apply) {
  Write-Host ''
  Write-Host 'Audit completed. No files changed.' -ForegroundColor Yellow
  Write-Host 'Run again with -Apply after reviewing the plan:'
  Write-Host '  powershell -ExecutionPolicy Bypass -File scripts/tax/install-tax-prisma-foundation.ps1 -Apply'
  exit 0
}

Copy-Item $schemaPath $backupPath -Force

$separator = "`r`n`r`n"
$blocksToAppend = ($missing | ForEach-Object { $_.Text }) -join $separator
$nextSchema = $schema.TrimEnd() + $separator + $blocksToAppend + "`r`n"

try {
  Set-Content -Path $schemaPath -Value $nextSchema -Encoding utf8

  if (-not $SkipValidate) {
    Invoke-PrismaValidation -RepositoryRoot $repoRoot
  }
}
catch {
  Copy-Item $backupPath $schemaPath -Force
  throw "Tax Prisma foundation installation failed and schema.prisma was restored. $($_.Exception.Message)"
}

Write-Host ''
Write-Host 'Tax Prisma foundation installed deterministically.' -ForegroundColor Green
Write-Host "Backup: $backupPath"
Write-Host "Added declarations: $($missing.Count)"
Write-Host 'Next commands:'
Write-Host '  npx prisma format'
Write-Host '  npx prisma validate'
Write-Host '  npx prisma generate'
Write-Host '  npx prisma migrate dev --name add_tax_platform_foundation --create-only'
