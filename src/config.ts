/* Supabase connection. From the dashboard:
   - supabaseUrl:     Settings → Data API → Project URL
   - supabaseAnonKey: Settings → API Keys → publishable key (sb_publishable_...)
   Never the secret (sb_secret_) / service_role key — that bypasses row security.
   Both values are safe to commit and publish; what they can touch is controlled
   by the database policies in supabase-schema.sql. Leave both empty and the
   app runs in single-phone mode (localStorage only). */
// TBC: create the trip's own Supabase project (never the Yorkshire one — that
// database is the record of that week), run supabase-schema.sql in its SQL
// editor, then fill these in.
export const CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
};
