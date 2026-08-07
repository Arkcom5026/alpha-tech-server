$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ExpectedBranch = 'feature/prisma-multifile-domain-organization'
$ExpectedSchemaSha256 = '6B9597F8ACB2E0CDC014C01F738E358EEA7ECC874D49A745FF7FDAF85AABFC1F'
$SchemaPath = 'prisma/schema.prisma'
$BaseHead = '32c52ff303de4e61d310bd39b3f1e98309129786'

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $parent = Split-Path -Parent $Path
  if ($parent -and -not (Test-Path $parent)) { New-Item -ItemType Directory -Force $parent | Out-Null }
  [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding($false)))
}

function Get-TopLevelBlock([string]$Text, [string]$Kind, [string]$Name) {
  $pattern = '(?m)^' + [regex]::Escape($Kind) + '\s+' + [regex]::Escape($Name) + '\s*\{'
  $match = [regex]::Match($Text, $pattern)
  if (-not $match.Success) { throw "Missing $Kind $Name in $SchemaPath" }

  $braceStart = $Text.IndexOf('{', $match.Index)
  $depth = 0
  $end = -1
  for ($i = $braceStart; $i -lt $Text.Length; $i++) {
    if ($Text[$i] -eq '{') { $depth++ }
    elseif ($Text[$i] -eq '}') {
      $depth--
      if ($depth -eq 0) { $end = $i + 1; break }
    }
  }
  if ($end -lt 0) { throw "Unclosed $Kind $Name" }

  while ($end -lt $Text.Length -and ($Text[$end] -eq "`r" -or $Text[$end] -eq "`n")) { $end++ }
  [pscustomobject]@{
    Kind = $Kind
    Name = $Name
    Start = $match.Index
    End = $end
    Content = $Text.Substring($match.Index, $end - $match.Index)
  }
}

Set-Location ((git rev-parse --show-toplevel).Trim())
$branch = (git branch --show-current).Trim()
if ($branch -ne $ExpectedBranch) { throw "Expected branch $ExpectedBranch but found $branch" }
if (git status --porcelain) { throw 'Working tree must be clean before Wave 1 pilot.' }

$currentSha = (Get-FileHash $SchemaPath -Algorithm SHA256).Hash
if ($currentSha -ne $ExpectedSchemaSha256) {
  throw "Schema SHA-256 mismatch. Expected $ExpectedSchemaSha256 but found $currentSha"
}

$targets = [ordered]@{
  'prisma/platform/store-device.prisma' = @(
    @('enum','StoreDeviceGatewayEnrollmentState'),
    @('enum','StoreDeviceGatewayRuntimeState'),
    @('enum','StoreDeviceGatewaySessionState'),
    @('enum','StoreDeviceJobType'),
    @('enum','StoreDeviceJobStatus'),
    @('enum','StoreDeviceJobLeaseStatus'),
    @('enum','StoreDeviceJobResultStatus'),
    @('model','StoreDeviceGateway'),
    @('model','StoreDeviceGatewaySession'),
    @('model','StoreDeviceJob'),
    @('model','StoreDeviceJobLease'),
    @('model','StoreDeviceJobResult')
  )
  'prisma/platform/product-template.prisma' = @(
    @('enum','ProductTemplateCandidateStatus'),
    @('enum','ProductTemplateCandidateEventType'),
    @('model','ProductTemplateCandidate'),
    @('model','ProductTemplateCandidateEvent')
  )
  'prisma/tax/missing-cost.prisma' = @(
    @('enum','MissingCostResolutionStatus'),
    @('enum','MissingCostEvidenceSourceType'),
    @('enum','MissingCostEvidenceConfidence'),
    @('enum','MissingCostResolutionEventType'),
    @('model','MissingCostResolution'),
    @('model','MissingCostResolutionVersion'),
    @('model','MissingCostResolutionEvent')
  )
}

foreach ($path in $targets.Keys) {
  if (Test-Path $path) { throw "Target already exists: $path" }
}

$text = [System.IO.File]::ReadAllText((Resolve-Path $SchemaPath))
$allBlocks = New-Object System.Collections.Generic.List[object]
$fileContents = @{}
$blockManifest = New-Object System.Collections.Generic.List[object]

foreach ($path in $targets.Keys) {
  $parts = New-Object System.Collections.Generic.List[string]
  foreach ($definition in $targets[$path]) {
    $block = Get-TopLevelBlock $text $definition[0] $definition[1]
    $allBlocks.Add($block)
    $parts.Add($block.Content.TrimEnd("`r","`n"))
    $bytes = [Text.Encoding]::UTF8.GetBytes($block.Content.TrimEnd("`r","`n") + "`n")
    $sha = [BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($bytes)).Replace('-','')
    $blockManifest.Add([ordered]@{ file=$path; kind=$block.Kind; name=$block.Name; sha256=$sha })
  }
  $fileContents[$path] = (($parts -join "`r`n`r`n") + "`r`n")
}

$duplicates = $allBlocks | Group-Object Name | Where-Object Count -ne 1
if ($duplicates) { throw 'Duplicate block selection detected.' }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$evidenceBase = if ($env:ALPHA_TECH_RECOVERY_ROOT) { $env:ALPHA_TECH_RECOVERY_ROOT } else { Join-Path $env:SystemDrive 'alpha-tech-recovery' }
$evidenceDir = Join-Path $evidenceBase "prisma-wave1-preapply-$stamp"
New-Item -ItemType Directory -Force $evidenceDir | Out-Null
Copy-Item $SchemaPath (Join-Path $evidenceDir 'schema.prisma.before-wave1')

$updated = $text
foreach ($block in ($allBlocks | Sort-Object Start -Descending)) {
  $updated = $updated.Remove($block.Start, $block.End - $block.Start)
}
$updated = [regex]::Replace($updated, '(\r?\n){4,}', "`r`n`r`n`r`n")

Write-Utf8NoBom $SchemaPath $updated
foreach ($path in $targets.Keys) { Write-Utf8NoBom $path $fileContents[$path] }

$result = [ordered]@{
  appliedAtUtc = [DateTime]::UtcNow.ToString('o')
  branch = $branch
  headBeforeApply = (git rev-parse HEAD).Trim()
  baseHead = $BaseHead
  originalSchemaSha256 = $currentSha
  externalBackup = (Join-Path $evidenceDir 'schema.prisma.before-wave1')
  targetFiles = @($targets.Keys)
  movedBlocks = $blockManifest
  migrationExecution = 'PROHIBITED'
  databaseTarget = 'NONE'
}
Write-Utf8NoBom (Join-Path $evidenceDir 'wave1-apply-result.json') (($result | ConvertTo-Json -Depth 8) + "`n")

Write-Host 'Wave 1 pilot candidate created.'
Write-Host "External recovery: $evidenceDir"
Write-Host 'No migration or database command was executed.'
Write-Host 'Run git status --short and the Wave 1 verifier before committing.'
