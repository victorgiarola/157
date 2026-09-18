@echo off
title Minerador Mercado Livre PRO
cd /d "%~dp0minerador-mercadolivre"
echo Iniciando o Servidor de Mineracao e o Painel React...
start cmd /k "npm run dev"
timeout /t 3 /nobreak >nul
start http://localhost:5173
