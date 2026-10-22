/* ==========================================================================
   BiliLIST — Supabase client
   --------------------------------------------------------------------------
   Loads the Supabase JS SDK and exposes a single client. If no keys are set
   in assets/js/config.js the app falls back to "demo mode": everything runs
   in the browser exactly as before, so the prototype can still be shown
   without a backend.
   ========================================================================== */
(function (global) {
  'use strict';

  var CONFIG = global.BILILIST_CONFIG || {};
  var url = (CONFIG.supabaseUrl || '').trim();
  var key = (CONFIG.supabaseAnonKey || '').trim();

  var configured = !!(url && key && url.indexOf('YOUR-PROJECT') === -1 && key.indexOf('YOUR-ANON') === -1);
  var client = null;

  if (configured && global.supabase && global.supabase.createClient) {
    try {
      client = global.supabase.createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    } catch (e) {
      client = null;
      configured = false;
    }
  }

  global.BiliSupabase = {
    client: client,
    isConfigured: !!client,
    mode: client ? 'supabase' : 'demo',
    url: url
  };
})(window);
