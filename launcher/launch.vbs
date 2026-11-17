' ==============================================================================
' ASAAS v2.5 - Enterprise Desktop Launcher
' Zero-Console Window Guarantee (Native Detached Process Architecture)
' ==============================================================================
Option Explicit

Dim WshShell, FSO, ScriptDir, ProjectDir, mainPy, url, pywExe, pyExe
Dim chromePath, edgePath, browserExe, browserArgs, i, serverOnline
Dim exePath, dataDir, browserProfile

Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

' 1. Resolve paths
ScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
ProjectDir = FSO.GetParentFolderName(ScriptDir)
mainPy = ProjectDir & "\backend\main.py"
exePath = ScriptDir & "\AsaasLauncher.exe"
dataDir = ProjectDir & "\data"
browserProfile = dataDir & "\browser_profile"
url = "http://127.0.0.1:8765"

' If native compiled launcher exists, hand off seamlessly with administrative elevation
If FSO.FileExists(exePath) Then
    On Error Resume Next
    Dim objShellApp
    Set objShellApp = CreateObject("Shell.Application")
    objShellApp.ShellExecute exePath, "", ProjectDir, "runas", 1
    If Err.Number = 0 Then
        WScript.Quit
    End If
    On Error GoTo 0
End If

' Ensure directories exist
If Not FSO.FolderExists(dataDir) Then
    On Error Resume Next
    FSO.CreateFolder(dataDir)
    On Error GoTo 0
End If
If Not FSO.FolderExists(browserProfile) Then
    On Error Resume Next
    FSO.CreateFolder(browserProfile)
    On Error GoTo 0
End If

' 2. Locate Python executables
pywExe = "C:\Python315\pythonw.exe"
pyExe = "C:\Python315\python.exe"

If Not FSO.FileExists(pywExe) Then
    If FSO.FileExists("C:\Python312\pythonw.exe") Then
        pywExe = "C:\Python312\pythonw.exe"
        pyExe = "C:\Python312\python.exe"
    ElseIf FSO.FileExists("C:\Program Files\Python312\pythonw.exe") Then
        pywExe = "C:\Program Files\Python312\pythonw.exe"
        pyExe = "C:\Program Files\Python312\python.exe"
    Else
        pywExe = "pythonw.exe"
        pyExe = "python.exe"
    End If
End If

' 3. Health check function
Function IsServerResponding()
    IsServerResponding = False
    On Error Resume Next
    Dim http, st
    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    http.open "GET", url & "/api/health", False
    http.setTimeouts 800, 800, 800, 800
    http.send
    If Err.Number = 0 Then
        st = http.status
        If Err.Number = 0 And st = 200 Then
            IsServerResponding = True
        End If
    End If
    On Error GoTo 0
End Function

' 4. Detached Process Starter via WMI
Sub LaunchDetached(cmdLine, workingDir)
    On Error Resume Next
    Dim objWMIService, objConfig, intProcessID, res
    Set objWMIService = GetObject("winmgmts:\\.\root\cimv2")
    Set objConfig = objWMIService.Get("Win32_ProcessStartup").SpawnInstance_
    objConfig.ShowWindow = 0 ' SW_HIDE
    res = objWMIService.Get("Win32_Process").Create(cmdLine, workingDir, objConfig, intProcessID)
    If res <> 0 Or Err.Number <> 0 Then
        WshShell.CurrentDirectory = workingDir
        WshShell.Run cmdLine, 0, False
    End If
    On Error GoTo 0
End Sub

' 5. Start Server if not already responding
serverOnline = IsServerResponding()

If Not serverOnline Then
    Dim launchCmd
    launchCmd = """" & pywExe & """ """ & mainPy & """"
    LaunchDetached launchCmd, ProjectDir

    For i = 1 To 30
        WScript.Sleep 250
        If IsServerResponding() Then
            serverOnline = True
            Exit For
        End If
    Next
End If

' 6. Locate Browser
chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
If Not FSO.FileExists(chromePath) Then
    chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
End If

edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
If Not FSO.FileExists(edgePath) Then
    edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
End If

If FSO.FileExists(chromePath) Then
    browserExe = chromePath
    browserArgs = " --user-data-dir=""" & browserProfile & """ --app=" & url & "/ --new-window --start-maximized"
ElseIf FSO.FileExists(edgePath) Then
    browserExe = edgePath
    browserArgs = " --user-data-dir=""" & browserProfile & """ --app=" & url & "/ --new-window --start-maximized"
Else
    browserExe = ""
    browserArgs = ""
End If

' 7. Open App Window
If browserExe <> "" Then
    WshShell.Run """" & browserExe & """" & browserArgs, 3, False
Else
    WshShell.Run url & "/", 3, False
End If
