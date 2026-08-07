$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$CertifiedSha = '3a707e514f3fe8a73b44dc6ff314748445d8257b'

Set-Location ((git rev-parse --show-toplevel).Trim())

function Get-NamesFromText([string]$Text, [string]$Kind) {
  @([regex]::Matches($Text, '(?m)^' + $Kind + '\s+([A-Za-z_]\w*)\s*\{') | ForEach-Object { $_.Groups[1].Value })
}

$baselineModels = New-Object System.Collections.Generic.List[string]
$baselineEnums = New-Object System.Collections.Generic.List[string]
$baselineFiles = @(
  git ls-tree -r --name-only $CertifiedSha -- prisma |
  Where-Object { $_ -match '^prisma/.+\.prisma$' -and $_ -notmatch '^prisma/migrations/' } |
  Sort-Object -Unique
)

foreach ($file in $baselineFiles) {
  $text = (git show "$CertifiedSha`:$file") -join "`n"
  foreach ($name in (Get-NamesFromText $text 'model')) { $baselineModels.Add($name) }
  foreach ($name in (Get-NamesFromText $text 'enum')) { $baselineEnums.Add($name) }
}

$currentModels = New-Object System.Collections.Generic.List[string]
$currentEnums = New-Object System.Collections.Generic.List[string]
$currentFiles = @(Get-ChildItem prisma -Recurse -File -Filter *.prisma | Where-Object { $_.FullName -notmatch '[\\/]migrations[\\/]' })
foreach ($file in $currentFiles) {
  $text = [IO.File]::ReadAllText($file.FullName)
  foreach ($name in (Get-NamesFromText $text 'model')) { $currentModels.Add($name) }
  foreach ($name in (Get-NamesFromText $text 'enum')) { $currentEnums.Add($name) }
}

$missingModels = @($baselineModels | Where-Object { $_ -notin $currentModels } | Sort-Object -Unique)
$missingEnums = @($baselineEnums | Where-Object { $_ -notin $currentEnums } | Sort-Object -Unique)
$extraModels = @($currentModels | Where-Object { $_ -notin $baselineModels } | Sort-Object -Unique)
$extraEnums = @($currentEnums | Where-Object { $_ -notin $baselineEnums } | Sort-Object -Unique)

Write-Host "Baseline models/enums: $($baselineModels.Count)/$($baselineEnums.Count)"
Write-Host "Current models/enums:  $($currentModels.Count)/$($currentEnums.Count)"
Write-Host ''
Write-Host 'Missing models:'
if ($missingModels) { $missingModels | ForEach-Object { Write-Host "  $_" } } else { Write-Host '  NONE' }
Write-Host 'Missing enums:'
if ($missingEnums) { $missingEnums | ForEach-Object { Write-Host "  $_" } } else { Write-Host '  NONE' }
Write-Host 'Extra models:'
if ($extraModels) { $extraModels | ForEach-Object { Write-Host "  $_" } } else { Write-Host '  NONE' }
Write-Host 'Extra enums:'
if ($extraEnums) { $extraEnums | ForEach-Object { Write-Host "  $_" } } else { Write-Host '  NONE' }

if ($missingModels.Count -eq 0 -and $missingEnums.Count -eq 0 -and $extraModels.Count -eq 0 -and $extraEnums.Count -eq 0) {
  Write-Host 'Wave 3 inventory diagnostic PASS.'
} else {
  Write-Host 'Wave 3 inventory diagnostic found differences.'
}
