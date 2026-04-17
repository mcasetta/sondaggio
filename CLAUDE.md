# Sondaggio Genitore — Contesto progetto

## Cos'è questa app
Web app stile Mentimeter per un questionario di gruppo ("Che tipo di genitore sei?") da usare durante un incontro con 8-10 persone da smartphone. Commissionata da Matteo.

## Stack
- Backend: Node.js + Express + Socket.io (in-memory, no database)
- Frontend: HTML/CSS/JS vanilla (mobile-first)
- Deploy target: Railway (railway.app)

## File principali
- `server.js` — server Express + Socket.io, gestione stato in memoria
- `public/index.html` + `public/js/participant.js` — vista partecipante
- `public/admin.html` + `public/js/admin.js` — pannello presenter
- `public/css/style.css` — stile mobile-first
- `railway.json` — config deploy Railway
- `init-git.bat` — script Windows per inizializzare il repo git (doppio clic per usarlo)
- `domande.txt` — fonte originale delle domande (già integrate in server.js)

## Ruoli
- **Presenter** (Matteo, da PC): accede a `/admin`, password `admin2024` (o env var `ADMIN_PASSWORD`), controlla le slide con frecce, vede risultati in tempo reale, QR code dell'URL
- **Partecipante** (smartphone): accede alla root `/`, inserisce nickname, risponde in sincronia col presenter

## Slide implementate
1. Slide testo intro (nessuna interazione)
2-6. 5 slide sondaggio (domande con opzioni A/B/C/D)
7. Slide risultati finale

## Le 5 domande (da domande.txt, già hardcoded in server.js)
1. Quando tuo figlio/un ragazzo fa qualcosa di sbagliato…
2. Le regole in casa/oratorio…
3. Quando tuo figlio/un ragazzo è in difficoltà…
4. Il dialogo con i figli/ragazzi…
5. Il tuo obiettivo come genitore/educatore è…

## Profili risultato
- Maggioranza A → Genitore guida 👣
- Maggioranza B → Genitore amico 🤝
- Maggioranza C → Genitore protettivo 🛡️
- Maggioranza D → Genitore permissivo 🌿

## Stato deploy
- App **non ancora deployata** su Railway (al momento della sessione)
- Per deployare: eseguire `init-git.bat`, creare repo su GitHub, collegare a Railway
- Variabile env opzionale: `ADMIN_PASSWORD` per cambiare la password admin
- Variabile env opzionale: `APP_URL` per far puntare il QR code all'URL pubblico corretto

## Come avviare in locale
```
npm install   # solo la prima volta
npm start     # → http://localhost:3000 (partecipanti)
              # → http://localhost:3000/admin (presenter, pwd: admin2024)
```

## Note importanti
- Lo stato è in-memory: un restart del server azzera tutto (va bene per un evento singolo)
- Il bottone "Reset sessione" nel pannello admin azzera risposte e partecipanti senza restart
- I partecipanti si identificano con un ID di sessione (sessionStorage), non serve registrazione
- L'app è pensata per un singolo evento, non per uso continuativo
