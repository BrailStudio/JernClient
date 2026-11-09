
; JernClient custom NSIS installer

!macro customHeader
  !define MUI_FINISHPAGE_SHOWREADME ""
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "Create a desktop shortcut"
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION JernDesktopShortcut
!macroend

Function JernDesktopShortcut
  CreateShortCut "$DESKTOP\${PRODUCT_FILENAME}.lnk" "$appExe"
FunctionEnd

!macro customUnInstall
  Delete "$DESKTOP\${PRODUCT_FILENAME}.lnk"
!macroend
