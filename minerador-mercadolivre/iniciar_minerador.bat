@echo off
title Minerador Mercado Livre + Robo WhatsApp
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;C:\Program Files\Git\cmd;%PATH%"
npm run dev
pause
