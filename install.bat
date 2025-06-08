@echo off
setlocal

set TARGET=%~dp0index.html
set ICON=%~dp0favicon.ico
set OUTPUT=%USERPROFILE%\Desktop\Easy Notes.url

(
echo [InternetShortcut]
echo URL=file:///%TARGET:/=\%
echo IconFile=%ICON%
echo IconIndex=0
) > "%OUTPUT%"

echo Shortcut created as "Easy Notes" on desktop.
pause
