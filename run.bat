@echo off
setlocal
cd /d "%~dp0"

set PORT=%~1
if "%PORT%"=="" set PORT=8123

where python >nul 2>nul
if %errorlevel%==0 (
  python serve.py %PORT% 0.0.0.0
) else (
  py -3 serve.py %PORT% 0.0.0.0
)

echo.
echo Server stopped. Press any key to close this window.
pause >nul
