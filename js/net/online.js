// Sessione online: accesso, stanze, lobby (presence), collegamento WebRTC tra host e giocatori.
// Supabase serve SOLO per stanze, presenze e "segnalazione" iniziale (pochi messaggi).
// I dati di gioco viaggiano direttamente tra i browser su WebRTC DataChannel (topologia a stella: host al centro).

import { NET } from './net-config.js';

const MAX_MSG = 60000;

// ---------------------------------------------------------------------
//  Backend Supabase
// ---------------------------------------------------------------------
class SupabaseBackend {
  async init() {
    const { createClient } = await import('../../vendor/supabase.js');
    this.sb = createClient(NET.SUPABASE_URL, NET.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'bba-auth' },
      realtime: { params: { eventsPerSecond: 40 } },
    });
    let { data: { session } } = await this.sb.auth.getSession();
    if (!session) {
      const { data, error } = await this.sb.auth.signInAnonymously();
      if (error) throw new Error('auth:' + error.message);
      session = data.session;
    }
    this.uid = session.user.id;
    this.token = session.access_token;
    this.sb.auth.onAuthStateChange((_e, s) => { if (s) { this.token = s.access_token; this.sb.realtime.setAuth(s.access_token); } });
    return this.uid;
  }
  async createRoom(nick) {
    const { data, error } = await this.sb.rpc('create_room', { p_nick: nick });
    if (error) throw new Error(error.message);
    const r = data[0]; return { id: r.out_id, code: r.out_code, hostId: r.out_host };
  }
  async joinRoom(code, nick) {
    const { data, error } = await this.sb.rpc('join_room', { p_code: code, p_nick: nick });
    if (error) throw new Error(error.message);
    const r = data[0]; return { id: r.out_id, code: r.out_code, hostId: r.out_host };
  }
  async leaveRoom(room) {
    if (room.hostId === this.uid) await this.sb.from('rooms').delete().eq('id', room.id);
    else await this.sb.from('room_members').delete().eq('room_id', room.id).eq('user_id', this.uid);
  }
  async kick(room, uid) { await this.sb.from('room_members').delete().eq('room_id', room.id).eq('user_id', uid); }
  async setLocked(room, locked) { await this.sb.from('rooms').update({ locked }).eq('id', room.id); }
  async openChannel(room, { onMsg, onPresence }) {
    await this.sb.realtime.setAuth(this.token);
    const ch = this.sb.channel('room:' + room.id, { config: { private: true, broadcast: { self: false }, presence: { key: this.uid } } });
    ch.on('broadcast', { event: 'm' }, ({ payload }) => onMsg(payload));
    ch.on('presence', { event: 'sync' }, () => {
      const st = ch.presenceState(), out = {};
      for (const k in st) if (st[k][0]) out[k] = st[k][0];
      onPresence(out);
    });
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('timeout canale')), 12000);
      ch.subscribe(status => {
        if (status === 'SUBSCRIBED') { clearTimeout(t); res(); }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(t); rej(new Error('canale: ' + status)); }
      });
    });
    this.ch = ch;
    return {
      send: payload => ch.send({ type: 'broadcast', event: 'm', payload }),
      track: state => ch.track(state),
      close: () => { ch.untrack(); this.sb.removeChannel(ch); },
    };
  }
}

// ---------------------------------------------------------------------
//  Backend locale (solo per prove: più schede dello stesso browser, ?locale=1)
// ---------------------------------------------------------------------
class LocalBackend {
  async init() {
    this.uid = sessionStorage.getItem('bba-local-uid') || crypto.randomUUID();
    sessionStorage.setItem('bba-local-uid', this.uid);
    return this.uid;
  }
  async createRoom() { const code = Math.random().toString(36).slice(2, 8).toUpperCase(); return { id: code, code, hostId: this.uid }; }
  async joinRoom(code) { return { id: code.toUpperCase(), code: code.toUpperCase(), hostId: null }; }
  async leaveRoom() {}
  async kick() {}
  async setLocked() {}
  async openChannel(room, { onMsg, onPresence }) {
    const bc = new BroadcastChannel('bba-room-' + room.id);
    const peers = {}; let mine = null;
    const emit = () => onPresence({ ...peers, ...(mine ? { [this.uid]: mine } : {}) });
    bc.onmessage = ({ data }) => {
      if (data.k === '__pres') { if (data.state) peers[data.uid] = { ...data.state, _seen: Date.now() }; else delete peers[data.uid]; emit(); if (data.ask && mine) bc.postMessage({ k: '__pres', uid: this.uid, state: mine }); return; }
      onMsg(data);
    };
    const hb = setInterval(() => {
      if (mine) bc.postMessage({ k: '__pres', uid: this.uid, state: mine });
      const now = Date.now(); let ch = false;
      for (const k in peers) if (now - peers[k]._seen > 4000) { delete peers[k]; ch = true; }
      if (ch) emit();
    }, 1000);
    return {
      send: p => bc.postMessage(p),
      track: state => { mine = state; bc.postMessage({ k: '__pres', uid: this.uid, state, ask: true }); emit(); },
      close: () => { clearInterval(hb); bc.postMessage({ k: '__pres', uid: this.uid, state: null }); bc.close(); },
    };
  }
}

