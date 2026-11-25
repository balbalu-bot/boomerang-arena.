// Radio (chat vocale) della stanza — WebRTC audio, una connessione per ogni coppia di giocatori.
// - Il microfono parte SPENTO e si accende solo con un gesto del giocatore; resta acceso finché non lo si spegne.
// - La radio è legata alla stanza: non si interrompe passando dalla lobby alla partita o cambiando arena.
// - Nessuna registrazione: l'audio va direttamente da un browser all'altro e non passa da nessun server di gioco.

import { NET } from './net-config.js';
import { duckMusic } from '../core/audio.js';

const LS = 'bba-voice';

function loadPrefs() {
  try { return { ptt: false, micId: '', vol: {}, muted: {}, speakers: true, ...JSON.parse(localStorage.getItem(LS) || '{}') }; }
  catch { return { ptt: false, micId: '', vol: {}, muted: {}, speakers: true }; }
}

export class Voice {
  constructor(session) {
    this.s = session;
    this.prefs = loadPrefs();
    this.peers = new Map();      // uid → { pc, tx, audio, analyser, state }
    this.stream = null;          // microfono locale
    this.micOn = false;          // microfono "aperto" dall'utente
    this.pttDown = false;
    this.speaking = new Set();   // uid che stanno parlando (compreso il proprio)
    this.listeners = [];
    this.actx = null;
    session.on('vsig', (from, d) => this.onSignal(from, d));
    session.on('members', m => this.sync(m));
    this.meterTimer = setInterval(() => this.meter(), 120);
  }

  onChange(fn) { this.listeners.push(fn); }
  changed() { for (const f of this.listeners) f(); }
  save() { try { localStorage.setItem(LS, JSON.stringify(this.prefs)); } catch { } }

  ctx() {
    if (!this.actx) { const AC = window.AudioContext || window.webkitAudioContext; this.actx = AC ? new AC() : null; }
    if (this.actx?.state === 'suspended') this.actx.resume();
    return this.actx;
  }

  // ---------- collegamenti ----------
  sync(members) {
    if (!this.s.room) return;
    for (const uid of Object.keys(members)) if (uid !== this.s.uid && !this.peers.has(uid)) this.connect(uid);
    for (const uid of [...this.peers.keys()]) if (!members[uid]) this.drop(uid);
    this.changed();
  }

