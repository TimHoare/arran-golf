/* Supabase connection. From the dashboard:
   - supabaseUrl:     Settings → Data API → Project URL
   - supabaseAnonKey: Settings → API Keys → publishable key (sb_publishable_...)
   Never the secret (sb_secret_) / service_role key — that bypasses row security.
   Both values are safe to commit and publish; what they can touch is controlled
   by the database policies in supabase-schema.sql. Leave both empty and the
   app runs in single-phone mode (localStorage only). */
export const CONFIG = {
  supabaseUrl: 'https://rcqncediamykfyzckccp.supabase.co',
  supabaseAnonKey: 'sb_publishable_HT8_pwWvB1kpUZ9OF1e1PA_TX3EIR_S',
};
