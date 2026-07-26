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
      Kind      = $match.Groups['kind'].Value
      Name      = $match.Groups['name'].Value
      Text      = $text
      Start     = $start
      OpenBrace = $openBrace
      End       = $end
    }
  }

  return $declarations
}

function Normalize-PrismaDeclaration {
  param([Parameter(Mandatory = $true)][string]$Text)

  $withoutComments = [regex]::Replace($Text, '(?m)^\s*//.*(?:\r?\n|$)', '')
  return [regex]::Replace($withoutComments.Trim(), '\s+', ' ')
}

function Get-PrismaEnumMembers {
  param([Parameter(Mandatory = $true)][string]$DeclarationText)

  $openBrace = $DeclarationText.IndexOf('{')
  $closeBrace = $DeclarationText.LastIndexOf('}')

  if ($openBrace -lt 0 -or $closeBrace -le $openBrace) {
    throw 'Invalid Prisma enum declaration.'
  }

  $body = $DeclarationText.Substring($openBrace + 1, $closeBrace - $openBrace - 1)
  $members = @()

  foreach ($line in ($body -split "`r?`n")) {
    $trimmed = $line.Trim()

    if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith('//')) {
      continue
    }

    if ($trimmed -match '^(?<name>[A-Za-z_][A-Za-z0-9_]*)\b') {
      $members += $Matches['name']
    }
  }

  return @($members | Select-Object -Unique)
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
$lineEnding = if ($schema.Contains("`r`n")) { "`r`n" } else { "`n" }

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
$missingDeclarations = @()
$identicalDeclarations = @()
$compatibleEnums = @()
$enumMemberAdditions = @()
$conflicts = @()

foreach ($declaration in $candidateDeclarations) {
  if ($candidateNames.ContainsKey($declaration.Name)) {
    throw "Tax foundation candidate contains duplicate declaration name '$($declaration.Name)'."
  }
  $candidateNames[$declaration.Name] = $true

  if (-not $schemaByName.ContainsKey($declaration.Name)) {
    $missingDeclarations += $declaration
    continue
  }

  $existing = $schemaByName[$declaration.Name]

  if ($existing.Kind -ne $declaration.Kind) {
    $conflicts += [pscustomobject]@{
      Name          = $declaration.Name
      ExistingKind  = $existing.Kind
      CandidateKind = $declaration.Kind
      Reason        = 'declaration kind mismatch'
    }
    continue
  }

  if ($declaration.Kind -eq 'enum') {
    $existingMembers = @(Get-PrismaEnumMembers -DeclarationText $existing.Text)
    $candidateMembers = @(Get-PrismaEnumMembers -DeclarationText $declaration.Text)
    $missingMembers = @($candidateMembers | Where-Object { $_ -notin $existingMembers })

    if ($missingMembers.Count -eq 0) {
      $compatibleEnums += [pscustomobject]@{
        Name            = $declaration.Name
        ExistingMembers = $existingMembers
      }
    }
    else {
      $enumMemberAdditions += [pscustomobject]@{
        Name           = $declaration.Name
        Declaration    = $existing
        MissingMembers = $missingMembers
      }
    }

    continue
  }

  $sameDefinition = (Normalize-PrismaDeclaration $existing.Text) -eq (Normalize-PrismaDeclaration $declaration.Text)

  if ($sameDefinition) {
    $identicalDeclarations += $declaration
  }
  else {
    $conflicts += [pscustomobject]@{
      Name          = $declaration.Name
      ExistingKind  = $existing.Kind
      CandidateKind = $declaration.Kind
      Reason        = 'model definition mismatch'
    }
  }
}

Write-Host ''
Write-Host '=== TAX PRISMA FOUNDATION PLAN ===' -ForegroundColor Cyan
Write-Host "Repository            : $repoRoot"
Write-Host "Branch                : $branch"
Write-Host "Missing declarations : $($missingDeclarations.Count)"
Write-Host "Identical models     : $($identicalDeclarations.Count)"
Write-Host "Compatible enums     : $($compatibleEnums.Count)"
Write-Host "Enum merges          : $($enumMemberAdditions.Count)"
Write-Host "Conflicts            : $($conflicts.Count)"

if ($identicalDeclarations.Count -gt 0) {
  Write-Host ''
  Write-Host 'Already present with identical model definitions:' -ForegroundColor Yellow
  $identicalDeclarations | ForEach-Object { Write-Host "  - model $($_.Name)" }
}

if ($compatibleEnums.Count -gt 0) {
  Write-Host ''
  Write-Host 'Existing enums already satisfy candidate requirements:' -ForegroundColor Yellow
  $compatibleEnums | ForEach-Object { Write-Host "  - enum $($_.Name)" }
}

if ($enumMemberAdditions.Count -gt 0) {
  Write-Host ''
  Write-Host 'Enum members eligible for additive merge:' -ForegroundColor Green
  foreach ($enumMerge in $enumMemberAdditions) {
    Write-Host "  ~ enum $($enumMerge.Name)"
    $enumMerge.MissingMembers | ForEach-Object { Write-Host "      + $_" }
  }
}

if ($missingDeclarations.Count -gt 0) {
  Write-Host ''
  Write-Host 'Declarations eligible for deterministic installation:' -ForegroundColor Green
  $missingDeclarations | ForEach-Object { Write-Host "  + $($_.Kind) $($_.Name)" }
}

if ($conflicts.Count -gt 0) {
  Write-Host ''
  Write-Host 'Conflicting declarations:' -ForegroundColor Red
  $conflicts | ForEach-Object {
    Write-Host "  ! $($_.Name) (schema=$($_.ExistingKind), candidate=$($_.CandidateKind), reason=$($_.Reason))"
  }

  throw 'Tax Prisma foundation installation blocked. Resolve conflicting declarations before applying changes.'
}

$changeCount = $missingDeclarations.Count + $enumMemberAdditions.Count
if ($changeCount -eq 0) {
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
$nextSchema = $schema

foreach ($enumMerge in ($enumMemberAdditions | Sort-Object { $_.Declaration.End } -Descending)) {
  $insertion = ($enumMerge.MissingMembers | ForEach-Object { "  $_" }) -join $lineEnding
  $insertion = $insertion + $lineEnding
  $insertAt = $enumMerge.Declaration.End
  $nextSchema = $nextSchema.Insert($insertAt, $insertion)
}

if ($missingDeclarations.Count -gt 0) {
  $separator = $lineEnding + $lineEnding
  $blocksToAppend = ($missingDeclarations | ForEach-Object { $_.Text }) -join $separator
  $nextSchema = $nextSchema.TrimEnd() + $separator + $blocksToAppend + $lineEnding
}

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
Write-Host "Added declarations : $($missingDeclarations.Count)"
Write-Host "Merged enums       : $($enumMemberAdditions.Count)"
Write-Host 'Next commands:'
Write-Host '  npx prisma format'
Write-Host '  npx prisma validate'
Write-Host '  npx prisma generate'
Write-Host '  npx prisma migrate dev --name add_tax_platform_foundation --create-only'
