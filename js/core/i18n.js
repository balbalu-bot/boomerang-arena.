import { settings } from './settings.js';

const DICT = {
  it: {
    title: 'Boomerang Battle Arena',
    subtitle: 'Lancia, richiama, schiva!',
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
    k_throwKey: 'Lancio (alternativo al mouse)', k_pause: 'Menu / pausa',
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
    k_throwKey: 'Throw (mouse alternative)', k_pause: 'Menu / pause',
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
