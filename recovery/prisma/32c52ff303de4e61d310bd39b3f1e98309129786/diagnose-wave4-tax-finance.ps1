$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ExpectedBranch = 'feature/prisma-multifile-domain-organization'
$CertifiedSha = '53cdbe3898ee76769af6986f96d82830c2e7eb29'

Set-Location ((git rev-parse --show-toplevel).Trim())
if ((git branch --show-current).Trim() -ne $ExpectedBranch) {
  throw "Expected branch $ExpectedBranch"
}
if (git status --porcelain --untracked-files=all) {
  throw 'Working tree must be clean before Wave 4 ownership diagnostic.'
}

$diff = @(git diff --name-only $CertifiedSha -- prisma | Where-Object { $_ -notmatch '^recovery/' })
if ($diff.Count -gt 0) {
  throw "Current Prisma tree differs from Wave 3 certified SHA:`n$($diff -join "`n")"
}

$schemaPath = 'prisma/schema.prisma'
$text = [IO.File]::ReadAllText((Resolve-Path $schemaPath))
$decls = [regex]::Matches($text, '(?m)^(model|enum)\s+([A-Za-z_]\w*)\s*\{')
$keywords = '(?i)(tax|invoice|receipt|account|ledger|journal|payment|finance|transaction|credit|debit|vat|withholding|expense|purchase|sale)'

$rows = New-Object Collections.Generic.List[object]
for ($i = 0; $i -lt $decls.Count; $i++) {
  $m = $decls[$i]
  $kind = $m.Groups[1].Value
  $name = $m.Groups[2].Value
  $end = if ($i + 1 -lt $decls.Count) { $decls[$i + 1].Index } else { $text.Length }
  $segment = $text.Substring($m.Index, $end - $m.Index)
  if ($name -match $keywords -or $segment -match $keywords) {
    $refs = @([regex]::Matches($segment, '\b[A-Z][A-Za-z0-9_]+\b') | ForEach-Object { $_.Value } | Sort-Object -Unique)
    $rows.Add([pscustomobject]@{
      Kind = $kind
      Name = $name
      StartLine = ($text.Substring(0, $m.Index) -split "`n").Count
      KeywordHits = (@([regex]::Matches(($name + "`n" + $segment), $keywords) | ForEach-Object { $_.Value.ToLowerInvariant() } | Sort-Object -Unique) -join ',')
      CandidateRefs = (($refs | Where-Object { $_ -ne $name } | Select-Object -First 20) -join ',')
    })
  }
}

Write-Host "Wave 4 ownership diagnostic"
Write-Host "Certified SHA: $CertifiedSha"
Write-Host "Main schema declarations matched: $($rows.Count)"
Write-Host ''
$rows | Sort-Object StartLine | Format-Table Kind,Name,StartLine,KeywordHits,CandidateRefs -AutoSize -Wrap
Write-Host ''
Write-Host 'Existing Prisma files:'
Get-ChildItem prisma -Recurse -File -Filter *.prisma |
  Where-Object { $_.FullName -notmatch '[\\/]migrations[\\/]' } |
  ForEach-Object { $_.FullName.Substring((Resolve-Path '.').Path.Length + 1) } |
  Sort-Object |
  ForEach-Object { Write-Host "  $_" }
Write-Host ''
Write-Host 'Diagnostic only. No file, migration, generated client, or database mutation was performed.'
