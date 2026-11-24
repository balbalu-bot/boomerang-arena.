// Configurazione online di Boomerang Battle Arena (solo dati pubblici)
export const NET = {
  SUPABASE_URL: 'https://cdgyyjaudtfumleyktla.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_5Ozy1Q4FCSWoUFoVc96NUg_vCHy7le9',

  ICE_SERVERS: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],

  SNAPSHOT_HZ: 20,
  RELAY_SNAPSHOT_HZ: 6,
  INPUT_HZ: 30,
};

export const netConfigured = () => !!(NET.SUPABASE_URL && NET.SUPABASE_ANON_KEY) || new URLSearchParams(location.search).has('locale');
