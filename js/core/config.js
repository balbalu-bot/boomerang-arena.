// Parametri di gioco centralizzati. Modificare qui per bilanciare.
// Tutti i personaggi in modalità classica usano gli stessi valori.

export const CFG = {
  SIM_HZ: 60,                 // passo fisso della simulazione (pronto per il multiplayer)
  MAX_PLAYERS: 8,

  PLAYER_RADIUS: 0.36,
  MOVE_SPEED: 5.4,
  ACCEL: 55,
  FRICTION: 16,
  ICE_FRICTION: 1.6,
  ICE_ACCEL: 9,
  CHARGE_MOVE_MULT: 0.55,     // rallentamento mentre si carica il lancio

  DASH_SPEED: 17,
  DASH_TIME: 0.15,
  DASH_COOLDOWN: 0.55,
  DASH_PUSH: 11,              // spinta inflitta a chi viene urtato durante lo scatto

  CHARGE_TIME: 0.55,
  THROW_MIN: 13,             // velocità del boomerang (carica minima → massima)
  THROW_MAX: 18,
  RANGE_MIN: 4,               // distanza percorsa in andata, rimbalzi compresi
  RANGE_MAX: 12,
  BOOM_RADIUS: 0.27,
  BOOM_RETURN_SPEED: 15,
  BOOM_RECALL_SPEED: 19,
  BOOM_CATCH_DIST: 0.7,
  BOOM_KILL_MIN_SPEED: 3.2,

  MELEE_RANGE: 1.3,
  MELEE_ARC: 2.3,             // ampiezza dell'arco in radianti
  MELEE_TIME: 0.16,
  MELEE_COOLDOWN: 0.38,
  DEFLECT_SPEED: 18,

  SPAWN_SHIELD: 1.5,          // secondi di invulnerabilità a inizio round
  BARREL_RADIUS: 2.3,
  ROUND_TIME: 90,
  COUNTDOWN: 3,
};

// Colori degli slot giocatore (anello a terra, boomerang, HUD)
export const SLOT_COLORS = [
  0xff4d6d, 0x4dabff, 0x5bd96b, 0xffc93c,
  0xb57cff, 0xff8a3d, 0x3de0d0, 0xff7ad9,
];

export const TEAM_COLORS = [0xff4d6d, 0x4dabff];

export const BOT_LEVELS = {
  facile:    { reaction: 0.85, aimError: 0.55, dodge: 0.08, lead: 0.0, deflect: 0.0,  aggression: 0.3,  push: 0.0 },
  normale:   { reaction: 0.45, aimError: 0.28, dodge: 0.35, lead: 0.4, deflect: 0.15, aggression: 0.5,  push: 0.15 },
  difficile: { reaction: 0.20, aimError: 0.10, dodge: 0.72, lead: 0.85, deflect: 0.5, aggression: 0.8,  push: 0.5 },
  esperto:   { reaction: 0.11, aimError: 0.045, dodge: 0.92, lead: 1.0, deflect: 0.8, aggression: 0.95, push: 0.8 },
};
