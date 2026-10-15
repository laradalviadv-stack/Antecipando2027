@echo off
start "" http://localhost:8075/
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servir.ps1"
