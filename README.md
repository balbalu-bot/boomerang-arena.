# Boomerang Battle Arena

Party game 3D a visuale isometrica: lancia il boomerang, richiamalo, devia i colpi e spingi gli avversari nella lava. Un colpo e sei fuori.

Funziona direttamente nel browser (Chrome, Edge, Firefox, Safari) su Windows, macOS, tablet e smartphone. Nessuna installazione, nessuna pubblicità, nessun dato raccolto.

> **Versione 0.4 — gioco online con stanze private e radio (chat vocale).** Si gioca online (fino a 8 tra persone e bot) oppure sullo stesso dispositivo con tastiera, controller e bot. 

---

## Cosa c'è in questa versione

| Area | Contenuto |
|---|---|
| Grafica | Three.js, visuale isometrica, ombre dinamiche, contorni cartoon, particelle, esplosioni, acqua e lava animate, vegetazione che ondeggia, telecamera che inquadra tutti i giocatori, 3 livelli di qualità |
| Personaggi | 24 personaggi originali 3D con animazioni di corsa, carica, lancio, scatto, corpo a corpo, eliminazione, vittoria e battito di ciglia. Tutti con le stesse caratteristiche (modalità competitiva equilibrata) |
| Combattimento | Lancio con carica e traiettoria curva, ritorno automatico, richiamo anticipato, colpo anche al ritorno, corpo a corpo che devia i boomerang, scontro di lame, scatto che spinge, rimbalzi sui muri, collisioni tra boomerang, raccolta delle armi da terra, eliminazione con un colpo |
| Arene | 5 arene: Giardino giapponese, Cucina gigante, Vulcano, Lago ghiacciato, Isola tropicale. Acqua, lava, ghiaccio scivoloso, vuoto, casse distruttibili, barili esplosivi, cespugli in cui nascondersi, ponti. Arena casuale a ogni round |
| Modalità | Classica (ultimo in piedi) e Squadre (rossi contro blu, senza fuoco amico) |
| Bot | 4 livelli (facile, normale, difficile, esperto): percorsi, mira con anticipo, schivate, deviazioni, richiamo intelligente, spinte nei pericoli, ricerca delle armi, nascondigli |
| Comandi | Tastiera e mouse (tasti riassegnabili), controller Xbox / PlayStation / Switch Pro / Bluetooth generici con vibrazione, joystick touch |
| Audio | Effetti e musica generati dal codice (nessun file di terzi), volumi separati |
| Lingue | Italiano e inglese |

---

## Pubblicazione su GitHub Pages (passo per passo)

1. Su GitHub crea un **nuovo repository pubblico**, per esempio `boomerang-arena` (account `balbalu-bot`).
2. Clicca **Add file → Upload files** e trascina **tutto il contenuto** della cartella del progetto (non la cartella stessa): `index.html`, `.nojekyll`, le cartelle `css`, `js`, `vendor`, `docs`, `.github`.
   - Se il caricamento da browser salta la cartella `.github` (è nascosta su alcuni sistemi), usa il metodo B qui sotto.
3. Scrivi un messaggio (es. "Prima versione") e premi **Commit changes**.
4. Vai su **Settings → Pages**.
   - **Metodo A (consigliato):** in *Build and deployment → Source* scegli **GitHub Actions**. Il file `.github/workflows/deploy.yml` pubblica il gioco a ogni modifica.
   - **Metodo B (più semplice):** in *Source* scegli **Deploy from a branch**, ramo `main`, cartella `/ (root)`, poi **Save**.
5. Dopo 1-2 minuti il gioco è online su `https://balbalu-bot.github.io/boomerang-arena/`.

Per aggiornare: carica di nuovo i file modificati con **Upload files** (sovrascrivono quelli vecchi).

### Provarlo sul computer prima di pubblicarlo
I moduli JavaScript non funzionano aprendo `index.html` con doppio clic. Serve un piccolo server locale, per esempio con Python:
```
cd boomerang-arena
python -m http.server 8000
```
poi apri `http://localhost:8000`.

---

## Attivare il gioco online (una volta sola, circa 10 minuti)

Il gioco online usa **Supabase** (gratuito) solo per stanze e collegamento iniziale; durante la partita i dati viaggiano direttamente tra i browser.

