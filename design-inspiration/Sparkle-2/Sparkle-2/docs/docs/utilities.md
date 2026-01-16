---
title: "Utilities"
---

# Utilities Page

## System Utilities

The following system utilities can be run directly from the app:

| Utility Name            | Command                                      | Type    | Description                               |
| ----------------------- | -------------------------------------------- | ------- | ----------------------------------------- |
| **System File Checker** | `sfc /scannow`                               | System  | Scans and repairs Windows system files.   |
| **DISM Health Restore** | `DISM /Online /Cleanup-Image /RestoreHealth` | System  | Repairs Windows system image health.      |
| **Check Disk**          | `chkdsk C: /f /r /x`                         | System  | Checks and repairs disk errors.           |
| **Show Power Plan**     | `powercfg /getactivescheme`                  | System  | Displays the currently active power plan. |
| **Reset IP Stack**      | `netsh int ip reset`                         | Network | Resets TCP/IP stack.                      |
| **Reset Winsock**       | `netsh winsock reset`                        | Network | Resets Winsock catalog to default.        |
| **Flush DNS Cache**     | `ipconfig /flushdns`                         | Network | Clears the DNS cache.                     |
| **Disk Cleanup**        | `cleanmgr.exe /sagerun:1`                    | System  | Launches Windows Disk Cleanup utility.    |

!!! tip

    Users can choose to keep the PowerShell window open after execution via a toggle.

---

## Quick Access Tools

Quick access to commonly used Windows tools:

| Tool Name              | Command              | Description                        |
| ---------------------- | -------------------- | ---------------------------------- |
| **Regedit**            | `start regedit.exe`  | Opens the Windows Registry Editor. |
| **Task Manager**       | `start taskmgr.exe`  | Opens Task Manager.                |
| **Disk Cleanup**       | `start cleanmgr.exe` | Opens Disk Cleanup utility.        |
| **Display Settings**   | `start desk.cpl`     | Opens Display Settings.            |
| **System Information** | `start msinfo32.exe` | Opens System Information.          |
| **Device Manager**     | `start devmgmt.msc`  | Opens Device Manager.              |
| **System Properties**  | `start sysdm.cpl`    | Opens System Properties.           |
| **Character Map**      | `start charmap.exe`  | Opens Character Map.               |
| **Remote Desktop**     | `start mstsc.exe`    | Opens Remote Desktop client.       |
