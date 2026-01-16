# Enable End Task With Right Click
ID/URL: enable-end-task-right-click

Description: Enables the "End Task" option in the taskbar context menu

- Enables the "End Task" option in the Windows 11 taskbar right-click menu by setting TaskbarEndTask to 1, allowing users to kill unresponsive apps directly from the taskbar without opening Task Manager.



## Apply
```powershell
$regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced\TaskbarDeveloperSettings"
$valueName = "TaskbarEndTask"

if (-not (Test-Path $regPath)) {
    New-Item -Path $regPath -Force | Out-Null
}

Set-ItemProperty -Path $regPath -Name $valueName -Type DWord -Value 1
```

## Unapply
```powershell
$regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced\TaskbarDeveloperSettings"
$valueName = "TaskbarEndTask"

if (-not (Test-Path $regPath)) {
    New-Item -Path $regPath -Force | Out-Null
}

Set-ItemProperty -Path $regPath -Name $valueName -Type DWord -Value 0
```
