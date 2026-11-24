# Boomerang Battle Arena

Party game 3D a visuale isometrica: lancia il boomerang, richiamalo, devia i colpi e spingi gli avversari nella lava. Un colpo e sei fuori.

Funziona direttamente nel browser (Chrome, Edge, Firefox, Safari) su Windows, macOS, tablet e smartphone. Nessuna installazione, nessuna pubblicità, nessun dato raccolto.

> **Versione 0.1 — fasi 1-5 della roadmap.** Si gioca in locale sullo stesso dispositivo: tastiera e mouse, fino a 8 controller e bot. Il multiplayer online, la chat vocale e le stanze private arrivano nelle fasi 6-8 (vedi `docs/ARCHITETTURA.md`).

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

Il browser vede un controller solo dopo che hai **premuto un suo tasto** con la pagina aperta. Su iPhone/iPad servono iOS 13 o successivo e Safari.

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
vendor/                 Three.js r170 (licenza MIT) incluso localmente
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
- In questa versione non c'è traffico di rete: tutto avviene sul dispositivo.

## Licenze
Codice, personaggi, arene, suoni e musica sono originali di questo progetto. Three.js © Three.js authors, licenza MIT (`vendor/THREE-LICENSE.txt`).
