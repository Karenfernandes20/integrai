@echo off
echo Matando processos Node anteriores...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo.
echo Iniciando Backend e Frontend...
echo.
echo IMPORTANTE: Duas janelas vao abrir.
echo NAO FECHE ESSAS JANELAS!
echo.
pause

start "INTEGRAI BACKEND" cmd /c "cd /d %~dp0 && npm run server"
timeout /t 3 /nobreak >nul

start "INTEGRAI FRONTEND" cmd /c "cd /d %~dp0 && npm run dev"

echo.
echo Aguarde 10 segundos e acesse: http://localhost:8082
echo.
timeout /t 10 /nobreak
start http://localhost:8082