  connect(uid) {
    const pc = new RTCPeerConnection({ iceServers: NET.ICE_SERVERS });
    const initiator = this.s.uid < uid;
    // solo chi fa l'offerta crea il canale audio; l'altro lo riceve con l'offerta e lo usa anche per trasmettere
    const tx = initiator ? pc.addTransceiver('audio', { direction: 'sendrecv' }) : null;
    const p = { pc, tx, audio: null, analyser: null, state: 'connecting', pending: [], initiator };
    this.peers.set(uid, p);
    if (tx && this.stream) tx.sender.replaceTrack(this.stream.getAudioTracks()[0]).catch(() => {});
    pc.onicecandidate = e => { if (e.candidate) this.s.vsignal(uid, { c: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      p.state = st === 'connected' ? 'ok' : st === 'failed' ? 'failed' : st === 'disconnected' ? 'connecting' : p.state;
      if (st === 'failed' && p.initiator) setTimeout(() => { if (this.peers.get(uid) === p) { this.drop(uid); if (this.s.members[uid]) this.connect(uid); } }, 3000);
      this.changed();
    };
    pc.ontrack = e => this.attach(uid, p, e.streams[0] || new MediaStream([e.track]));
    if (p.initiator) this.offer(uid, p);
  }

  async offer(uid, p) {
    try {
      await p.pc.setLocalDescription(await p.pc.createOffer());
      this.s.vsignal(uid, { sdp: p.pc.localDescription.toJSON() });
    } catch (e) { console.warn('voce offerta', e); }
  }

  async onSignal(from, d) {
    if (!d || typeof d !== 'object') return;
    let p = this.peers.get(from);
    if (!p) { if (!this.s.members[from]) return; this.connect(from); p = this.peers.get(from); }
    try {
      if (d.sdp) {
        if (d.sdp.type === 'offer' && p.initiator) return; // l'offerta la fa sempre l'uid "minore"
        await p.pc.setRemoteDescription(d.sdp);
        if (d.sdp.type === 'offer' && !p.tx) {
          p.tx = p.pc.getTransceivers().find(t => t.receiver.track?.kind === 'audio');
          if (p.tx) { p.tx.direction = 'sendrecv'; if (this.stream) await p.tx.sender.replaceTrack(this.stream.getAudioTracks()[0]).catch(() => {}); }
        }
        if (d.sdp.type === 'offer') {
          await p.pc.setLocalDescription(await p.pc.createAnswer());
          this.s.vsignal(from, { sdp: p.pc.localDescription.toJSON() });
        }
        for (const c of p.pending) await p.pc.addIceCandidate(c).catch(() => {});
        p.pending = [];
      } else if (d.c) {
        if (p.pc.remoteDescription) await p.pc.addIceCandidate(d.c).catch(() => {});
        else p.pending.push(d.c);
      }
    } catch (e) { console.warn('voce segnale', e); }
  }

  attach(uid, p, stream) {
    if (!p.audio) {
      p.audio = new Audio();
      p.audio.autoplay = true; p.audio.playsInline = true;
      document.body.appendChild(p.audio); p.audio.style.display = 'none';
    }
    p.audio.srcObject = stream;
    this.applyVolume(uid);
    p.audio.play().catch(() => {});
    const ac = this.ctx();
    if (ac) {
      try {
        const src = ac.createMediaStreamSource(stream);
        p.analyser = ac.createAnalyser(); p.analyser.fftSize = 512;
        src.connect(p.analyser); // solo misura del volume: l'audio esce dall'elemento <audio>
      } catch { }
    }
  }

  drop(uid) {
    const p = this.peers.get(uid); if (!p) return;
    try { p.pc.close(); } catch { }
    if (p.audio) { p.audio.srcObject = null; p.audio.remove(); }
    this.peers.delete(uid); this.speaking.delete(uid);
  }

  // ---------- microfono ----------
  async setMic(on) {
    if (on && !this.stream) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: this.prefs.micId ? { exact: this.prefs.micId } : undefined,
            echoCancellation: true, noiseSuppression: true, autoGainControl: true,
          },
        });
      } catch (e) {
        if (this.prefs.micId) { this.prefs.micId = ''; this.save(); return this.setMic(true); }
        this.error = e.name === 'NotAllowedError' ? 'denied' : 'nomic';
        this.changed(); return false;
      }
      const track = this.stream.getAudioTracks()[0];
      for (const p of this.peers.values()) p.tx?.sender.replaceTrack(track).catch(() => {});
      const ac = this.ctx();
      if (ac) { try { const src = ac.createMediaStreamSource(this.stream); this.myAnalyser = ac.createAnalyser(); this.myAnalyser.fftSize = 512; src.connect(this.myAnalyser); } catch { } }
    }
    this.error = null;
    this.micOn = on;
    this.updateTrack();
    this.changed();
    return true;
  }

  async changeMic(deviceId) {
    this.prefs.micId = deviceId; this.save();
    if (this.stream) {
      const was = this.micOn;
      this.stream.getTracks().forEach(t => t.stop()); this.stream = null; this.myAnalyser = null;
      if (was) await this.setMic(true);
    }
  }

  async listMics() {
    try { return (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput'); } catch { return []; }
  }

  setPTT(on) { this.prefs.ptt = on; this.save(); this.updateTrack(); this.changed(); }
  setPTTDown(down) { if (this.pttDown === down) return; this.pttDown = down; this.updateTrack(); this.changed(); }

  // la traccia trasmette solo se il microfono è acceso (e, in modalità "premi per parlare", se il tasto è premuto)
  updateTrack() {
    const t = this.stream?.getAudioTracks()[0];
    if (t) t.enabled = this.micOn && (!this.prefs.ptt || this.pttDown);
  }
  get transmitting() { return !!this.stream && this.micOn && (!this.prefs.ptt || this.pttDown); }

  // ---------- volumi ----------
  setSpeakers(on) { this.prefs.speakers = on; this.save(); for (const uid of this.peers.keys()) this.applyVolume(uid); this.changed(); }
  setVolume(uid, v) { this.prefs.vol[uid] = v; this.save(); this.applyVolume(uid); }
  setMuted(uid, m) { this.prefs.muted[uid] = m; this.save(); this.applyVolume(uid); this.changed(); }
  applyVolume(uid) {
    const p = this.peers.get(uid); if (!p?.audio) return;
    p.audio.volume = Math.max(0, Math.min(1, this.prefs.vol[uid] ?? 1));
    p.audio.muted = !this.prefs.speakers || !!this.prefs.muted[uid];
  }

  // ---------- chi sta parlando ----------
  level(an) {
    if (!an) return 0;
    const buf = new Uint8Array(an.fftSize); an.getByteTimeDomainData(buf);
    let s = 0; for (const v of buf) { const x = (v - 128) / 128; s += x * x; }
    return Math.sqrt(s / buf.length);
  }
  meter() {
    const before = [...this.speaking].join();
    this.speaking.clear();
    if (this.transmitting && this.level(this.myAnalyser) > 0.04) this.speaking.add(this.s.uid);
    for (const [uid, p] of this.peers) if (p.state === 'ok' && !this.prefs.muted[uid] && this.prefs.speakers && this.level(p.analyser) > 0.04) this.speaking.add(uid);
    const others = [...this.speaking].some(u => u !== this.s.uid);
    if (others !== this.ducked) { this.ducked = others; duckMusic(others); }
    if ([...this.speaking].join() !== before) this.changed();
  }

  status() {
    const ps = [...this.peers.values()];
    if (!ps.length) return 'alone';
    if (ps.every(p => p.state === 'ok')) return 'ok';
    if (ps.some(p => p.state === 'failed')) return 'partial';
    return 'connecting';
  }

  close() {
    for (const uid of [...this.peers.keys()]) this.drop(uid);
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null; this.myAnalyser = null; this.micOn = false; this.pttDown = false;
    this.speaking.clear();
    if (this.ducked) { this.ducked = false; duckMusic(false); }
    this.changed();
  }
}
