@echo off
cd /d "%~dp0"

echo.
echo ========================================
echo   Avvio sondaggio in rete locale
echo ========================================
echo.

:: Trova IP WiFi Windows
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "172\. 127\."') do (
    set IP=%%a
)
set IP=%IP: =%

:: Attiva port forwarding WSL -> Windows (richiede admin)
echo [1/3] Configuro port forwarding WSL...
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=172.29.248.230 >nul 2>&1

echo [2/3] Apro porta 3000 nel firewall...
netsh advfirewall firewall add rule name="WSL2 Sondaggio" dir=in action=allow protocol=TCP localport=3000 >nul 2>&1

echo [3/3] Avvio server...
echo.
echo ========================================
echo   URL da dare ai partecipanti:
echo   http://%IP%:3000
echo.
echo   Pannello admin:
echo   http://%IP%:3000/admin
echo ========================================
echo.
echo Premi CTRL+C per fermare il server.
echo.

:: Avvia il server in WSL
wsl -e bash -c "cd /mnt/c/Users/matte/projects/sondaggio && npm start"

:: Pulizia al termine
echo.
echo Rimozione port forwarding...
netsh interface portproxy delete v4tov4 listenport=3000 listenaddress=0.0.0.0 >nul 2>&1
netsh advfirewall firewall delete rule name="WSL2 Sondaggio" >nul 2>&1
echo Fatto.
pause
