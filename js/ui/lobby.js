// Schermate "Gioca online" e stanza: crea/entra, lobby con presenze, avvio automatico quando tutti sono pronti.

import { OnlineSession } from '../net/online.js';
import { Voice } from '../net/voice.js';
import { NetHost, ClientMatch } from '../net/netgame.js';
import { netConfigured } from '../net/net-config.js';
import { Match } from '../game/match.js';
import { CHARACTERS } from '../game/characters.js';
import { ARENAS } from '../data/arenas.js';
import { settings } from '../core/settings.js';
import { t } from '../core/i18n.js';
import { sfx } from '../core/audio.js';

const $ = s => document.querySelector(s);
const COLORS = ['#ff4d6d', '#4dabff', '#5bd96b', '#ffc93c', '#b57cff', '#ff8a3d', '#3de0d0', '#ff7ad9'];

export function setupOnline(ctx) {
  const S = new OnlineSession();
  const voice = new Voice(S);
  window.__voice = voice;
  let netHost = null, clientMatch = null, inGame = false, lastCfg = null;
  let hostMissingSince = 0, startLock = false;
  const roomOpts = ['#ro-mode', '#ro-rounds', '#ro-bots', '#ro-level', '#ro-arena'];

  // ---------- schermata iniziale ----------
  const msg = (text, ok = false) => { const m = $('#online-msg'); m.textContent = text || ''; m.classList.toggle('ok', ok); };
  function onShowOnline() {
    const conf = netConfigured();
    $('#online-noconf').style.display = conf ? 'none' : 'block';
    $('#online-form').style.opacity = conf ? 1 : 0.4;
    $('#online-form').querySelectorAll('input,button').forEach(e => e.disabled = !conf);
    try { $('#nick').value ||= localStorage.getItem('bba-nick') || ''; } catch { }
    msg('');
  }
  const cleanNick = () => $('#nick').value.replace(/[<>&"'`]/g, '').trim().slice(0, 16);
  const errText = e => {
    const m = String(e?.message || e || '');
    if (/inesistente|scaduta|chiusa|piena|soprannome/.test(m)) return m.charAt(0).toUpperCase() + m.slice(1) + '.';
    if (/anonymous/i.test(m)) return 'Supabase: accesso anonimo disattivato (vedi README, passo 3).';
    return t('errGeneric') + (m ? ` (${m.slice(0, 80)})` : '');
  };

  async function doEnter(fn) {
    const nick = cleanNick();
    if (!nick) { msg(t('nickNeeded')); return; }
    try { localStorage.setItem('bba-nick', nick); } catch { }
    msg(t('working'), true);
    $('#btn-create').disabled = $('#btn-join').disabled = true;
    try {
      ctx.unlockAudio();
      await fn(nick);
      enterRoomScreen();
    } catch (e) { console.warn(e); msg(errText(e)); await S.leave().catch(() => {}); }
    finally { $('#btn-create').disabled = $('#btn-join').disabled = false; }
  }
  $('#btn-create').onclick = () => doEnter(nick => S.create(nick));
  $('#btn-join').onclick = () => {
    const code = $('#join-code').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) { msg(t('codeNeeded')); return; }
    doEnter(nick => S.join(code, nick));
  };

  // ---------- stanza ----------
  function enterRoomScreen() {
    const link = location.origin + location.pathname + '?stanza=' + S.room.code + (S.local ? '&locale=1' : '');
    $('#room-code').textContent = S.room.code;
    $('#room-link').value = link;
    $('#ro-arena').innerHTML = `<option value="random">${t('randomArena')}</option>` + ARENAS.map(a => `<option value="${a.id}">${a.name[settings.lang]}</option>`).join('');
    let c = -1; try { const v = localStorage.getItem('bba-char'); if (v !== null) c = +v; } catch { }
    S.setMyState({ char: c >= 0 && c < CHARACTERS.length ? c : Math.floor(Math.random() * CHARACTERS.length) });
    if (S.isHost) pushCfg();
    ctx.show('room');
    renderRoom();
    updateVoiceUI();
  }

  $('#btn-copy').onclick = async () => {
    const v = $('#room-link').value;
    try { await navigator.clipboard.writeText(v); } catch { $('#room-link').select(); document.execCommand?.('copy'); }
    $('#room-status').textContent = t('copied');
  };

  function readCfg() {
    return { mode: $('#ro-mode').value, rounds: +$('#ro-rounds').value, bots: +$('#ro-bots').value, level: $('#ro-level').value, arena: $('#ro-arena').value };
  }
  function pushCfg() { S.setMyState({ cfg: readCfg() }); }
  roomOpts.forEach(sel => $(sel).addEventListener('change', () => { if (S.isHost) { pushCfg(); renderRoom(); } }));
  $('#ro-lock').onchange = e => S.setLocked(e.target.checked);

  function sortedMembers() {
    return Object.entries(S.members).map(([uid, st]) => ({ uid, ...st })).sort((a, b) => (b.host - a.host) || (a.t - b.t));
  }

  function renderRoom() {
    if (!S.room) return;
    const box = $('#room-members'); box.innerHTML = '';
    const list = sortedMembers(), hostState = S.members[S.hostId];
    const cfg = hostState?.cfg || readCfg();
    const teams = cfg.mode === 'teams';
    list.forEach((m, i) => {
      const me = m.uid === S.uid, c = CHARACTERS[m.char] || CHARACTERS[0];
      const d = document.createElement('div'); d.className = 'slot' + (me ? ' me' : '') + (voice.speaking.has(m.uid) ? ' speak' : '');
      d.dataset.uid = m.uid;
      d.style.setProperty('--c', teams ? (i % 2 ? '#4dabff' : '#ff4d6d') : COLORS[i % 8]);
      d.innerHTML = `<span class="who"></span><div class="hint dev"></div>
        ${S.isHost && !me ? '<button class="btn x" title="' + t('remove') + '">✕</button>' : ''}
        <img alt="">
        <div class="pick">${me ? '<button class="btn arrow prev">◀</button>' : ''}<b></b>${me ? '<button class="btn arrow next">▶</button>' : ''}</div>
        <span class="badge ${m.ready ? 'ready' : 'wait'}">${m.ready ? t('ready') : '…'}</span>
        <div class="net"></div>`;
      d.querySelector('.who').textContent = String(m.nick || '?').slice(0, 16);
      d.querySelector('.dev').textContent = [m.host ? t('host') : '', me ? t('you') : ''].filter(Boolean).join(' · ');
      d.querySelector('img').src = window.CHAR_THUMBS?.[c.id] || '';
      d.querySelector('.pick b').textContent = c.name[settings.lang];
      if (!me) {
        const st = S.isHost ? S.peerStatus(m.uid) : (m.uid === S.hostId ? S.peerStatus(m.uid) : '');
        d.querySelector('.net').textContent = st === 'direct' ? '● ' + t('direct') : st === 'relay' ? '◐ ' + t('relay') : st === 'connecting' ? '○ ' + t('connecting') : '';
      }
      if (me) {
        const step = dlt => { const n = (m.char + dlt + CHARACTERS.length) % CHARACTERS.length; S.setMyState({ char: n }); try { localStorage.setItem('bba-char', n); } catch { } sfx('ui'); };
        d.querySelector('.prev').onclick = () => step(-1);
        d.querySelector('.next').onclick = () => step(1);
      }
      const x = d.querySelector('.x'); if (x) x.onclick = () => S.kick(m.uid);
      box.appendChild(d);
    });
    // opzioni: modificabili solo dall'host
    $('#room-opts').style.display = S.isHost ? '' : 'none';
    $('#btn-force').style.display = S.isHost ? '' : 'none';
    const arenaName = cfg.arena === 'random' ? t('randomArena') : (ARENAS.find(a => a.id === cfg.arena)?.name[settings.lang] || '');
    $('#room-summary').textContent = S.isHost ? '' : `${t('mode')}: ${t(cfg.mode === 'teams' ? 'modeTeams' : 'modeClassic')} · ${t('roundsToWin')}: ${cfg.rounds} · ${t('bots')}: ${cfg.bots} (${t(cfg.level)}) · ${t('arena')}: ${arenaName}`;
    const meState = S.members[S.uid] || S.myState || {};
    const rb = $('#btn-ready');
    rb.textContent = meState.ready ? t('notReady') : t('imReady');
    rb.classList.toggle('on', !!meState.ready);
    const humans = list.length, ready = list.filter(m => m.ready).length;
    $('#room-status').textContent = humans < 2 ? t('needTwo') : `${t('waitingReady')} (${ready}/${humans})`;
  }

  $('#btn-ready').onclick = () => { const r = !(S.myState?.ready); S.setMyState({ ready: r }); sfx(r ? 'join' : 'ui'); setTimeout(renderRoom, 150); };
  $('#btn-force').onclick = () => hostStart(true);
  $('#btn-leave').onclick = () => leaveRoom();

  S.on('members', () => {
    if (!inGame && document.querySelector('#scr-room.active')) renderRoom();
    // controllo uscita dell'host
    if (S.room && !S.isHost && S.hostId) {
      if (!S.members[S.hostId]) { if (!hostMissingSince) hostMissingSince = performance.now(); }
      else hostMissingSince = 0;
    }
  });
  S.on('peer', p => {
    if (!inGame && document.querySelector('#scr-room.active')) renderRoom();
    // chi entra a partita iniziata la guarda come spettatore
    if (S.isHost && inGame && lastCfg && ctx.getMatch()) {
      const m = ctx.getMatch();
      S.sendTo(p.uid, { t: 'start', cfg: lastCfg }, true);
      S.sendTo(p.uid, { t: 'round', round: m.round, arena: m.world.arena.def.id }, true);
      S.sendTo(p.uid, { t: 'wins', w: [...m.wins.entries()] }, true);
    }
  });
  S.on('left', uid => { if (S.isHost && inGame) ctx.getMatch()?.playerLeft?.('u_' + uid); });

  // ---------- avvio partita ----------
  function canAutoStart() {
    const list = sortedMembers();
    if (list.length < 2 || !list.every(m => m.ready)) return false;
    return list.every(m => m.uid === S.uid || S.peerStatus(m.uid) === 'direct' || S.peerStatus(m.uid) === 'relay');
  }

  function hostStart(force = false) {
    if (!S.isHost || inGame || startLock) return;
    const list = sortedMembers();
    const cfg = readCfg();
    if (list.length < 2 && cfg.bots === 0) { $('#room-status').textContent = t('needTwo'); return; }
    if (force) {
      const notConn = list.filter(m => m.uid !== S.uid && S.peerStatus(m.uid) === 'connecting');
      if (notConn.length) { $('#room-status').textContent = t('connecting'); return; }
    }
    startLock = true;
    const teams = cfg.mode === 'teams';
    const used = new Set();
    const players = list.map((m, i) => {
      used.add(m.char);
      return { id: 'u_' + m.uid, name: String(m.nick || '?').slice(0, 16), charId: (CHARACTERS[m.char] || CHARACTERS[0]).id, team: teams ? i % 2 : i, uid: m.uid };
    });
    for (let b = 0; b < cfg.bots && players.length < 8; b++) {
      let ch = Math.floor(Math.random() * CHARACTERS.length); while (used.has(ch) && used.size < CHARACTERS.length) ch = (ch + 1) % CHARACTERS.length; used.add(ch);
      players.push({ id: 'b' + b, name: `${t('bot')} ${b + 1}`, charId: CHARACTERS[ch].id, bot: true, level: cfg.level, team: teams ? players.length % 2 : players.length });
    }
    const base = { mode: cfg.mode, roundsToWin: cfg.rounds, arena: cfg.arena, botLevel: cfg.level };
    lastCfg = { ...base, players: players.map(({ uid, ...p }) => p) };
    S.sendAll({ t: 'start', cfg: lastCfg }, true);
    const localDev = ctx.input.lastDevice || 'kb';
    const hostCfg = { ...base, players: players.map(p => p.bot ? p : { ...p, device: p.uid === S.uid ? localDev : 'net:' + p.uid, local: p.uid === S.uid }) };
    netHost = new NetHost(S, ctx.input);
    S.setMyState({ ready: false });
    inGame = true;
    ctx.enterGame(() => new Match({ view: ctx.view, fx: ctx.fx, input: ctx.input, config: hostCfg, net: netHost }), true);
    setTimeout(() => { startLock = false; }, 1500);
  }

  function clientStart(cfg) {
    if (!cfg || !Array.isArray(cfg.players)) return;
    const myId = 'u_' + S.uid;
    const players = cfg.players.slice(0, 8).map(p => ({
      id: String(p.id), name: String(p.name || '?').slice(0, 16), charId: String(p.charId), team: +p.team || 0,
      bot: !!p.bot, local: p.id === myId, device: p.id === myId ? 'me' : 'remote',
    }));
    const config = { mode: cfg.mode === 'teams' ? 'teams' : 'classic', roundsToWin: Math.max(1, Math.min(10, +cfg.roundsToWin || 5)), arena: 'random', botLevel: 'normale', players };
    S.setMyState({ ready: false });
    inGame = true;
    ctx.enterGame(() => { clientMatch = new ClientMatch({ view: ctx.view, fx: ctx.fx, input: ctx.input, config, session: S, myId }); return clientMatch; }, true);
    if (!players.some(p => p.local)) clientMatch.showBanner(t('spectating'), '', 'stay');
  }

  S.on('data', (from, m) => {
    if (S.isHost) { netHost?.onData(from, m); return; }
    if (m.t === 'start') { if (inGame) backToRoom(); clientStart(m.cfg); return; }
    if (m.t === 'lobby') { backToRoom(); return; }
    if (m.t === 'kick') { leaveRoom(t('kicked')); return; }
    clientMatch?.onMsg(m);
  });

  function backToRoom() {
    inGame = false; clientMatch = null; netHost = null;
    ctx.leaveGame('room');
    renderRoom();
  }

  async function leaveRoom(reason = '') {
    voice.close();
    if (inGame) { inGame = false; clientMatch = null; netHost = null; ctx.leaveGame('online'); }
    await S.leave();
    ctx.show('online');
    msg(reason);
  }

  // controllo periodico: avvio automatico e uscita dell'host
  setInterval(() => {
    if (!S.room) return;
    if (S.isHost && !inGame && canAutoStart()) { $('#room-status').textContent = t('starting'); hostStart(); }
    if (!S.isHost && hostMissingSince && performance.now() - hostMissingSince > 5000) { hostMissingSince = 0; leaveRoom(t('hostLeft')); }
  }, 700);
  setInterval(() => { if (S.room && !inGame && document.querySelector('#scr-room.active')) renderRoom(); }, 2000);

  // collegamento da link d'invito
  const q = new URLSearchParams(location.search).get('stanza');
  if (q) { $('#join-code').value = q.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); }

  // ---------- RADIO ----------
  const vbar = $('#voicebar');
  function updateVoiceUI() {
    vbar.classList.toggle('show', !!S.room);
    if (!S.room) return;
    const mic = $('#vb-mic');
    mic.classList.toggle('off', !voice.micOn);
    mic.classList.toggle('live', voice.transmitting);
    $('#vb-spk').classList.toggle('off', !voice.prefs.speakers);
    const st = voice.status();
    $('#vb-dot').className = 'vb-dot ' + st;
    let txt = voice.error === 'denied' ? t('voiceDenied') : voice.error === 'nomic' ? t('voiceNoMic')
      : !voice.micOn ? t('micOff') : voice.prefs.ptt && !voice.pttDown ? t('pttWait') : t('micOnTxt');
    if (!voice.prefs.speakers) txt += ' · ' + t('speakersOff');
    if (st === 'alone') txt = t('voiceAlone'); else if (st === 'partial') txt += ' · ' + t('voicePartial'); else if (st === 'connecting') txt += ' · ' + t('voiceConnecting');
    $('#vb-txt').textContent = txt;
    // chi parla: schede della stanza, etichette in partita, pannello radio
    document.querySelectorAll('#room-members .slot').forEach(el => el.classList.toggle('speak', voice.speaking.has(el.dataset.uid)));
    const m = ctx.getMatch();
    if (m?.labelEls) for (const [id, el] of m.labelEls) el.classList.toggle('speak', id.startsWith('u_') && voice.speaking.has(id.slice(2)));
    document.querySelectorAll('#vp-people .vp-person').forEach(el => el.classList.toggle('speak', voice.speaking.has(el.dataset.uid)));
  }
  voice.onChange(updateVoiceUI);
  S.on('members', updateVoiceUI);

  $('#vb-mic').onclick = () => { ctx.unlockAudio(); voice.setMic(!voice.micOn); };
  $('#vb-spk').onclick = () => voice.setSpeakers(!voice.prefs.speakers);
  $('#vb-set').onclick = () => openVoicePanel();
  $('#vp-close').onclick = () => $('#voicepanel').classList.remove('show');
  $('#vp-ptt').onchange = e => voice.setPTT(e.target.checked);
  $('#vp-mic').onchange = e => voice.changeMic(e.target.value);

  async function openVoicePanel() {
    $('#vp-ptt').checked = voice.prefs.ptt;
    const mics = await voice.listMics();
    const sel = $('#vp-mic');
    sel.innerHTML = `<option value="">${t('defaultMic')}</option>` + mics.map((d, i) => `<option value="${d.deviceId.replace(/"/g, '')}">${(d.label || 'Microfono ' + (i + 1)).replace(/[<>&"]/g, '')}</option>`).join('');
    sel.value = voice.prefs.micId || '';
    const box = $('#vp-people'); box.innerHTML = '';
    for (const [uid, m] of Object.entries(S.members)) {
      if (uid === S.uid) continue;
      const row = document.createElement('div'); row.className = 'vp-person'; row.dataset.uid = uid;
      row.innerHTML = `<b></b><input type="range" min="0" max="1" step="0.05"><button class="btn small"></button>`;
      row.querySelector('b').textContent = String(m.nick || '?').slice(0, 16);
      const r = row.querySelector('input'); r.value = voice.prefs.vol[uid] ?? 1;
      r.oninput = () => voice.setVolume(uid, +r.value);
      const b = row.querySelector('button');
      const upd = () => { b.textContent = voice.prefs.muted[uid] ? '🔇' : '🔈'; };
      b.onclick = () => { voice.setMuted(uid, !voice.prefs.muted[uid]); upd(); }; upd();
      box.appendChild(row);
    }
    $('#voicepanel').classList.add('show');
  }

  // tasti: M accende/spegne, V (tenuto) per parlare; tasto Select del controller
  const typing = () => ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName) && document.activeElement.type !== 'range' && document.activeElement.type !== 'checkbox';
  addEventListener('keydown', e => {
    if (!S.room || typing() || e.repeat || ctx.input.keyCapture) return;
    if (e.code === settings.keys.mic) { ctx.unlockAudio(); voice.setMic(!voice.micOn); }
    if (e.code === settings.keys.ptt) { if (!voice.micOn && voice.prefs.ptt) voice.setMic(true); voice.setPTTDown(true); }
  });
  addEventListener('keyup', e => { if (e.code === settings.keys.ptt) voice.setPTTDown(false); });
  let padSelPrev = false;
  setInterval(() => {
    if (!S.room) return;
    const down = Object.values(ctx.input.padPrev).some(st => st.select);
    if (down !== padSelPrev) {   // agisce solo quando cambia lo stato del tasto (non disturba il tasto V)
      if (voice.prefs.ptt) { if (down && !voice.micOn) voice.setMic(true); voice.setPTTDown(down); }
      else if (down) voice.setMic(!voice.micOn);
    }
    padSelPrev = down;
  }, 50);

  return {
    voice,
    get active() { return !!S.room; },
    get inGame() { return inGame; },
    get isHost() { return S.isHost; },
    onShowOnline,
    inviteCode: q,
    // pulsanti dei menu di gioco quando si è online
    quit() { leaveRoom(); },
    toRoom() { if (S.isHost) { S.sendAll({ t: 'lobby' }, true); backToRoom(); } },
    leave: leaveRoom,
    session: S,
  };
}
