# Sondaggio Genitore/Educatore — Contesto progetto

## Cos'è questa app
Web app stile Mentimeter per un questionario di gruppo ("Che tipo di genitore/educatore sei?") da usare durante un incontro con 8-10 persone da smartphone. Commissionata da Matteo.

## Stack
- Backend: Node.js + Express + Socket.io (in-memory, no database)
- Frontend: HTML/CSS/JS vanilla (mobile-first)
- Deploy: Railway (railway.app) — repo `mcasetta/sondaggio` su GitHub

## File principali
- `server.js` — server Express + Socket.io, gestione stato in memoria, slide con testi doppi per ruolo
- `public/index.html` + `public/js/participant.js` — vista partecipante
- `public/admin.html` + `public/js/admin.js` — pannello presenter
- `public/css/style.css` — stile mobile-first
- `railway.json` — config deploy Railway
- `start-locale.bat` — setup rete locale (netsh port forwarding, mostra IP); eseguire come Amministratore, poi avviare `npm start` dal terminale WSL
- `domande.txt` — fonte originale delle domande (già integrate in server.js)

## Ruoli utente
- **Presenter** (Matteo): accede a `/admin`, password `admin2024` (o env var `ADMIN_PASSWORD`), controlla le slide con frecce/tastiera, vede risultati in tempo reale e QR code. Funziona anche da tablet.
- **Partecipante** (smartphone): accede alla root `/`, inserisce nickname e sceglie il proprio ruolo (Genitore / Animatore)

## Ruolo partecipante: genitore vs animatore
Al login ogni partecipante sceglie il proprio ruolo. In base alla scelta:
- Il titolo della prima slide cambia (genitore/educatore)
- Il testo delle 5 domande cambia (figlio→ragazzo, casa→oratorio, ecc.)
- I profili risultato cambiano (Genitore X → Educatore X, descrizioni adattate)

## Slide implementate
1. Slide testo intro (titolo diverso per ruolo)
2-6. 5 slide sondaggio (testo domanda diverso per ruolo, opzioni A/B/C/D uguali)
7. Slide risultati finale

## Profili risultato (doppi per ruolo)
| Lettera | Genitore | Animatore |
|---|---|---|
| A | Genitore guida 👣 | Educatore guida 👣 |
| B | Genitore amico 🤝 | Educatore amico 🤝 |
| C | Genitore protettivo 🛡️ | Educatore protettivo 🛡️ |
| D | Genitore permissivo 🌿 | Educatore permissivo 🌿 |

I badge A/B/C/D nella slide risultati sono cliccabili: mostrano il profilo corrispondente.

## Risultati visibili al partecipante (slide finale)
1. Profilo personale (emoji, nome, descrizione) — cliccabile sulle altre lettere
2. Distribuzione profili del gruppo (grafico a barre)
3. Grafico risposte per ogni singola domanda

## Deploy Railway
- Variabile env: `ADMIN_PASSWORD` (default: `admin2024`)
- Variabile env: `APP_URL` = URL pubblico Railway (per QR code corretto)
- Railway non mette in sleep l'app → sospendere manualmente da Settings → Danger → Suspend (o Delete e ricreare prima dell'incontro)

## Avvio in locale (rete locale WiFi)
1. Eseguire `start-locale.bat` come Amministratore → mostra l'IP e configura port forwarding
2. Dal terminale WSL: `npm start`
3. Partecipanti si collegano a `http://<IP>:3000`
4. Premere tasto nel bat per rimuovere il port forwarding a fine sessione

## Note importanti
- Lo stato è in-memory: un restart del server azzera tutto (va bene per un evento singolo)
- Il bottone "Reset sessione" nel pannello admin azzera risposte e partecipanti senza restart
- I partecipanti si identificano con un ID di sessione (sessionStorage), non serve registrazione
- L'app è pensata per un singolo evento, non per uso continuativo
