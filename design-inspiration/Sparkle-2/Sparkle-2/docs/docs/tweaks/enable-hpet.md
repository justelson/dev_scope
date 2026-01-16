# Enable HPET (High Precision Event Timer)
ID/URL: enable-hpet

Description: Forces use of the High Precision Event Timer (HPET), which can reduce stuttering and improve timing accuracy on some hardware.

- Enables the High Precision Event Timer (HPET) by setting useplatformclock to true via bcdedit, which can improve timing accuracy and reduce stuttering on some systems, though may increase input latency in others.


!!! warning "Tweak Warning"
    

    May increase input latency on some systems

## Apply
```powershell
try {
    bcdedit /set useplatformclock true
    Write-Host "HPET enabled successfully"
  } catch {
    Write-Host "Failed to enable HPET"
  }
```

## Unapply
```powershell
try {
    bcdedit /deletevalue useplatformclock
    Write-Host "HPET setting removed"
  } catch {
    Write-Host "Failed to disable HPET"
  }
```
