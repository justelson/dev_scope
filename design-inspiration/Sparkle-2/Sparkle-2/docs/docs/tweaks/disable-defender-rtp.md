# Disable Defender RTP
ID/URL: disable-defender-rtp

Description: Disables Defender Real-time Protection

- Sets the Defender policy DisableRealtimeMonitoring to true, instructing Windows Security to stop actively scanning files and processes in real time. For better performance



## Apply
```powershell
Set-MpPreference -DisableRealtimeMonitoring $true
```

## Unapply
```powershell
Set-MpPreference -DisableRealtimeMonitoring $false
```