// ---------------------------------------------------------------------
//  Collegamento diretto con un altro browser
// ---------------------------------------------------------------------
class Peer {
  constructor(session, uid, initiator) {
    this.s = session; this.uid = uid; this.initiator = initiator;
    this.u = null; this.r = null; this.open = false; this.relay = false; this.closed = false;
    this.pendingIce = []; this.created = performance.now();
    const pc = this.pc = new RTCPeerConnection({ iceServers: NET.ICE_SERVERS });
    pc.onicecandidate = e => { if (e.candidate) session.signal(uid, { c: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') this.toRelay();
      if (pc.connectionState === 'closed') this.close();
    };
    if (initiator) {
      this.setup(pc.createDataChannel('u', { ordered: false, maxRetransmits: 0 }));
      this.setup(pc.createDataChannel('r', { ordered: true }));
      this.offer();
    } else {
      pc.ondatachannel = e => this.setup(e.channel);
    }
    // se la connessione diretta non si apre in tempo, si passa al relè Supabase
    this.relayTimer = setTimeout(() => { if (!this.open) this.toRelay(); }, 12000);
  }
  async offer() {
    const o = await this.pc.createOffer();
    await this.pc.setLocalDescription(o);
    this.s.signal(this.uid, { sdp: this.pc.localDescription.toJSON() });
  }
  async onSignal(d) {
    try {
      if (d.sdp) {
        await this.pc.setRemoteDescription(d.sdp);
        if (d.sdp.type === 'offer') {
          const a = await this.pc.createAnswer();
          await this.pc.setLocalDescription(a);
          this.s.signal(this.uid, { sdp: this.pc.localDescription.toJSON() });
        }
        for (const c of this.pendingIce) await this.pc.addIceCandidate(c).catch(() => {});
        this.pendingIce = [];
      } else if (d.c) {
        if (this.pc.remoteDescription) await this.pc.addIceCandidate(d.c).catch(() => {});
        else this.pendingIce.push(d.c);
      }
    } catch (e) { console.warn('segnalazione', e); }
  }
  setup(dc) {
    if (dc.label === 'u') this.u = dc; else this.r = dc;
    dc.onopen = () => { if (this.u?.readyState === 'open' && this.r?.readyState === 'open') { this.open = true; this.relay = false; clearTimeout(this.relayTimer); this.s.emit('peer', this); } };
    dc.onclose = () => { this.open = false; };
    dc.onmessage = e => { if (typeof e.data === 'string' && e.data.length < MAX_MSG) { try { this.s.onData(this.uid, JSON.parse(e.data)); } catch { /* messaggio non valido */ } } };
  }
  toRelay() {
    if (this.relay || this.closed) return;
    this.relay = true; this.s.emit('peer', this);
  }
  send(msg, reliable) {
    if (this.open) {
      const dc = reliable ? this.r : this.u;
      if (dc && dc.readyState === 'open' && (reliable || dc.bufferedAmount < 64000)) { dc.send(JSON.stringify(msg)); return; }
    }
    if (this.relay || reliable) this.s.relaySend(this.uid, msg);
  }
  close() { if (this.closed) return; this.closed = true; clearTimeout(this.relayTimer); try { this.pc.close(); } catch { } this.s.emit('peerClosed', this); }
}

// ---------------------------------------------------------------------
//  Sessione
// ---------------------------------------------------------------------
export class OnlineSession {
  constructor() {
    this.local = new URLSearchParams(location.search).has('locale');
    this.backend = this.local ? new LocalBackend() : new SupabaseBackend();
    this.uid = null; this.room = null; this.chan = null;
    this.members = {}; this.peers = new Map(); this.handlers = {};
    this.myState = null; this.trackTimer = null;
  }
  on(ev, fn) { (this.handlers[ev] ||= []).push(fn); }
  off(ev) { delete this.handlers[ev]; }
  emit(ev, ...a) { for (const f of this.handlers[ev] || []) f(...a); }

  async init() { if (!this.uid) this.uid = await this.backend.init(); return this.uid; }
  get isHost() { return !!this.room && this.room.hostId === this.uid; }
  get hostId() { return this.room?.hostId; }

  async create(nick) { await this.init(); const r = await this.backend.createRoom(nick); return this.enter(r, nick); }
  async join(code, nick) {
    await this.init(); const r = await this.backend.joinRoom(code, nick);
    if (!r.hostId) r.hostId = null; // locale: l'host si scopre dalle presenze
    return this.enter(r, nick);
  }

  async enter(room, nick) {
    this.room = room;
    this.chan = await this.backend.openChannel(room, {
      onMsg: p => this.onRelay(p),
      onPresence: m => this.onPresence(m),
    });
    this.setMyState({ nick, char: 0, ready: false, host: room.hostId === this.uid, t: Date.now() });
    return room;
  }

  setMyState(patch) {
    this.myState = { ...(this.myState || {}), ...patch };
    clearTimeout(this.trackTimer);
    this.trackTimer = setTimeout(() => this.chan?.track(this.myState), 120); // raggruppa gli aggiornamenti (limite presenze)
  }

  onPresence(m) {
    this.members = m;
    if (!this.room.hostId) { const h = Object.entries(m).find(([, s]) => s.host); if (h) this.room.hostId = h[0]; }
    // l'host avvia il collegamento diretto con ogni nuovo giocatore
    if (this.isHost) {
      for (const uid of Object.keys(m)) if (uid !== this.uid && !this.peers.has(uid)) this.peers.set(uid, new Peer(this, uid, true));
    }
    for (const [uid, p] of this.peers) if (!m[uid] && performance.now() - p.created > 5000) { p.close(); this.peers.delete(uid); this.emit('left', uid); }
    this.emit('members', m);
  }

  signal(to, d) { this.chan?.send({ f: this.uid, to, k: 'sig', d }); }
  relaySend(to, msg) { this.chan?.send({ f: this.uid, to, k: 'msg', d: msg }); }
  broadcastRelay(msg) { this.chan?.send({ f: this.uid, to: '*', k: 'msg', d: msg }); }

  onRelay(p) {
    if (!p || typeof p !== 'object' || typeof p.f !== 'string') return;
    if (p.to !== this.uid && p.to !== '*') return;
    if (p.k === 'sig') {
      let peer = this.peers.get(p.f);
      if (!peer && !this.isHost && p.f === this.hostId) { peer = new Peer(this, p.f, false); this.peers.set(p.f, peer); }
      peer?.onSignal(p.d || {});
    } else if (p.k === 'msg') this.onData(p.f, p.d);
  }

  onData(from, msg) {
    if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;
    // i messaggi di gioco dei client sono accettati solo dall'host, e viceversa
    if (!this.isHost && from !== this.hostId) return;
    this.emit('data', from, msg);
  }

  // host → tutti i giocatori collegati
  sendAll(msg, reliable = false) { for (const p of this.peers.values()) if (!p.closed) p.send(msg, reliable); }
  sendTo(uid, msg, reliable = false) { this.peers.get(uid)?.send(msg, reliable); }
  // client → host
  sendHost(msg, reliable = false) { this.peers.get(this.hostId)?.send(msg, reliable); }

  peerStatus(uid) { const p = this.peers.get(uid); return !p ? 'none' : p.open ? 'direct' : p.relay ? 'relay' : 'connecting'; }

  async kick(uid) {
    if (!this.isHost) return;
    this.relaySend(uid, { t: 'kick' });
    await this.backend.kick(this.room, uid).catch(() => {});
    this.peers.get(uid)?.close(); this.peers.delete(uid);
  }
  async setLocked(b) { if (this.isHost) await this.backend.setLocked(this.room, b).catch(() => {}); }

  async leave() {
    if (!this.room) return;
    const room = this.room;
    for (const p of this.peers.values()) p.close();
    this.peers.clear();
    try { this.chan?.close(); } catch { }
    this.chan = null; this.room = null; this.members = {}; this.myState = null;
    await this.backend.leaveRoom(room).catch(() => {});
  }
}
