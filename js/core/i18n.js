import { settings } from './settings.js';

const DICT = {
  it: {
    title: 'Boomerang Battle Arena',
    subtitle: 'Lancia, richiama, schiva!',
    playOnline: 'Gioca online',
    padTitle: 'Controller',
    padHint: 'Se il joystick non risponde ai tasti giusti, configuralo: premi i tasti che ti vengono chiesti.',
    padConfig: 'Configura controller',
    pwNoPad: 'Nessun controller trovato',
    pwPressAny: 'Collega il joystick e premi un suo tasto qualsiasi',
    pw_throw: 'Premi il tasto per LANCIARE (servirà anche per confermare nei menu)',
    pw_melee: 'Premi il tasto per il COLPO e il RICHIAMO',
    pw_dash: 'Premi il tasto per lo SCATTO (servirà anche per tornare indietro nei menu)',
    pw_start: 'Premi il tasto per la PAUSA / START',
    pw_rx: 'Spingi la LEVETTA DESTRA verso destra',
    pwSkipHint: 'Se il joystick non ha la levetta destra premi "Salta": mirerai nella direzione in cui ti muovi.',
    pwSkip: 'Salta',
    pwReset: 'Ripristina tasti originali',
    pwDone: 'Fatto! Controller configurato.',
    radio: 'Radio',
    microphone: 'Microfono',
    pushToTalk: 'Premi per parlare (tieni premuto V o il tasto Select del controller)',
    pttHint: 'Senza "premi per parlare", quando il microfono è acceso gli altri ti sentono sempre. M accende e spegne il microfono.',
    voiceNote: "La radio funziona solo tra i giocatori della stanza e non viene registrata.",
    close: 'Chiudi',
    micOff: 'Microfono spento',
    micOnTxt: 'Microfono acceso',
    pttWait: 'Tieni premuto V per parlare',
    voiceDenied: 'Microfono bloccato dal browser: consenti l\'accesso dal lucchetto vicino all\'indirizzo.',
    voiceNoMic: 'Nessun microfono trovato.',
    speakersOff: 'Audio degli altri spento',
    voiceAlone: 'Radio: nessun altro nella stanza',
    voicePartial: 'Radio: alcuni giocatori non raggiungibili',
    voiceConnecting: 'Radio: collegamento…',
    defaultMic: 'Predefinito',
    playLocal: 'Gioca su questo dispositivo',
    nickname: 'Il tuo soprannome',
    createRoom: 'Crea una stanza',
    orJoin: '— oppure —',
    roomCode: 'Codice della stanza',
    joinRoom: 'Entra nella stanza',
    room: 'Stanza',
    copyLink: 'Copia link',
    copied: 'Link copiato!',
    bots: 'Bot',
    lockRoom: 'Chiudi la stanza a nuovi ingressi',
    leaveRoom: 'Esci dalla stanza',
    startNow: 'Avvia ora',
    imReady: 'Pronto!',
    notReady: 'Non sono pronto',
    host: 'host',
    you: 'tu',
    waitingReady: 'Si parte quando tutti sono pronti',
    needTwo: 'Serve almeno un altro giocatore: manda il link!',
    connecting: 'Collegamento in corso…',
    direct: 'diretta',
    relay: 'indiretta',
    starting: 'Si parte!',
    hostLeft: "L'host ha chiuso la stanza.",
    kicked: "Sei stato tolto dalla stanza dall'host.",
    backToRoom: 'Torna alla stanza',
    waitHost: "In attesa dell'host…",
    nickNeeded: 'Scrivi un soprannome (max 16 caratteri).',
    codeNeeded: 'Scrivi il codice della stanza.',
    working: 'Un momento…',
    errGeneric: 'Non riesco a collegarmi. Controlla la connessione e riprova.',
    safetyNote: 'Le stanze sono private: entra solo chi ha il codice. Non scrivere mai il tuo nome vero, indirizzo o numero di telefono. Da usare con la presenza di un adulto.',
    noConfig: "<b>Gioco online non ancora configurato.</b><br>Chi gestisce il sito deve inserire indirizzo e chiave pubblica di Supabase nel file <code>js/net/net-config.js</code> (istruzioni nel README).",
    spectating: 'Stai guardando la partita: entrerai dalla prossima.',

    play: 'Gioca',
    characters: 'Personaggi',
    howto: 'Come si gioca',
    settings: 'Impostazioni',
    credits: 'Crediti',
    back: 'Indietro',
    start: 'Inizia partita',
    setupTitle: 'Prepara la partita',
    players: 'Giocatori',
    keyboard: 'Tastiera e mouse',
    touch: 'Touch',
    controller: 'Controller',
    bot: 'Bot',
    addBot: '+ Bot',
    remove: 'Rimuovi',
    joinHint: 'Collega un controller e premi A / ✕ per entrare',
    mode: 'Modalità',
    modeClassic: 'Classica (un colpo)',
    modeTeams: 'Squadre',
    botLevel: 'Difficoltà bot',
    facile: 'Facile', normale: 'Normale', difficile: 'Difficile', esperto: 'Esperto',
    roundsToWin: 'Round per vincere',
    arena: 'Arena',
    randomArena: 'Casuale a ogni round',
    team: 'Squadra',
    teamRed: 'Rossi', teamBlue: 'Blu',
    quality: 'Qualità grafica',
    bassa: 'Bassa', media: 'Media', alta: 'Alta',
    musicVol: 'Volume musica',
    sfxVol: 'Volume effetti',
    language: 'Lingua',
    showAim: 'Mostra linea di mira',
    screenShake: 'Scuotimento schermo',
    keysTitle: 'Tasti (clicca e premi un tasto)',
    resetKeys: 'Ripristina tasti',
    k_up: 'Su', k_down: 'Giù', k_left: 'Sinistra', k_right: 'Destra',
    k_dash: 'Scatto', k_melee: 'Corpo a corpo / richiamo', k_interact: 'Interazione', k_special: 'Abilità speciale',
    k_throwKey: 'Lancio (alternativo al mouse)', k_pause: 'Menu / pausa', k_mic: 'Microfono acceso/spento', k_ptt: 'Premi per parlare',
    pressKey: 'Premi un tasto…',
    paused: 'Pausa',
    resume: 'Riprendi',
    quit: 'Esci al menu',
    round: 'Round',
    fight: 'VIA!',
    wins: 'vince il round!',
    teamWins: 'vincono il round!',
    draw: 'Pareggio!',
    matchWinner: 'Campione!',
    rematch: 'Rivincita',
    toMenu: 'Menu principale',
    timeUp: 'Tempo scaduto',
    ready: 'Pronto',
    howtoText: `
      <h3>Obiettivo</h3>
      <p>Un colpo e sei fuori. L'ultimo rimasto in piedi vince il round. Vince la partita chi conquista per primo i round richiesti.</p>
      <h3>Tastiera e mouse</h3>
      <ul>
        <li><b>WASD</b> muoversi · <b>Mouse</b> mirare</li>
        <li><b>Tasto sinistro</b> tieni premuto per caricare, rilascia per lanciare</li>
        <li><b>Tasto destro</b> colpo corpo a corpo (devia i boomerang) · se l'arma è in volo la <b>richiama</b></li>
        <li><b>Spazio</b> scatto (spinge gli avversari: buttali in acqua o nella lava!)</li>
        <li><b>ESC</b> pausa</li>
      </ul>
      <h3>Controller (Xbox, PlayStation, Switch Pro, Bluetooth)</h3>
      <ul>
        <li><b>Levetta sinistra</b> muoversi · <b>levetta destra</b> mirare</li>
        <li><b>RT / R2 / ZR</b> oppure <b>A / ✕ / B(Switch)</b> lancio (tieni premuto per caricare)</li>
        <li><b>X / □ / Y(Switch)</b> oppure <b>RB / R1 / R</b> corpo a corpo e richiamo</li>
        <li><b>LT / L2 / ZL</b> oppure <b>B / ○ / A(Switch)</b> scatto</li>
        <li><b>Start / Options / +</b> pausa · croce direzionale per i menu</li>
      </ul>
      <h3>Touch</h3>
      <p>Joystick sinistro per muoversi, joystick destro per mirare: trascina per caricare e rilascia per lanciare. Pulsanti per scatto e corpo a corpo.</p>
      <h3>Trucchi</h3>
      <ul>
        <li>Il boomerang colpisce anche al ritorno: richiamalo quando un avversario è tra te e l'arma.</li>
        <li>Un colpo corpo a corpo al momento giusto rispedisce indietro il boomerang nemico.</li>
        <li>Se perdi l'arma puoi raccogliere qualsiasi boomerang a terra.</li>
        <li>Nascondersi nei cespugli confonde i bot. I barili esplodono!</li>
      </ul>`,
    creditsText: `
      <p><b>Boomerang Battle Arena</b> — progetto originale.</p>
      <p>Personaggi, arene, effetti sonori e musica sono generati dal codice del gioco: nessun asset di terze parti.</p>
      <p>Grafica 3D: <a href="https://threejs.org" target="_blank" rel="noopener">Three.js</a> (licenza MIT).</p>
      <p>Ispirato al genere dei party game arena con boomerang.</p>`,
    noWebGL: 'Il tuo browser o dispositivo non supporta WebGL: il gioco non può partire. Prova un browser aggiornato (Chrome, Edge, Firefox, Safari).',
    rotateHint: 'Ruota il dispositivo in orizzontale',
  },
  en: {
    title: 'Boomerang Battle Arena',
    subtitle: 'Throw, recall, dodge!',
    playOnline: 'Play online',
    padTitle: 'Controller',
    padHint: 'If your gamepad buttons do the wrong thing, configure it by pressing the requested buttons.',
    padConfig: 'Configure controller',
    pwNoPad: 'No controller found',
    pwPressAny: 'Connect the gamepad and press any button',
    pw_throw: 'Press the THROW button (also confirms in menus)',
    pw_melee: 'Press the MELEE / RECALL button',
    pw_dash: 'Press the DASH button (also goes back in menus)',
    pw_start: 'Press the PAUSE / START button',
    pw_rx: 'Push the RIGHT STICK to the right',
    pwSkipHint: 'No right stick? Press "Skip": you will aim where you move.',
    pwSkip: 'Skip',
    pwReset: 'Restore original buttons',
    pwDone: 'Done! Controller configured.',
    radio: 'Radio',
    microphone: 'Microphone',
    pushToTalk: 'Push to talk (hold V or the controller Select button)',
    pttHint: 'Without push to talk, others hear you whenever the mic is on. M turns the mic on and off.',
    voiceNote: 'Voice works only between players in the room and is never recorded.',
    close: 'Close',
    micOff: 'Mic off',
    micOnTxt: 'Mic on',
    pttWait: 'Hold V to talk',
    voiceDenied: 'The browser blocked the microphone: allow it from the padlock next to the address.',
    voiceNoMic: 'No microphone found.',
    speakersOff: 'Others muted',
    voiceAlone: 'Radio: nobody else in the room',
    voicePartial: 'Radio: some players unreachable',
    voiceConnecting: 'Radio: connecting…',
    defaultMic: 'Default',
    playLocal: 'Play on this device',
    nickname: 'Your nickname',
    createRoom: 'Create a room',
    orJoin: '— or —',
    roomCode: 'Room code',
    joinRoom: 'Join room',
    room: 'Room',
    copyLink: 'Copy link',
    copied: 'Link copied!',
    bots: 'Bots',
    lockRoom: 'Lock the room',
    leaveRoom: 'Leave room',
    startNow: 'Start now',
    imReady: 'Ready!',
    notReady: 'Not ready',
    host: 'host',
    you: 'you',
    waitingReady: 'The match starts when everyone is ready',
    needTwo: 'You need at least one more player: send the link!',
    connecting: 'Connecting…',
    direct: 'direct',
    relay: 'relayed',
    starting: "Let's go!",
    hostLeft: 'The host closed the room.',
    kicked: 'The host removed you from the room.',
    backToRoom: 'Back to room',
    waitHost: 'Waiting for the host…',
    nickNeeded: 'Type a nickname (max 16 characters).',
    codeNeeded: 'Type the room code.',
    working: 'One moment…',
    errGeneric: 'Cannot connect. Check your connection and try again.',
    safetyNote: 'Rooms are private: only people with the code can join. Never type your real name, address or phone number. Play with an adult around.',
    noConfig: '<b>Online play is not configured yet.</b><br>The site owner must add the Supabase URL and public key in <code>js/net/net-config.js</code> (see README).',
    spectating: 'You are watching: you will join from the next match.',

    play: 'Play',
    characters: 'Characters',
    howto: 'How to play',
    settings: 'Settings',
    credits: 'Credits',
    back: 'Back',
    start: 'Start match',
    setupTitle: 'Match setup',
    players: 'Players',
    keyboard: 'Keyboard & mouse',
    touch: 'Touch',
    controller: 'Controller',
    bot: 'Bot',
    addBot: '+ Bot',
    remove: 'Remove',
    joinHint: 'Connect a controller and press A / ✕ to join',
    mode: 'Mode',
    modeClassic: 'Classic (one hit)',
    modeTeams: 'Teams',
    botLevel: 'Bot difficulty',
    facile: 'Easy', normale: 'Normal', difficile: 'Hard', esperto: 'Expert',
    roundsToWin: 'Rounds to win',
    arena: 'Arena',
    randomArena: 'Random each round',
    team: 'Team',
    teamRed: 'Red', teamBlue: 'Blue',
    quality: 'Graphics quality',
    bassa: 'Low', media: 'Medium', alta: 'High',
    musicVol: 'Music volume',
    sfxVol: 'Effects volume',
    language: 'Language',
    showAim: 'Show aim line',
    screenShake: 'Screen shake',
    keysTitle: 'Keys (click, then press a key)',
    resetKeys: 'Reset keys',
    k_up: 'Up', k_down: 'Down', k_left: 'Left', k_right: 'Right',
    k_dash: 'Dash', k_melee: 'Melee / recall', k_interact: 'Interact', k_special: 'Special ability',
    k_throwKey: 'Throw (mouse alternative)', k_pause: 'Menu / pause', k_mic: 'Mic on/off', k_ptt: 'Push to talk',
    pressKey: 'Press a key…',
    paused: 'Paused',
    resume: 'Resume',
    quit: 'Quit to menu',
    round: 'Round',
    fight: 'GO!',
    wins: 'wins the round!',
    teamWins: 'win the round!',
    draw: 'Draw!',
    matchWinner: 'Champion!',
    rematch: 'Rematch',
    toMenu: 'Main menu',
    timeUp: 'Time up',
    ready: 'Ready',
    howtoText: `
      <h3>Goal</h3>
      <p>One hit and you're out. Last one standing wins the round. First to the required rounds wins the match.</p>
      <h3>Keyboard & mouse</h3>
      <ul>
        <li><b>WASD</b> move · <b>Mouse</b> aim</li>
        <li><b>Left button</b> hold to charge, release to throw</li>
        <li><b>Right button</b> melee (deflects boomerangs) · <b>recalls</b> your weapon if it is flying</li>
        <li><b>Space</b> dash (pushes opponents into water or lava!)</li>
        <li><b>ESC</b> pause</li>
      </ul>
      <h3>Controller (Xbox, PlayStation, Switch Pro, Bluetooth)</h3>
      <ul>
        <li><b>Left stick</b> move · <b>right stick</b> aim</li>
        <li><b>RT / R2 / ZR</b> or <b>A / ✕ / B(Switch)</b> throw (hold to charge)</li>
        <li><b>X / □ / Y(Switch)</b> or <b>RB / R1 / R</b> melee and recall</li>
        <li><b>LT / L2 / ZL</b> or <b>B / ○ / A(Switch)</b> dash</li>
        <li><b>Start / Options / +</b> pause · D-pad for menus</li>
      </ul>
      <h3>Touch</h3>
      <p>Left stick to move, right stick to aim: drag to charge, release to throw. Buttons for dash and melee.</p>
      <h3>Tips</h3>
      <ul>
        <li>Boomerangs hit on the way back too: recall when an opponent is between you and your weapon.</li>
        <li>A well-timed melee sends an enemy boomerang back.</li>
        <li>Lost your weapon? Pick up any boomerang lying on the ground.</li>
        <li>Hiding in bushes confuses bots. Barrels explode!</li>
      </ul>`,
    creditsText: `
      <p><b>Boomerang Battle Arena</b> — original project.</p>
      <p>Characters, arenas, sound effects and music are generated by the game code: no third-party assets.</p>
      <p>3D graphics: <a href="https://threejs.org" target="_blank" rel="noopener">Three.js</a> (MIT license).</p>
      <p>Inspired by the boomerang arena party-game genre.</p>`,
    noWebGL: 'Your browser or device does not support WebGL. Try an up-to-date browser (Chrome, Edge, Firefox, Safari).',
    rotateHint: 'Rotate your device to landscape',
  },
};

export function t(key) {
  const d = DICT[settings.lang] || DICT.it;
  return d[key] ?? DICT.it[key] ?? key;
}

export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  document.documentElement.lang = settings.lang;
}
