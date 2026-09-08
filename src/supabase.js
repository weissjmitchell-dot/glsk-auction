import { createClient } from '@supabase/supabase-js';

// Supabase's publishable key is intentionally safe to include in a browser app.
// Authorization is enforced by the database/RPC rules, not by keeping this key secret.
const url = 'https://vavzeyewfipswyxeqdht.supabase.co';
const key = 'sb_publishable_vFPh7D0LYQ0n66n_jbBOKA_qTvpXsPq';

export const configured = true;
export const supabase = createClient(url, key, {
  realtime: { params: { eventsPerSecond: 20 } },
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
