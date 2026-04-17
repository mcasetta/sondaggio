@echo off
cd /d "%~dp0"

echo Inizializzazione repository Git...
git init
git add .
git commit -m "init: sondaggio genitore"

echo.
echo ✅ Fatto! Ora vai su https://railway.app e crea un nuovo progetto da GitHub.
echo    Ricordati di fare prima il push su GitHub:
echo.
echo    git remote add origin https://github.com/TUO-UTENTE/sondaggio.git
echo    git branch -M main
echo    git push -u origin main
echo.
pause
