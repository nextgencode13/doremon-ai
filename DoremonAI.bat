@echo off
rem Double-click launcher for Doremon AI on Windows - no Docker required.
rem Runs launch-windows.ps1 with an execution-policy bypass scoped to this
rem process only (does not change your system-wide PowerShell policy).
rem
rem Pass-through flags, e.g.:
rem   DoremonAI.bat -NoBrowser
rem   DoremonAI.bat -Port 7001
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch-windows.ps1" %*
