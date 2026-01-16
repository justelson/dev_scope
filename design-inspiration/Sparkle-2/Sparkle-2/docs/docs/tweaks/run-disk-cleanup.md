# Run Disk Cleanup
ID/URL: run-disk-cleanup

Description: Runs disk cleanup on your C: drive. also removes old windows update cache

- Runs Disk Cleanup in silent low-disk mode and permanently removes old Windows update files using DISM to free up space and reduce system clutter.



## Apply
```powershell
cleanmgr.exe /d C: /VERYLOWDISK
Dism.exe /online /Cleanup-Image /StartComponentCleanup /ResetBase
```
