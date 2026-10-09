@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "REPORT=%~dp0assetx-db-report.txt"
if exist "%REPORT%" del "%REPORT%" >nul 2>nul

echo.
echo ==================================================
echo   AssetX - SQL Server inspection (READ ONLY)
echo   No data is changed or deleted.
echo ==================================================
echo.

set "SQLCMD="
for %%P in ("C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE" "C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\SQLCMD.EXE") do if not defined SQLCMD if exist %%P set "SQLCMD=%%~P"
if not defined SQLCMD for /d %%D in ("%ProgramFiles%\Microsoft SQL Server\*") do if exist "%%D\Tools\Binn\SQLCMD.EXE" set "SQLCMD=%%D\Tools\Binn\SQLCMD.EXE"
if not defined SQLCMD for /d %%D in ("%ProgramFiles%\Microsoft SQL Server\Client SDK\ODBC\*") do if exist "%%D\Tools\Binn\SQLCMD.EXE" set "SQLCMD=%%D\Tools\Binn\SQLCMD.EXE"
if not defined SQLCMD for /d %%D in ("%ProgramFiles(x86)%\Microsoft SQL Server\*") do if exist "%%D\Tools\Binn\SQLCMD.EXE" set "SQLCMD=%%D\Tools\Binn\SQLCMD.EXE"
if not defined SQLCMD for /f "delims=" %%P in ('where sqlcmd 2^>nul') do if not defined SQLCMD set "SQLCMD=%%P"
if not defined SQLCMD goto nosqlcmd
echo [OK] step 1/3 : sqlcmd found
echo.

set CAND=.\SQLEXPRESS02 .\SQLEXPRESS %COMPUTERNAME%\SQLEXPRESS02 %COMPUTERNAME%\SQLEXPRESS localhost\SQLEXPRESS02 localhost\SQLEXPRESS 127.0.0.1\SQLEXPRESS02 localhost 127.0.0.1 .
for /f "tokens=1" %%I in ('reg query "HKLM\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL" 2^>nul ^| findstr /i "REG_SZ"') do (
  if /i "%%I"=="MSSQLSERVER" (set CAND=!CAND! localhost) else (set CAND=!CAND! localhost\%%I)
)
for /f "tokens=1" %%I in ('reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\Microsoft SQL Server\Instance Names\SQL" 2^>nul ^| findstr /i "REG_SZ"') do (
  if /i "%%I"=="MSSQLSERVER" (set CAND=!CAND! localhost) else (set CAND=!CAND! localhost\%%I)
)

echo [2/3] searching for your SQL Server ... please wait
set "SERVER="
for %%S in (%CAND%) do if not defined SERVER (
  "%SQLCMD%" -S "%%S" -E -C -l 4 -b -Q "SET NOCOUNT ON; SELECT 1" >nul 2>nul
  if errorlevel 1 "%SQLCMD%" -S "%%S" -E -l 4 -b -Q "SET NOCOUNT ON; SELECT 1" >nul 2>nul
  if not errorlevel 1 set "SERVER=%%S"
)
if defined SERVER goto runreport

echo.
echo Windows login did not work on the automatic list.
echo Open SQL Server Management Studio and look at the top line:
echo    Server name:  ....................................
echo Type that exact name here and press Enter.
echo Example:  YOUR-PC\SQLEXPRESS02
echo.
set "SRV="
set /p SRV=Server name: 
if not defined SRV goto noserver
"%SQLCMD%" -S "%SRV%" -E -C -l 6 -b -Q "SET NOCOUNT ON; SELECT 1" >nul 2>nul
if errorlevel 1 "%SQLCMD%" -S "%SRV%" -E -l 6 -b -Q "SET NOCOUNT ON; SELECT 1" >nul 2>nul
if errorlevel 1 goto asksqluser
set "SERVER=%SRV%"
goto runreport

:asksqluser
echo.
echo That name did not connect with Windows login either.
echo Press Enter to try the username and password instead.
echo (This is the same login you use inside SQL Server Management Studio)
echo.
set "SQLU="
set "SQLP="
set /p SQLU=SQL username: 
if not defined SQLU goto noserver
set /p SQLP=SQL password: 
"%SQLCMD%" -S "%SRV%" -U "%SQLU%" -P "%SQLP%" -C -l 6 -b -Q "SET NOCOUNT ON; SELECT 1" >nul 2>nul
if errorlevel 1 "%SQLCMD%" -S "%SRV%" -U "%SQLU%" -P "%SQLP%" -l 6 -b -Q "SET NOCOUNT ON; SELECT 1" >nul 2>nul
if errorlevel 1 goto noserver
set "SERVER=%SRV%"
set "USE_SQL=1"

:runreport
echo.
echo [2/3] connected to: %SERVER%
echo [3/3] reading tables and columns ... please wait (up to 1 minute)
echo.
if defined USE_SQL (
  "%SQLCMD%" -S "%SERVER%" -U "%SQLU%" -P "%SQLP%" -C -d master -W -s"|" -f 65001 -i "%~dp0inspect.sql" -o "%REPORT%" 2>nul
  if errorlevel 1 "%SQLCMD%" -S "%SERVER%" -U "%SQLU%" -P "%SQLP%" -C -d master -W -s"|" -i "%~dp0inspect.sql" -o "%REPORT%" 2>nul
  if errorlevel 1 "%SQLCMD%" -S "%SERVER%" -U "%SQLU%" -P "%SQLP%" -d master -W -s"|" -i "%~dp0inspect.sql" -o "%REPORT%" 2>nul
) else (
  "%SQLCMD%" -S "%SERVER%" -E -C -d master -W -s"|" -f 65001 -i "%~dp0inspect.sql" -o "%REPORT%" 2>nul
  if errorlevel 1 "%SQLCMD%" -S "%SERVER%" -E -C -d master -W -s"|" -i "%~dp0inspect.sql" -o "%REPORT%" 2>nul
  if errorlevel 1 "%SQLCMD%" -S "%SERVER%" -E -d master -W -s"|" -i "%~dp0inspect.sql" -o "%REPORT%" 2>nul
)
if not exist "%REPORT%" goto noresult
for %%A in ("%REPORT%") do if %%~zA LSS 120 goto noresult
goto success

:success
echo ==================================================
echo   DONE - the report will open in Notepad now
echo   Copy all of it and send it to me in the chat.
echo ==================================================
start "" notepad "%REPORT%"
echo.
pause
exit /b 0

:nosqlcmd
echo [ERROR] sqlcmd was not found on this PC.
echo Send me this code: NO-SQLCMD
echo.
pause
exit /b 1

:noserver
echo.
echo [ERROR] Could not connect to SQL Server.
echo Make sure the SQL Server service is running.
echo Send me this code: NO-CONNECTION
echo.
pause
exit /b 1

:noresult
echo.
echo [ERROR] Connected, but the report was not written.
echo Send me this code: NO-REPORT
echo.
pause
exit /b 1
