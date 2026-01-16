# Align Taskbar Left
ID/URL: align-taskbar-left

Description: Aligns the taskbar to the left side of the screen.

- Forces the Windows taskbar to align left by editing the system registry. by setting the 'TaskbarAl' registry value to 0



## Apply
```powershell
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "TaskbarAl" -Type DWord -Value 0

```

## Unapply
```powershell
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "TaskbarAl" -Type DWord -Value 1

```
