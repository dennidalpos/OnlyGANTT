; OnlyGANTT NSIS Installer Script (x64)
Unicode true
!include "MUI2.nsh"
!include "x64.nsh"

Name "OnlyGANTT"
OutFile "..\..\artifacts\packages\OnlyGANTT-Setup-x64.exe"
InstallDir "$PROGRAMFILES64\OnlyGANTT"
InstallDirRegKey HKLM "SOFTWARE\Danny Perondi\OnlyGANTT\Installer" "InstallRoot"
RequestExecutionLevel admin

!define MUI_ABORTWARNING
!define MUI_ICON "..\..\src\public\brand\onlygantt.ico"
!define MUI_UNICON "..\..\src\public\brand\onlygantt.ico"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Function .onInit
  ${If} ${RunningX64}
    SetRegView 64
  ${Else}
    MessageBox MB_OK|MB_ICONSTOP "OnlyGANTT requires a 64-bit version of Windows."
    Abort
  ${EndIf}
FunctionEnd

Function un.onInit
  ${If} ${RunningX64}
    SetRegView 64
  ${EndIf}
FunctionEnd

Section "MainSection" SecMain
  SetOutPath "$INSTDIR"

  ; Stop existing service if present
  ExecWait 'sc.exe stop OnlyGanttWeb'
  ExecWait 'sc.exe delete OnlyGanttWeb'
  Sleep 1000

  ; Install root files
  File "..\..\package.json"
  File "..\..\package-lock.json"

  ; Install application components
  SetOutPath "$INSTDIR\src\server"
  File /r "..\..\src\server\*.*"

  SetOutPath "$INSTDIR\src\public"
  File /r "..\..\src\public\*.*"

  SetOutPath "$INSTDIR\artifacts\build\client"
  File /r "..\..\artifacts\build\client\*.*"

  SetOutPath "$INSTDIR\service"
  File /r "..\..\artifacts\build\service\*.*"

  SetOutPath "$INSTDIR\node_modules"
  File /r "..\..\node_modules\*.*"

  SetOutPath "$INSTDIR"

  ; Install & Start OnlyGanttWeb Service
  ExecWait 'sc.exe create OnlyGanttWeb binPath= "\"$INSTDIR\service\OnlyGantt.Service.exe\"" start= auto DisplayName= "OnlyGANTT Web Service"'
  ExecWait 'sc.exe start OnlyGanttWeb'

  ; Registry configuration
  WriteRegStr HKLM "SOFTWARE\Danny Perondi\OnlyGANTT\Installer" "InstallRoot" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\OnlyGANTT" "DisplayName" "OnlyGANTT"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\OnlyGANTT" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\OnlyGANTT" "DisplayIcon" "$INSTDIR\src\public\brand\onlygantt.ico"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\OnlyGANTT" "Publisher" "Danny Perondi"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\OnlyGANTT" "InstallLocation" "$INSTDIR"

  ; Common Desktop URL Shortcuts
  SetOutPath "$DESKTOP"
  WriteINIStr "$DESKTOP\OnlyGANTT.url" "InternetShortcut" "URL" "http://localhost:3000/"
  WriteINIStr "$DESKTOP\OnlyGANTT.url" "InternetShortcut" "IconFile" "$INSTDIR\src\public\brand\onlygantt.ico"
  WriteINIStr "$DESKTOP\OnlyGANTT.url" "InternetShortcut" "IconIndex" "0"

  WriteINIStr "$DESKTOP\OnlyGANTT Admin.url" "InternetShortcut" "URL" "http://localhost:3000/#admin"
  WriteINIStr "$DESKTOP\OnlyGANTT Admin.url" "InternetShortcut" "IconFile" "$INSTDIR\src\public\brand\onlygantt.ico"
  WriteINIStr "$DESKTOP\OnlyGANTT Admin.url" "InternetShortcut" "IconIndex" "0"

  ; Create Uninstaller
  WriteUninstaller "$INSTDIR\uninstall.exe"
SectionEnd

Section "Uninstall"
  ; Stop & Remove Service
  ExecWait 'sc.exe stop OnlyGanttWeb'
  ExecWait 'sc.exe delete OnlyGanttWeb'
  Sleep 1000

  ; Remove desktop shortcuts
  Delete "$DESKTOP\OnlyGANTT.url"
  Delete "$DESKTOP\OnlyGANTT Admin.url"

  ; Registry cleanup
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\OnlyGANTT"
  DeleteRegKey HKLM "SOFTWARE\Danny Perondi\OnlyGANTT\Installer"
  DeleteRegKey HKLM "SOFTWARE\Danny Perondi\OnlyGANTT"

  ; Remove installed files
  RMDir /r "$INSTDIR\src"
  RMDir /r "$INSTDIR\artifacts"
  RMDir /r "$INSTDIR\service"
  RMDir /r "$INSTDIR\node_modules"
  Delete "$INSTDIR\package.json"
  Delete "$INSTDIR\package-lock.json"
  Delete "$INSTDIR\uninstall.exe"

  ; Remove install dir if empty
  RMDir "$INSTDIR"
SectionEnd
