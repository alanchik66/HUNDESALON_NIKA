' Launch cursor-keep-awake.ps1 completely hidden (no console window).
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
ps1 = fso.GetParentFolderName(WScript.ScriptFullName) & "\cursor-keep-awake.ps1"
cmd = "pwsh.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """"
sh.Run cmd, 0, False
