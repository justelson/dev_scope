# Disable Wifi Sense
ID/URL: disable-wifi-sense

Description: Disables Wifi Sense to prevent sharing of Wi-Fi networks with contacts

- Disables Wi-Fi Sense features by setting related policy values to 0, preventing automatic connection to open hotspots and blocking location-based Wi-Fi hotspot reporting to enhance privacy and reduce unwanted background activity



## Apply
```powershell
  Set-ItemProperty -Path "HKLM:\Software\Microsoft\PolicyManager\default\WiFi\AllowWiFiHotSpotReporting" -Name "Value" -Type DWord -Value 0
  Set-ItemProperty -Path "HKLM:\Software\Microsoft\PolicyManager\default\WiFi\AllowAutoConnectToWiFiSenseHotspots" -Name "Value" -Type DWord -Value 0
```

## Unapply
```powershell
Set-ItemProperty -Path "HKLM:\Software\Microsoft\PolicyManager\default\WiFi\AllowWiFiHotSpotReporting" -Name "Value" -Type DWord -Value 1
Set-ItemProperty -Path "HKLM:\Software\Microsoft\PolicyManager\default\WiFi\AllowAutoConnectToWiFiSenseHotspots" -Name "Value" -Type DWord -Value 1
```
