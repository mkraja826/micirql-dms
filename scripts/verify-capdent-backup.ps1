param(
  [Parameter(Mandatory = $true)]
  [string]$BackupDirectory
)

$ErrorActionPreference = "Stop"
$ManifestPath = Join-Path $BackupDirectory "manifest.json"
if (-not (Test-Path $ManifestPath)) { throw "manifest.json was not found in $BackupDirectory" }

$Manifest = Get-Content -Raw -Path $ManifestPath | ConvertFrom-Json
if ($Manifest.project_ref -ne "mzjtdcpbvoximdukpukd") {
  throw "Backup project reference does not match CapDent production."
}

foreach ($Entry in $Manifest.files) {
  $Path = Join-Path $BackupDirectory $Entry.name
  if (-not (Test-Path $Path)) { throw "Missing backup file: $($Entry.name)" }
  $Item = Get-Item $Path
  if ($Item.Length -ne [int64]$Entry.bytes) { throw "Size mismatch for $($Entry.name)" }
  $Hash = (Get-FileHash -Algorithm SHA256 -Path $Path).Hash.ToLowerInvariant()
  if ($Hash -ne $Entry.sha256) { throw "SHA256 mismatch for $($Entry.name)" }
}

$SchemaPath = Join-Path $BackupDirectory "schema.sql"
$DataPath = Join-Path $BackupDirectory "data.sql"
if (-not (Select-String -Quiet -Path $SchemaPath -Pattern "CREATE TABLE")) {
  throw "schema.sql does not contain table definitions."
}
if (-not (Select-String -Quiet -Path $DataPath -Pattern "COPY|INSERT INTO")) {
  throw "data.sql does not contain data statements."
}

Write-Host "CapDent backup integrity verification passed."
Write-Host "Project: $($Manifest.project_ref)"
Write-Host "Created UTC: $($Manifest.created_at_utc)"
Write-Host "Files verified: $($Manifest.files.Count)"
