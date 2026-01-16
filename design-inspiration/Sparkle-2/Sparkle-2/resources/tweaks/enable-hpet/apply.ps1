try {
    bcdedit /set useplatformclock true
    Write-Host "HPET enabled successfully"
  } catch {
    Write-Host "Failed to enable HPET"
  }