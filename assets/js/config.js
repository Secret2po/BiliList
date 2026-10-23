/* ==========================================================================
   BiliLIST — Supabase connection settings
   --------------------------------------------------------------------------
   1. Go to https://supabase.com/dashboard  ->  your project
   2. Open  Project Settings  ->  API
   3. Copy the two values below
   4. Save this file and refresh the page
   --------------------------------------------------------------------------
   The "anon / publishable" key is designed to be public — it only ever
   exposes rows that the row level security policies in
   supabase/schema.sql allow. Never put the service_role key in here.
   ========================================================================== */

window.BILILIST_CONFIG = {
  supabaseUrl: 'https://xsjwhwrnseevlntxwjeg.supabase.co',
  supabaseAnonKey: 'sb_publishable_JmA7W3FNfRSOaDvrl45qWg_7m7kn7JR',

  /* Public web client ID from Google Cloud. Google Identity Services uses it
     in the browser; it is not a secret. It must match the Client ID saved in
     Supabase -> Authentication -> Providers -> Google. */
  googleClientId: '284932022302-jtjdsj4voem1ufaom28a4eu1q2t9rrpi.apps.googleusercontent.com'
};
