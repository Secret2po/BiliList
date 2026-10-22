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

  var hasUrl = !!url && url.indexOf('YOUR-PROJECT') === -1;
  var hasKey = !!key && key.indexOf('PASTE-') === -1 && key.indexOf('YOUR-ANON') === -1;

  var configured = hasUrl && hasKey && !!global.supabase && !!global.supabase.createClient;
  var client = null;
  var initError = '';

  if (configured) {
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
      initError = (e && e.message) || 'Could not create the Supabase client.';
    }
  } else if (hasUrl && hasKey && !global.supabase) {
    initError = 'The Supabase SDK did not load. Check your internet connection and refresh.';
  }

  global.BiliSupabase = {
    client: client,
    isConfigured: !!client,
    mode: client ? 'supabase' : 'demo',
    url: url,
    hasUrl: hasUrl,
    hasKey: hasKey,
    initError: initError
  };
})(window);
