param(
    [string]$OutDir = "dist",
    [switch]$IncludeModels
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outPath = Join-Path $repoRoot $OutDir
New-Item -ItemType Directory -Force -Path $outPath | Out-Null

$zipName = "fyp-backend-src-$timestamp.zip"
$zipPath = Join-Path $outPath $zipName
if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

$excludeDirs = @(
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".idea",
    ".vscode",
    $OutDir
)

if (-not $IncludeModels) {
    $excludeDirs += "app\nlp"
}

function Should-ExcludeFile([string]$relativePath) {
    $normalized = $relativePath.Replace("/", "\\")

    foreach ($dir in $excludeDirs) {
        $d = $dir.Replace("/", "\\").TrimEnd("\\")
        if ($normalized -eq $d -or $normalized.StartsWith($d + "\")) {
            return $true
        }
    }

    if ($normalized -ieq ".env") { return $true }
    if ($normalized -like ".env.*" -and $normalized -ine ".env.example") { return $true }

    if ($normalized -ieq "dev.db") { return $true }
    if ($normalized -ieq "test.db") { return $true }

    return $false
}

$allFiles = Get-ChildItem -Recurse -Force -File
$filesToZip = foreach ($f in $allFiles) {
    $rel = $f.FullName.Substring($repoRoot.Length).TrimStart("\")
    if (-not (Should-ExcludeFile -relativePath $rel)) {
        $f.FullName
    }
}

if (-not $filesToZip -or $filesToZip.Count -eq 0) {
    throw "No files selected for ZIP. Check exclude rules in scripts/make_zip.ps1."
}

Write-Output ("Creating ZIP: {0}" -f $zipPath)
Write-Output ("Files: {0}" -f $filesToZip.Count)
if (-not $IncludeModels) {
    Write-Output "Note: app\nlp is excluded by default (use -IncludeModels to include it)."
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($fullName in $filesToZip) {
        $rel = $fullName.Substring($repoRoot.Length).TrimStart("\")
        $entryName = $rel -replace "\\", "/"
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $zip,
            $fullName,
            $entryName,
            [System.IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
    }
}
finally {
    $zip.Dispose()
}
Write-Output "Done"
