@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo.
echo ==================================================
echo   AssetX - convert old SQL Server data to Excel
echo   The source database is READ ONLY (no changes).
echo ==================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto nonode

node "%~dp0convert.js" %*
set "RC=%ERRORLEVEL%"
echo.

if not "%RC%"=="0" goto failed

echo ==================================================
echo   DONE - five Excel files are ready in the "out" folder
echo   The folder will open now.
echo ==================================================
if exist "%~dp0out\conversion-report.txt" start "" notepad "%~dp0out\conversion-report.txt"
if exist "%~dp0out" start "" explorer "%~dp0out"
echo.
pause
exit /b 0

:nonode
echo [ERROR] Node.js was not found on this PC.
echo Send me this code: NO-NODE
echo.
pause
exit /b 1

:failed
if "%RC%"=="2" echo [ERROR] sqlcmd was not found. Send me this code: NO-SQLCMD
if "%RC%"=="3" echo [ERROR] Could not connect to SQL Server. Send me this code: NO-CONNECTION
if "%RC%"=="4" echo [ERROR] Some tables could not be read. Send me the lines above.
if "%RC%"=="5" echo [ERROR] The database name was not found. Send me the lines above.
if "%RC%"=="1" echo [ERROR] Unexpected error. Send me the lines above.
echo.
pause
exit /b %RC%
