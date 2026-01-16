# Disable Copilot
ID/URL: disable-copilot

Description: Removes Microsoft's Copilot feature. (will fail if copilot is not installed)

- Finds and removes all installed Microsoft Copilot-related AppX packages for all users by filtering package names with 'Microsoft.Copilot'



## Apply
```powershell
Get-AppxPackage -AllUsers | Where-Object {$_.Name -Like '*Microsoft.Copilot*'} | Remove-AppxPackage -ErrorAction Continue
```

## Unapply
```powershell
winget install 9NHT9RB2F4HD --source msstore --accept-source-agreements --accept-package-agreements
```
