# Debloat Windows
ID/URL: debloat-windows

Description: Removes Unnecessary Windows Features And Apps (RECOMMENDED)

!!! info

    This tweak cannot be reversed. Must be done manually
  
## Overview:

- This tweak removes unnecessary applications from your Windows installation to improve system performance, reduce clutter, and enhance privacy.

## Microsoft Built-in Apps Removed
- Clipchamp.Clipchamp
- Microsoft.3DBuilder
- Microsoft.549981C3F5F10 (Cortana app)
- Microsoft.BingFinance
- Microsoft.BingFoodAndDrink
- Microsoft.BingHealthAndFitness
- Microsoft.BingNews
- Microsoft.BingSearch* (Bing web search in Windows)
- Microsoft.BingSports
- Microsoft.BingTranslator
- Microsoft.BingTravel
- Microsoft.BingWeather
- Microsoft.Copilot
- Microsoft.Getstarted (Cannot be uninstalled in Windows 11)
- Microsoft.Messaging
- Microsoft.Microsoft3DViewer
- Microsoft.MicrosoftJournal
- Microsoft.MicrosoftOfficeHub
- Microsoft.MicrosoftPowerBIForWindows
- Microsoft.MicrosoftSolitaireCollection
- Microsoft.MicrosoftStickyNotes
- Microsoft.MixedReality.Portal
- Microsoft.NetworkSpeedTest
- Microsoft.News
- Microsoft.Office.OneNote (Discontinued UWP version only, does not remove new MS365 versions)
- Microsoft.Office.Sway
- Microsoft.OneConnect
- Microsoft.Print3D
- Microsoft.SkypeApp
- Microsoft.Todos
- Microsoft.WindowsAlarms
- Microsoft.WindowsFeedbackHub
- Microsoft.WindowsMaps
- Microsoft.WindowsSoundRecorder
- Microsoft.XboxApp (Old Xbox Console Companion App, no longer supported)
- Microsoft.ZuneVideo
- MicrosoftCorporationII.MicrosoftFamily (Microsoft Family Safety)
- MicrosoftTeams (Old personal version of MS Teams from the MS Store)
- MSTeams (New MS Teams app)

## Third-Party Apps Removed
- ACGMediaPlayer
- ActiproSoftwareLLC
- AdobeSystemsIncorporated.AdobePhotoshopExpress
- Amazon.com.Amazon
- AmazonVideo.PrimeVideo
- Asphalt8Airborne
- AutodeskSketchBook
- CaesarsSlotsFreeCasino
- COOKINGFEVER
- CyberLinkMediaSuiteEssentials
- DisneyMagicKingdoms
- Disney
- Dolby
- DrawboardPDF
- Duolingo-LearnLanguagesforFree
- EclipseManager
- Facebook
- FarmVille2CountryEscape
- fitbit
- Flipboard
- HiddenCity
- HULULLC.HULUPLUS
- iHeartRadio
- Instagram
- king.com.BubbleWitch3Saga
- king.com.CandyCrushSaga
- king.com.CandyCrushSodaSaga
- LinkedInforWindows
- MarchofEmpires
- Netflix
- NYTCrossword
- OneCalendar
- PandoraMediaInc
- PhototasticCollage
- PicsArt-PhotoStudio
- Plex
- PolarrPhotoEditorAcademicEdition
- Royal Revolt
- Shazam
- Sidia.LiveWallpaper
- SlingTV
- Speed Test
- Spotify
- TikTok
- TuneInRadio
- Twitter
- Viber
- WinZipUniversal
- Wunderlist
- XING



!!! tip "Recommended"

    This is a recommended tweak.
## Apply
```powershell
& ([scriptblock]::Create((Invoke-RestMethod 'https://debloat.raphi.re/'))) `
  -Silent `
  -RemoveApps
```







## Links
- [Debloat Windows Script (Raphire)](https://github.com/Raphire/Win11Debloat)
