; ASAAS — appliance installer (Inno Setup 6)
; Consumes the staged payload produced by tools\build-release.ps1 (release\).
;
; Build:  ISCC.exe /DAppVersion=1.0.0 packaging\asaas.iss
;
; Layout installed:
;   {autopf}\ASAAS\bin\asaas-backend.exe
;   {autopf}\ASAAS\bin\asaas-control.exe
;   {autopf}\ASAAS\bin\Asaas.Agent.exe
;   {autopf}\ASAAS\web\   (SPA)
;   {autopf}\ASAAS\data\  (runtime state, ACL: SYSTEM+Admins)
;
; Auto-start is via Scheduled Tasks (SYSTEM, at startup) — the exes are not
; SCM-aware services, and tasks give us restart-on-failure for free.

#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif

[Setup]
AppId={{7F3A9C21-4B8E-4E2A-9C61-2A11C0FFEE01}}
AppName=ASAAS
AppVersion={#AppVersion}
AppPublisher=ASAAS
DefaultDirName={autopf}\ASAAS
DefaultGroupName=ASAAS
DisableProgramGroupPage=yes
PrivilegesRequired=admin
OutputDir=..\installer-out
OutputBaseFilename=ASAAS-Setup-{#AppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "startconsole"; Description: "Launch ASAAS after installation"; GroupDescription: "Startup:"

[Files]
Source: "..\release\bin\asaas-backend.exe"; DestDir: "{app}\bin"; Flags: ignoreversion
Source: "..\release\bin\asaas-control.exe"; DestDir: "{app}\bin"; Flags: ignoreversion
Source: "..\release\bin\Asaas.Agent.exe"; DestDir: "{app}\bin"; Flags: ignoreversion
Source: "..\release\web\*"; DestDir: "{app}\web"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "scripts\*.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion skipifsourcedoesntexist

[Dirs]
Name: "{app}\data"; Permissions: system-full admins-full
Name: "{app}\data\backups"; Permissions: system-full admins-full

[Icons]
; Per-user shortcuts only — admin installs must not leak icons into the
; shared Public desktop / All Users start menu.
Name: "{userprograms}\ASAAS"; Filename: "http://127.0.0.1:8876/"
Name: "{userprograms}\ASAAS\Uninstall ASAAS"; Filename: "{uninstallexe}"
Name: "{userdesktop}\ASAAS"; Filename: "http://127.0.0.1:8876/"; Tasks: startconsole

[Run]
; Register auto-start scheduled tasks (SYSTEM, at startup + watchdogs).
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\install-tasks.ps1"""; Flags: runhidden waituntilterminated
Filename: "http://127.0.0.1:8876/"; Description: "Open ASAAS"; Flags: postinstall nowait skipifsilent shellexec unchecked

[UninstallRun]
Filename: "schtasks.exe"; Parameters: "/delete /tn ""ASAAS Backend"" /f"; Flags: runhidden; RunOnceId: "delbackend"
Filename: "schtasks.exe"; Parameters: "/delete /tn ""ASAAS Control Plane"" /f"; Flags: runhidden; RunOnceId: "delcontrol"
Filename: "schtasks.exe"; Parameters: "/delete /tn ""ASAAS Backend Watchdog"" /f"; Flags: runhidden; RunOnceId: "delbackendwd"
Filename: "schtasks.exe"; Parameters: "/delete /tn ""ASAAS Control Plane Watchdog"" /f"; Flags: runhidden; RunOnceId: "delcontrolwd"

[Code]
// Kill running processes before uninstall removes the binaries.
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ResultCode: Integer;
begin
  if CurUninstallStep = usUninstall then
  begin
    Exec('schtasks.exe', '/end /tn "ASAAS Backend"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Exec('schtasks.exe', '/end /tn "ASAAS Control Plane"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Exec('taskkill.exe', '/f /im asaas-backend.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Exec('taskkill.exe', '/f /im asaas-control.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;
