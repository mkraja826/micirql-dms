param(
  [string]$DatabaseUrl = $env:CAPDENT_DATABASE_URL,
  [string]$OutputRoot = (Join-Path $HOME "CapDentBackups")
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  throw "Set CAPDENT_DATABASE_URL to the Supabase Session Pooler connection string before running this script. The script never writes the connection string to disk."
}

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  throw "Supabase CLI is required. Install it, then run 'supabase --version'."
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker Desktop is required by 'supabase db dump'."
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
  throw "Docker Desktop is installed but not running."
}

$Timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$BackupDirectory = Join-Path $OutputRoot $Timestamp
New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null

$RolesFile = Join-Path $BackupDirectory "roles.sql"
$SchemaFile = Join-Path $BackupDirectory "schema.sql"
$DataFile = Join-Path $BackupDirectory "data.sql"

Write-Host "Creating CapDent role backup..."
& supabase db dump --db-url $DatabaseUrl -f $RolesFile --role-only
if ($LASTEXITCODE -ne 0) { throw "Role backup failed." }

Write-Host "Creating CapDent schema backup..."
& supabase db dump --db-url $DatabaseUrl -f $SchemaFile
if ($LASTEXITCODE -ne 0) { throw "Schema backup failed." }

Write-Host "Creating CapDent data backup..."
& supabase db dump --db-url $DatabaseUrl -f $DataFile --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
if ($LASTEXITCODE -ne 0) { throw "Data backup failed." }

$Files = @($RolesFile, $SchemaFile, $DataFile)
foreach ($File in $Files) {
  $Item = Get-Item $File
  if ($Item.Length -le 0) { throw "Backup file is empty: $File" }
}

$Manifest = [ordered]@{
  project_ref = "mzjtdcpbvoximdukpukd"
  created_at_utc = (Get-Date).ToUniversalTime().ToString("o")
  postgres_version = "17"
  files = @(
    foreach ($File in $Files) {
      $Item = Get-Item $File
      $Hash = Get-FileHash -Algorithm SHA256 -Path $File
      [ordered]@{
        name = $Item.Name
        bytes = $Item.Length
        sha256 = $Hash.Hash.ToLowerInvariant()
      }
    }
  )
}

$ManifestFile = Join-Path $BackupDirectory "manifest.json"
$Manifest | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 -Path $ManifestFile

Write-Host "Backup completed: $BackupDirectory"
Write-Host "Store this folder in encrypted off-site storage. It contains confidential clinic and patient data."
Write-Host "Do not commit backup files or the database connection string to Git."
