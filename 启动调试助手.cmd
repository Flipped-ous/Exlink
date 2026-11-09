@echo off
cd /d "%~dp0"
if not exist "dist\index.html" (
  echo Please build EXLINK Studio first. See README.md.
  pause
  exit /b 1
)
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."
