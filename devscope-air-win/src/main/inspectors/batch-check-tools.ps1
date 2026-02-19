# DevScope - Batch Tool Detection Script
# Checks all development tools in a single PowerShell execution
# Returns JSON with existence, path, and version for each tool

param(
    [string[]]$Tools = @()
)

$results = @{}

foreach ($tool in $Tools) {
    try {
        $cmd = Get-Command $tool -ErrorAction SilentlyContinue
        
        if ($cmd) {
            # Command exists, try to get version
            $version = $null
            $versionOutput = $null
            
            try {
                # Try --version first (most common)
                $versionOutput = & $tool --version 2>&1 | Select-Object -First 1
                if ($versionOutput) {
                    # Extract version number using regex
                    if ($versionOutput -match 'v?(\d+\.\d+\.?\d*[-.\w]*)') {
                        $version = $matches[1]
                    } elseif ($versionOutput -match 'version\s*[:\s]?\s*v?(\d+\.\d+\.?\d*[-.\w]*)') {
                        $version = $matches[1]
                    } else {
                        $version = $versionOutput.ToString().Trim()
                    }
                }
            } catch {
                # Some commands might not support --version
                $version = "Installed"
            }
            
            $results[$tool] = @{
                exists = $true
                path = $cmd.Source
                version = if ($version) { $version } else { "Unknown" }
            }
        } else {
            $results[$tool] = @{
                exists = $false
            }
        }
    } catch {
        $results[$tool] = @{
            exists = $false
            error = $_.Exception.Message
        }
    }
}

# Force UTF-8 encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Output delimiters for robust parsing
Write-Output "__JSON_START__"
$results | ConvertTo-Json -Compress
Write-Output "__JSON_END__"
