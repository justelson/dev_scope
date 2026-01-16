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