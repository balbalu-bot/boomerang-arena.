# Architettura di Boomerang Battle Arena

## 1. Principi

- **Simulazione separata dalla grafica.** `World.step(dt, intenti)` contiene tutte le regole e lavora a passo fisso (60 Hz). `World.updateView()` disegna soltanto. È la base del multiplayer: un solo dispositivo (l'host) esegue `step`, gli altri ricevono lo stato e disegnano.
- **Intenti, non tasti.** Tastiera, controller, touch e bot producono lo stesso oggetto `{mx, mz, ax, az, throwHeld, melee, dash}`. In rete viaggeranno gli intenti dei client verso l'host (pochi byte, 30-60 volte al secondo).
- **Tutto è dato.** Personaggi (`CHARACTERS`), arene (`ARENAS`) e parametri (`CFG`) sono elenchi: aggiungere contenuti non richiede di toccare il motore.
- **Nessun asset esterno.** Modelli, texture, suoni e musica sono generati dal codice: niente diritti di terzi, caricamento rapido anche con connessioni lente.

```
 Input (tastiera/pad/touch) ─┐
 Bot (ai.js) ────────────────┼─► intenti ─► World.step (60 Hz) ─► eventi ─► audio / particelle / HUD
                             │                   │
                             │                   └─► stato ─► World.updateView ─► Three.js
```

## 2. Stato delle fasi

| Fase | Contenuto | Stato |
|---|---|---|
| 1 | Motore 3D, telecamera, movimento | ✅ v0.1 |
| 2 | Combattimento classico con boomerang | ✅ v0.1 |
| 3 | Collisioni e arene interattive | ✅ parziale: acqua, lava, ghiaccio, vuoto, casse, barili, cespugli, ponti. Da fare: porte, pulsanti, botole, piattaforme mobili, nastri, teletrasporti, cannoni, zone che sprofondano |
| 4 | Personaggi e animazioni | ✅ 24 personaggi. Da fare: accessori e colori personalizzabili, abilità individuali (modalità alternativa) |
| 5 | Intelligenza artificiale | ✅ 4 livelli. Da migliorare: collaborazione di squadra |
| 6 | Multiplayer online | ✅ v0.3: stanze private, lobby con presenze, avvio quando tutti sono pronti, host autorevole su WebRTC, relè di riserva, spettatori. Da fare: migrazione dell'host, predizione locale |
| 7 | Chat vocale permanente | |
| 8 | Sicurezza e stanze private | ✅ parziale: RLS, canali privati, codici casuali a scadenza, blocco stanza, espulsione. Da fare: approvazione manuale dei nuovi ingressi, chat testuale |
| 9 | Armi aggiuntive e potenziamenti combinabili | |
| 10 | Altre modalità | |
| 11 | Editor delle mappe | |
| 12 | Ottimizzazione e pubblicazione | |

## 3. Multiplayer online (fasi 6-8) — architettura proposta

GitHub Pages pubblica solo file statici: non può eseguire un server di gioco. La soluzione gratuita è:

| Compito | Tecnologia |
|---|---|
| Accesso (anche ospite) | Supabase Auth, accesso anonimo |
| Stanze, inviti, approvazione partecipanti, espulsioni | Tabelle Postgres Supabase con Row Level Security |
| Signaling WebRTC e messaggi di lobby | Supabase Realtime, **canali privati** con autorizzazione sulla tabella dei membri |
| Dati di gioco in tempo reale | **WebRTC DataChannel** host → client (non usa il database) |
| Simulazione autorevole | Il browser dell'host esegue `World.step`; se l'host esce, il client con la connessione migliore diventa host (migrazione) |
| Voce | WebRTC audio; oltre 5-6 persone tramite SFU |

### Rete di gioco
- I client inviano solo i propri intenti all'host, con numero di sequenza.
- L'host invia istantanee compresse dello stato 20-30 volte al secondo ed eventi affidabili (eliminazioni, punteggi, inizio/fine round).
- I client mostrano gli altri giocatori **interpolati** (circa 100 ms nel passato) e il proprio personaggio con **predizione locale** e **riconciliazione** quando arriva lo stato dell'host.
- Canale DataChannel non affidabile e non ordinato per le istantanee, canale affidabile per gli eventi.

### Sicurezza (fase 8) — punti fermi
- Nel repository pubblico va **solo** la chiave pubblica `anon` di Supabase. Mai la `service_role`, mai la password del database, mai segreti TURN permanenti.
- Stanze solo private, nessun elenco pubblico; ingresso con token casuale a scadenza; approvazione manuale opzionale da parte dell'host; stanza bloccabile.
- RLS su tutte le tabelle: si legge e si scrive solo nelle stanze di cui si è membri approvati.
- I canali Realtime privati verificano l'appartenenza alla stanza prima di permettere chat, signaling e dati di gioco.
- Chat testuale: testo inserito sempre con `textContent` (mai HTML), lunghezza massima, limite di messaggi al secondo, blocco utente.
- Nessuna registrazione audio, nessuna webcam, nessuna posizione geografica, nessun dato personale oltre al soprannome.
- Le credenziali TURN temporanee vanno generate da una **Supabase Edge Function** (lato server), che conosce il segreto senza esporlo nel codice pubblico.

### Voce (fase 7)
- Microfono spento all'ingresso; si accende solo con un gesto del giocatore e resta acceso finché non lo spegne o lascia la stanza.
- Cancellazione eco, soppressione rumore e controllo automatico del guadagno tramite i vincoli standard di `getUserMedia`.
- La connessione vocale è legata alla **stanza**, non alla partita: passando da lobby a partita o cambiando arena non si interrompe.
- Con molti giocatori una rete "a maglia" (ognuno collegato a tutti) pesa troppo sui telefoni: per stanze grandi si usa una SFU. Visto che LiveKit è già in uso nel progetto D&D Virtual Adventure, è l'opzione più rapida da riutilizzare (con un progetto separato).
- STUN pubblici gratuiti bastano per molte reti domestiche; per reti mobili e scolastiche serve TURN. Costi e limiti gratuiti dei servizi TURN e SFU cambiano nel tempo: vanno verificati al momento della fase 7 e riportati nel README.

## 4. Prestazioni
- Arene: pavimenti, muri e basi sono fusi in poche geometrie (pochi draw call).
- Particelle: `InstancedMesh`, un draw call per tipo.
- Qualità **Bassa**: niente ombre, risoluzione 1×, metà particelle. **Media**: ombre 1024, risoluzione fino a 1,5×. **Alta**: ombre 2048, risoluzione fino a 2×.
- Il passo fisso della simulazione rende il gioco uguale anche su schermi a 30, 60 o 120 Hz.

## 5. Implementazione online (v0.3)

- `js/net/online.js` — `OnlineSession`: accesso anonimo Supabase, `create_room` / `join_room`, canale privato `room:<id>` con Presence (soprannome, personaggio, pronto, impostazioni dell'host), segnalazione WebRTC. L'host apre un `RTCPeerConnection` verso ogni giocatore con due DataChannel: `u` (non affidabile, istantanee) e `r` (affidabile, eventi). Se il collegamento diretto non si apre in 12 s si passa al relè tramite Supabase Broadcast a frequenza ridotta.
- `js/net/netgame.js` — `NetHost` (sull'host: comandi in ingresso, istantanee a 20 Hz, eventi) e `ClientMatch` (sui client: nessuna simulazione, interpolazione con ~100 ms di ritardo).
- Perché non tutto su Supabase Realtime: sul piano gratuito ogni messaggio Broadcast conta una volta in invio più una per ogni destinatario, con limiti di 100 messaggi/s e 2 milioni al mese: una partita a 4 a 20 aggiornamenti/s li esaurirebbe in poche ore.
- Prova locale senza Supabase: aprire due schede con `?locale=1` (stesso browser): segnalazione tramite `BroadcastChannel`.
- TURN: aggiungere a `ICE_SERVERS` una voce `{ urls: 'turn:…', username: '…', credential: '…' }`. Le credenziali TURN in un sito pubblico sono visibili a tutti: usare solo credenziali temporanee generate da una Supabase Edge Function, oppure un servizio con limiti di consumo.
