!macro customInstall
  WriteRegStr SHELL_CONTEXT "Software\Classes\*\shell\DevScopeAir" "" "Open with DevScope Air"
  WriteRegStr SHELL_CONTEXT "Software\Classes\*\shell\DevScopeAir" "Icon" "$appExe,0"
  WriteRegStr SHELL_CONTEXT "Software\Classes\*\shell\DevScopeAir" "Position" "Top"
  WriteRegStr SHELL_CONTEXT "Software\Classes\*\shell\DevScopeAir\command" "" '"$appExe" "%1"'

  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\shell\DevScopeAir" "" "Open with DevScope Air"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\shell\DevScopeAir" "Icon" "$appExe,0"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\shell\DevScopeAir" "Position" "Top"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\shell\DevScopeAir\command" "" '"$appExe" "%1"'

  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\Background\shell\DevScopeAir" "" "Open DevScope Air Here"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\Background\shell\DevScopeAir" "Icon" "$appExe,0"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\Background\shell\DevScopeAir" "Position" "Top"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\Background\shell\DevScopeAir\command" "" '"$appExe" "%V"'
!macroend

!macro customUnInstall
  ${ifNot} ${isUpdated}
    DeleteRegKey SHELL_CONTEXT "Software\Classes\*\shell\DevScopeAir"
    DeleteRegKey SHELL_CONTEXT "Software\Classes\Directory\shell\DevScopeAir"
    DeleteRegKey SHELL_CONTEXT "Software\Classes\Directory\Background\shell\DevScopeAir"
  ${endIf}
!macroend
