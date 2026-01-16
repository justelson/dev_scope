# Optimize Network Settings
ID/URL: optimize-network-settings

Description: Changes various Windows settings to improve network latency and speeds.

- Applies a comprehensive set of netsh TCP/IP tweaks to disable latency-inducing features, enable fast open, offload networking tasks to hardware, fine-tune congestion control, and set optimal MTU, all to maximize speed, reduce CPU load, and improve responsiveness for gaming and high-performance internet use.



## Apply
```powershell
      Write-Host "Applying network tweaks..."
      netsh int tcp set heuristics disabled
      netsh int tcp set supp internet congestionprovider=ctcp
      netsh int tcp set global rss=enabled
      netsh int tcp set global chimney=enabled
      netsh int tcp set global ecncapability=enabled
      netsh int tcp set global timestamps=disabled
      netsh int tcp set global initialRto=2000
      netsh int tcp set global rsc=disabled
      netsh int tcp set global nonsackttresiliency=disabled
      netsh int tcp set global MaxSynRetransmissions=2
      netsh int tcp set global fastopen=enabled
      netsh int tcp set global fastopenfallback=enabled
      netsh int tcp set global pacingprofile=off
      netsh int tcp set global hystart=disabled
      netsh int tcp set global dca=enabled
      netsh int tcp set global netdma=enabled
      netsh int 6to4 set state state=enabled
      netsh int udp set global uro=enabled
      netsh winsock set autotuning on
      netsh int tcp set supplemental template=custom icw=10
      netsh interface teredo set state enterprise
      netsh int tcp set security mpp=disabled
      netsh int tcp set security profiles=disabled
      netsh interface ipv4 set subinterface "Wi-Fi" mtu=1500 store=persistent
      netsh interface ipv4 set subinterface Ethernet mtu=1500 store=persistent
  
      Write-Host "Network tweaks applied."    
```

## Unapply
```powershell
 Write-Host "Reverting network tweaks to defaults..."
      netsh int tcp set heuristics enabled
      netsh int tcp set supp internet congestionprovider=default
      netsh int tcp set global rss=disabled
      netsh int tcp set global chimney=disabled
      netsh int tcp set global ecncapability=disabled
      netsh int tcp set global timestamps=enabled
      netsh int tcp set global initialRto=3000
      netsh int tcp set global rsc=enabled
      netsh int tcp set global nonsackttresiliency=enabled
      netsh int tcp set global MaxSynRetransmissions=5
      netsh int tcp set global fastopen=disabled
      netsh int tcp set global fastopenfallback=disabled
      netsh int tcp set global pacingprofile=normal
      netsh int tcp set global hystart=enabled
      netsh int tcp set global dca=disabled
      netsh int tcp set global netdma=disabled
      netsh int 6to4 set state state=disabled
      netsh int udp set global uro=disabled
      netsh winsock set autotuning default
      netsh int tcp set supplemental template=default icw=4
      netsh interface teredo set state disabled
      netsh int tcp set security mpp=enabled
      netsh int tcp set security profiles=enabled
      # Reset MTU to default (usually 1500 is default, so you might omit this or adjust)
      netsh interface ipv4 set subinterface "Wi-Fi" mtu=1500 store=persistent
      netsh interface ipv4 set subinterface Ethernet mtu=1500 store=persistent
      Write-Host "Network tweaks reverted."
```
