@echo off
title Minerador Mercado Livre PRO & Robo WhatsApp
cd /d "%~dp0minerador-mercadolivre"

echo [1/3] Limpando portas e instancias anteriores...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001" ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1

echo [2/3] Iniciando Servidor e Painel React...
start cmd /k "npm run dev"

echo [3/3] Abrindo painel no navegador...
timeout /t 3 /nobreak >nul
start http://localhost:5173
