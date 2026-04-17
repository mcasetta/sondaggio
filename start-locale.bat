@echo off
cd /d "%~dp0"

echo.
echo ========================================
echo   Setup rete locale - sondaggio
echo ========================================
echo.

:: Trova IP (esclude loopback e WSL)
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "172\. 127\."') do (
    set IP=%%a
)
set IP=%IP: =%

:: Port forwarding WSL -> Windows
echo Configuro port forwarding...
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=172.29.248.230 >nul 2>&1

echo Apro porta 3000 nel firewall...
netsh advfirewall firewall add rule name="WSL2 Sondaggio" dir=in action=allow protocol=TCP localport=3000 >nul 2>&1

echo.
echo ========================================
echo   Fatto! Ora dal terminale WSL lancia:
echo   npm start
echo.
echo   URL partecipanti:  http://%IP%:3000
echo   URL admin:         http://%IP%:3000/admin
echo ========================================
echo.
echo Premi un tasto quando hai finito
echo (rimuove il port forwarding)
pause >nul

echo Rimozione port forwarding...
netsh interface portproxy delete v4tov4 listenport=3000 listenaddress=0.0.0.0 >nul 2>&1
netsh advfirewall firewall delete rule name="WSL2 Sondaggio" >nul 2>&1
echo Fatto.
pause
