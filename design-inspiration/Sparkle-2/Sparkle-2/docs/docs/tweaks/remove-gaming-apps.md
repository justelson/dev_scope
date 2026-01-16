# Remove Gaming Apps
ID/URL: remove-gaming-apps

Description: Removes Xbox app, Xbox Game Bar, and Xbox Game Overlay

!!! info

    This tweak cannot be reversed. Must be done manually
  




## Apply
```powershell
$appsList = 'Microsoft.GamingApp', 'Microsoft.XboxGameOverlay', 'Microsoft.XboxGamingOverlay'

foreach ($app in $appsList) {
    Get-AppxPackage -Name $app -AllUsers | Remove-AppxPackage
    Get-AppxProvisionedPackage -Online | Where-Object DisplayName -EQ $app | Remove-AppxProvisionedPackage -Online
}

```







## Links
- [Reinstall Xbox App](https://apps.microsoft.com/detail/9mv0b5hzvk9z)
