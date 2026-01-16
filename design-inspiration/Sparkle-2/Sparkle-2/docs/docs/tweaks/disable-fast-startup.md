# Disable Fast Startup
ID/URL: disable-fast-startup

Description: Disables Windows Fast Startup to improve system stability

- Disables Windows Fast Startup by setting HiberbootEnabled to 0, preventing the system from using hybrid hibernation during shutdown for a full clean boot.



## Apply
```powershell
Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power' -Name HiberbootEnabled -Value 0
```

## Unapply
```powershell
Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power' -Name HiberbootEnabled -Value 1
```
