; ============================================================================
; Jern Client installer additions
;  1. Final page: "Create a desktop shortcut" checkbox
;  2. Data-folder page: detects existing game data and keeps it
;  3. Upgrade / uninstall touches ONLY the launcher's own files
; ============================================================================
!include nsDialogs.nsh
!include LogicLib.nsh

Var JAppData
Var JPath
Var JRes
!ifndef BUILD_UNINSTALLER
  Var JDataDir
  Var JDataEdit
  Var JNote
  Var JText
!endif

; ---- UTF-16 text file helpers ----
; NSIS's own FileReadUTF16LE / FileWriteUTF16LE silently do nothing in the NSIS version electron-builder ships,
; so read/write through the Windows API instead (keeps non-ASCII folder names intact).
; JernReadDD : reads the file in $JPath  -> $JRes   (UTF-16LE, BOM skipped, "" if missing)
; JernWriteDD: writes $JText to $JPath   (UTF-16LE with BOM)
!macro JernReadFn PFX
  Function ${PFX}JernReadDD
    Push $0
    Push $1
    Push $2
    StrCpy $JRes ""
    System::Call 'kernel32::CreateFileW(w "$JPath", i 0x80000000, i 1, i 0, i 3, i 0x80, i 0) i .r0'
    ${If} $0 != -1
      System::Alloc 4096
      Pop $1
      System::Call 'kernel32::ReadFile(i r0, i r1, i 4000, *i .r2, i 0)'
      System::Call 'kernel32::CloseHandle(i r0)'
      System::Call '*$1(&t2000 .r2)'
      System::Free $1
      StrCpy $JRes $2 "" 1
    ${EndIf}
    Pop $2
    Pop $1
    Pop $0
  FunctionEnd
!macroend
!ifndef BUILD_UNINSTALLER
  !insertmacro JernReadFn ""
  Function JernWriteDD
    Push $0
    Push $1
    Push $2
    System::Call 'kernel32::CreateFileW(w "$JPath", i 0x40000000, i 0, i 0, i 2, i 0x80, i 0) i .r0'
    ${If} $0 != -1
      System::Call '*(&i1 255, &i1 254) i .r1'
      System::Call 'kernel32::WriteFile(i r0, i r1, i 2, *i .r2, i 0)'
      System::Free $1
      StrLen $1 $JText
      IntOp $1 $1 * 2
      System::Call 'kernel32::WriteFile(i r0, w "$JText", i r1, *i .r2, i 0)'
      System::Call 'kernel32::CloseHandle(i r0)'
    ${EndIf}
    Pop $2
    Pop $1
    Pop $0
  FunctionEnd
!else
  !insertmacro JernReadFn "un."
!endif

; ---------- 1. finish page: "Run Jern Client" + "Create a desktop shortcut" ----------
; electron-builder lets us replace the whole finish page through customFinishPage.
!macro customFinishPage
  Function StartApp
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd

  Function JernDesktopShortcut
    CreateShortCut "$DESKTOP\${PRODUCT_FILENAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  FunctionEnd

  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !define MUI_FINISHPAGE_SHOWREADME ""
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "Create a desktop shortcut"
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION JernDesktopShortcut
  !insertmacro MUI_PAGE_FINISH
!macroend

; ---------- 2. data-folder page (shown after the install-folder page) ----------
; The page function lives INSIDE the macro on purpose: MUI macros (MUI_HEADER_TEXT) only exist once the
; installer reaches its page section, which is where electron-builder expands this macro.
!macro customPageAfterChangeDir
  Page custom JernDataPage JernDataLeave

Function JernDataPage
  ReadEnvStr $JAppData APPDATA
  StrCpy $JDataDir "$JAppData\.jern"
  StrCpy $JNote "Game files (versions, instances, mods, worlds) will be kept in the folder below. You can change it later in Settings."
  StrCpy $JPath "$JAppData\${PRODUCT_FILENAME}\datadir.txt"
  ${If} ${FileExists} "$JPath"
    Call JernReadDD
    ${If} $JRes != ""
      StrCpy $JDataDir $JRes
      ${If} ${FileExists} "$JRes\jern-instances.json"
      ${OrIf} ${FileExists} "$JRes\versions\*.*"
        StrCpy $JNote "Existing Jern Client data was found. It will be kept as it is - only the launcher itself is updated."
      ${EndIf}
    ${EndIf}
  ${EndIf}
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  !insertmacro MUI_HEADER_TEXT "Game data folder" "Where Jern Client keeps your versions and files"
  ${NSD_CreateLabel} 0 0 100% 36u "$JNote"
  Pop $0
  ${NSD_CreateLabel} 0 46u 100% 10u "Data folder:"
  Pop $0
  ${NSD_CreateText} 0 58u 78% 13u "$JDataDir"
  Pop $JDataEdit
  ${NSD_CreateBrowseButton} 80% 57u 20% 15u "Browse..."
  Pop $0
  ${NSD_OnClick} $0 JernBrowse
  nsDialogs::Show