1. **Crea il progetto Supabase.** Vai su https://supabase.com/dashboard → **New project**. Nome: `boomerang-arena`, scegli una password (conservala, ma NON metterla nel gioco), regione **Central EU (Frankfurt)**. Attendi 1-2 minuti.
2. **Crea le tabelle.** Nel progetto: **SQL Editor → New query**. Apri il file `supabase/schema.sql`, copia tutto, incolla e premi **Run**. Deve comparire "Success".
3. **Attiva l'accesso anonimo.** **Authentication → Sign In / Providers** (o *Providers*) → attiva **Allow anonymous sign-ins** → **Save**. Serve perché i ragazzi non devono registrarsi con email.
4. **Copia le due chiavi pubbliche.** **Project Settings → API** (o *Data API* / *API Keys*): copia **Project URL** e la chiave **anon public** (inizia con `eyJ...`). ⚠️ Non usare mai la chiave `service_role`.
5. **Inseriscile nel gioco.** Su GitHub apri `js/net/net-config.js` → icona della matita (Edit) → incolla tra gli apici:
   ```js
   SUPABASE_URL: 'https://xxxxxxxx.supabase.co',
   SUPABASE_ANON_KEY: 'eyJ...',
   ```
   poi **Commit changes**. Dopo 1-2 minuti il sito si aggiorna.
6. **(Consigliato) Solo canali privati.** **Realtime → Settings** → disattiva **Allow public access** → **Save**.

### Come si gioca online
1. **Gioca online** → scrivi un soprannome → **Crea una stanza**.
2. Premi **Copia link** e mandalo all'altro giocatore (WhatsApp, SMS…). Chi apre il link trova il codice già inserito: scrive il soprannome e preme **Entra nella stanza**.
3. Ognuno sceglie il personaggio con ◀ ▶ e preme **Pronto!**. **Quando tutti sono pronti la partita parte da sola.** L'host può aggiungere bot e scegliere modalità, round e arena; con **Avvia ora** parte subito.
4. A fine partita l'host sceglie **Rivincita** o **Torna alla stanza**.

### Radio (chat vocale)
- Nella stanza e durante la partita, in basso a sinistra c'è la barra della radio: **🎤** microfono, **🔊** audio degli altri, **⚙** impostazioni.
- Il microfono parte **spento**. Si accende con 🎤 o il tasto **M** (la prima volta il browser chiede il permesso) e resta acceso finché non lo spegni o esci dalla stanza.
- **Premi per parlare** (in ⚙): si trasmette solo tenendo premuto **V** o il tasto **Select/View/Share/−** del controller.
- In ⚙ si sceglie il microfono e si regola o si silenzia il volume di ogni giocatore. Chi parla ha il simbolo 🔊 accanto al nome.
- La musica si abbassa da sola quando qualcuno parla. Eco, rumore e volume del microfono sono corretti automaticamente dal browser.
- La radio non passa da nessun server di gioco e non viene registrata. Resta collegata passando dalla stanza alla partita e tra i round.
- Su iPhone/iPad serve Safari aggiornato; se non senti gli altri, tocca una volta lo schermo.

