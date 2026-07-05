@echo off
cd /d "%~dp0.."
echo Building wiki icons and Discord share pages...
node "%~dp0build_wiki.mjs"
if errorlevel 1 ( echo FAILED & pause & exit /b 1 )
echo Done.
pause
