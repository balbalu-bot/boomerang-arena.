// =====================================================================
//  CONFIGURAZIONE ONLINE — da compilare una volta sola (vedi README)
//  Qui vanno SOLO l'indirizzo del progetto e la chiave PUBBLICA "anon".
//  Non inserire MAI la chiave "service_role" né password: questo file è pubblico.
// =====================================================================

export const NET = {
  SUPABASE_URL: 'https://cdgyyjaudtfumleyktla.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_5Ozy1Q4FCSWoUFoVc96NUg_vCHy7le9',   // chiave pubblica (publishable)

  // Server STUN pubblici gratuiti: servono a far trovare tra loro i browser.
  // Se in qualche rete (alcune scuole o operatori mobili) la connessione diretta non riesce,
  // si può aggiungere un server TURN qui sotto (vedi README, sezione TURN).
  ICE_SERVERS: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],

  SNAPSHOT_HZ: 20,         // aggiornamenti al secondo inviati dall'host (connessione diretta)
  RELAY_SNAPSHOT_HZ: 6,    // se la connessione diretta non riesce (passa da Supabase: consuma messaggi)
  INPUT_HZ: 30,
};

export const netConfigured = () => !!(NET.SUPABASE_URL && NET.SUPABASE_ANON_KEY) || new URLSearchParams(location.search).has('locale');
