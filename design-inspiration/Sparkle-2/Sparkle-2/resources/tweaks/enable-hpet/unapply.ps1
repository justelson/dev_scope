try {
    bcdedit /deletevalue useplatformclock
    Write-Host "HPET setting removed"
  } catch {
    Write-Host "Failed to disable HPET"
  }