---
title: Cleaner
---

# Sparkle Cleaner

The Sparkle Cleaner helps free up disk space and remove unnecessary system files.

## 1. Clean Temporary Files

Removes both system and user temporary files.

```powershell
$systemTemp = "$env:SystemRoot\\Temp"
$userTemp = [System.IO.Path]::GetTempPath()
$foldersToClean = @($systemTemp, $userTemp)

foreach ($folder in $foldersToClean) {
    if (Test-Path $folder) {
        Get-ChildItem -Path $folder -Recurse -Force -ErrorAction SilentlyContinue |
            Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    }
}
```

## 2. Clean Prefetch Files

Deletes files from the Windows Prefetch folder.

```powershell
$prefetch = "$env:SystemRoot\\Prefetch"
if (Test-Path $prefetch) {
    Remove-Item "$prefetch\\*" -Force -Recurse -ErrorAction SilentlyContinue
}
```

## 3. Empty Recycle Bin

Permanently removes files from the Recycle Bin.

```powershell
Clear-RecycleBin -Force -ErrorAction SilentlyContinue
```

## 4. Clean Windows Update Cache

Removes downloaded Windows Update installation files.

```powershell
$windowsUpdateDownload = "$env:SystemRoot\\SoftwareDistribution\\Download"
if (Test-Path $windowsUpdateDownload) {
    Remove-Item "$windowsUpdateDownload\\*" -Force -Recurse -ErrorAction SilentlyContinue
}
```