**Da sapere**
- La partita gira sul dispositivo di chi crea la stanza (l'host): conviene che la crei chi ha il computer più potente e la connessione migliore, e che **non chiuda o rimpicciolisca la scheda** durante la partita. Se l'host esce, la stanza si chiude per tutti.
- Accanto a ogni giocatore c'è lo stato del collegamento: **● diretta** (ottimo) oppure **◐ indiretta**. "Indiretta" succede in alcune reti (scuole, alcuni operatori mobili): il gioco funziona lo stesso ma meno fluido e consuma i messaggi gratuiti di Supabase. Per risolvere si può aggiungere un server TURN in `js/net/net-config.js` (vedi `docs/ARCHITETTURA.md`).
- Le stanze scadono dopo 12 ore. Il codice è casuale; l'host può **chiudere la stanza** a nuovi ingressi ed espellere un giocatore con ✕.
- Un progetto Supabase gratuito che non viene usato per una settimana va in pausa: basta riattivarlo dalla dashboard.
- Chi entra a partita iniziata la guarda e gioca dalla partita successiva.

## Comandi

**Tastiera e mouse** — WASD muoversi · mouse mirare · tasto sinistro tieni premuto per caricare e rilascia per lanciare · tasto destro corpo a corpo (o richiamo se l'arma è in volo) · Spazio scatto · ESC pausa. I tasti si cambiano in *Impostazioni*.

**Controller** — levetta sinistra muoversi · levetta destra mirare · RT/R2/ZR o A/✕ lancio · X/□ o RB/R1 corpo a corpo e richiamo · LT/L2/ZL o B/○ scatto · Start/Options/+ pausa. Nei menu: croce direzionale e A per confermare.

**Touch** — metà sinistra dello schermo: joystick di movimento. Metà destra: trascina per mirare e caricare, rilascia per lanciare. Pulsanti ⚡ scatto e ✋ corpo a corpo.

### Collegare i controller
Nella schermata **Gioca**, ogni giocatore con un controller preme **A / ✕** per entrare e sceglie il personaggio con la croce direzionale. **B / ○** per uscire, **Start** per iniziare.

| Controller | Collegamento | Note |
|---|---|---|
| Xbox One / Series | USB o Bluetooth | Funziona in tutti i browser principali |
| PlayStation 4 / 5 | USB o Bluetooth | Funziona in Chrome, Edge, Safari; in Firefox i tasti possono variare |
| Switch Pro Controller | Bluetooth o USB | Funziona meglio in Chrome/Edge. I tasti seguono la posizione fisica (il tasto in basso lancia) |
| Bluetooth generici | Bluetooth | Se il browser li riconosce come "standard" funzionano come un controller Xbox |

Il browser vede un controller solo dopo che hai **premuto un suo tasto** con la pagina aperta. Per entrare in partita basta premere **un tasto qualsiasi**. Se i tasti non fanno la cosa giusta (capita con joystick generici, soprattutto su Mac): **Impostazioni → Configura controller** e premi i tasti richiesti; il gioco li ricorda. Su iPhone/iPad servono iOS 13 o successivo e Safari.

---

## Struttura del progetto

```
index.html              pagina, menu e interfaccia
css/style.css           stile dell'interfaccia
js/main.js              avvio, menu, preparazione partita, ciclo principale
js/core/                configurazione, impostazioni, lingue, input, audio
js/engine/              renderer/telecamera, sistema particellare
js/game/characters.js   i 24 personaggi (modelli procedurali)
js/game/arena.js        costruzione delle arene e collisioni
js/game/world.js        simulazione del round (giocatori, boomerang, eliminazioni)
js/game/ai.js           intelligenza artificiale dei bot
js/game/match.js        round, punteggi, eventi, HUD
js/data/arenas.js       mappe delle arene
js/net/                 gioco online: configurazione, stanze, collegamento WebRTC, sincronizzazione
js/ui/lobby.js          schermate online e stanza
supabase/schema.sql     tabelle e sicurezza del database
vendor/                 Three.js r170 e supabase-js (licenza MIT) inclusi localmente
docs/ARCHITETTURA.md    architettura e piano delle fasi successive
```

### Aggiungere un personaggio
In `js/game/characters.js` aggiungi una voce all'elenco `CHARACTERS` con `id`, `name`, `color` e una funzione `build(p)` che disegna il corpo e restituisce posizione degli occhi e delle mani. Animazioni, contorni e ritratto vengono generati in automatico.

### Aggiungere un'arena
In `js/data/arenas.js` aggiungi una voce con il tema dei colori e la mappa a caratteri (legenda in cima al file). Ogni riga deve avere la stessa lunghezza. Servono almeno 2 punti `S`.

### Bilanciamento
Tutte le velocità, i tempi e le distanze sono in `js/core/config.js`.

---

## Requisiti e limiti
- Serve un browser con WebGL (tutti quelli recenti). Su computer molto vecchi (per esempio con Windows XP) il gioco non parte.
- Su smartphone conviene la qualità **Bassa** (impostata in automatico sui dispositivi touch).

## Licenze
Codice, personaggi, arene, suoni e musica sono originali di questo progetto. Three.js © Three.js authors, licenza MIT (`vendor/THREE-LICENSE.txt`).