FunctionEnd
!macroend

!ifndef BUILD_UNINSTALLER
Function JernBrowse
  nsDialogs::SelectFolderDialog "Choose the game data folder" "$JDataDir"
  Pop $0
  ${If} $0 != error
    ${NSD_SetText} $JDataEdit $0
  ${EndIf}
FunctionEnd
!endif

!ifndef BUILD_UNINSTALLER
Function JernDataLeave
  ${NSD_GetText} $JDataEdit $JDataDir
  ${If} $JDataDir == ""
    MessageBox MB_OK|MB_ICONEXCLAMATION "Please choose a data folder."
    Abort
  ${EndIf}
  ; never keep game data directly in the launcher's own folder
  ${If} $JDataDir == "$INSTDIR"
  ${OrIf} $JDataDir == "$INSTDIR\"
    StrCpy $JDataDir "$INSTDIR\JernData"
  ${EndIf}
FunctionEnd
!endif

; remember the chosen folder only once the install really happens (not if the user cancels)
!macro customInstall
  ${If} $JDataDir != ""
    ${If} $JDataDir == "$INSTDIR"
      StrCpy $JDataDir "$INSTDIR\JernData"
    ${EndIf}
    CreateDirectory "$JAppData\${PRODUCT_FILENAME}"
    StrCpy $JPath "$JAppData\${PRODUCT_FILENAME}\datadir.txt"
    StrCpy $JText "$JDataDir"
    Call JernWriteDD
    FileOpen $0 "$JAppData\${PRODUCT_FILENAME}\datadir.pending" w
    FileWrite $0 "1"
    FileClose $0
  ${EndIf}
!macroend

; ---------- 3. remove only the launcher's files (never game data) ----------
!macro customRemoveFiles
  Delete "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  Delete "$INSTDIR\${UNINSTALL_FILENAME}"
  Delete "$INSTDIR\chrome_100_percent.pak"
  Delete "$INSTDIR\chrome_200_percent.pak"
  Delete "$INSTDIR\resources.pak"
  Delete "$INSTDIR\icudtl.dat"
  Delete "$INSTDIR\snapshot_blob.bin"
  Delete "$INSTDIR\v8_context_snapshot.bin"
  Delete "$INSTDIR\d3dcompiler_47.dll"
  Delete "$INSTDIR\dxcompiler.dll"
  Delete "$INSTDIR\dxil.dll"
  Delete "$INSTDIR\ffmpeg.dll"
  Delete "$INSTDIR\libEGL.dll"
  Delete "$INSTDIR\libGLESv2.dll"
  Delete "$INSTDIR\vk_swiftshader.dll"
  Delete "$INSTDIR\vk_swiftshader_icd.json"
  Delete "$INSTDIR\vulkan-1.dll"
  Delete "$INSTDIR\version"
  Delete "$INSTDIR\LICENSE.electron.txt"
  Delete "$INSTDIR\LICENSES.chromium.html"
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\locales"
  ; a real uninstall (not an update) offers to delete the game data too - default is to KEEP it
  ${ifNot} ${isUpdated}
  ${andIfNot} ${Silent}
    Call un.JernAskDeleteData
  ${endIf}
  RMDir "$INSTDIR"   ; removes the folder only if it is empty, so data stored inside survives
!macroend

!ifdef BUILD_UNINSTALLER
Function un.JernAskDeleteData
  ReadEnvStr $JAppData APPDATA
  StrCpy $JPath "$JAppData\${PRODUCT_FILENAME}\datadir.txt"
  ${If} ${FileExists} "$JPath"
    Call un.JernReadDD
    ${If} $JRes != ""
      ; only offer to delete a folder that clearly is Jern Client data
      ${If} ${FileExists} "$JRes\jern-instances.json"
        MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "Also delete your Jern Client game data (instances, worlds, mods, downloaded versions)?$\r$\n$\r$\n$JRes$\r$\n$\r$\nChoose No to keep it." /SD IDNO IDNO keepdata
        RMDir /r "$JRes"
        keepdata:
      ${EndIf}
    ${EndIf}
  ${EndIf}
FunctionEnd
!endif

!macro customUnInstall
  Delete "$DESKTOP\${PRODUCT_FILENAME}.lnk"
!macroend
