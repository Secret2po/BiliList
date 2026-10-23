/* ==========================================================================
   BiliLIST — Supabase client
   --------------------------------------------------------------------------
   Loads the Supabase JS SDK and exposes a single client.

   The connection can come from two places, in this order of precedence:
     1. localStorage  "bililist.supabase"  (set from the login screen's
        Connect box — handy for demos, and it keeps the key out of the repo)
     2. assets/js/config.js                (the value that ships with the site)

   If neither is present the app falls back to "demo mode": everything runs in
   the browser, so the prototype can still be shown without a backend.
   ========================================================================== */
(function (global) {
  'use strict';

  var STORE_KEY = 'bililist.supabase';

  function readOverride() {
    try {
      var raw = global.localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var v = JSON.parse(raw);
      if (v && typeof v.url === 'string' && typeof v.key === 'string') return v;
    } catch (e) { /* ignore a corrupted entry */ }
    return null;
  }

  var CONFIG = global.BILILIST_CONFIG || {};
  var url = (CONFIG.supabaseUrl || '').trim();
  var key = (CONFIG.supabaseAnonKey || '').trim();

  var override = readOverride();
  var source = 'config';
  if (override) {
    url = override.url.trim();
    key = override.key.trim();
    source = 'browser';
  }

  function looksReal(v, placeholder) {
    return !!v && v.indexOf(placeholder) === -1;
  }

  var hasUrl = looksReal(url, 'YOUR-PROJECT');
  var hasKey = looksReal(key, 'PASTE-') && looksReal(key, 'YOUR-ANON');

  var configured = hasUrl && hasKey && !!global.supabase && !!global.supabase.createClient;
  var client = null;
  var initError = '';

  if (configured) {
    try {
      client = global.supabase.createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          /* PKCE is the safer OAuth exchange for a browser app: the access
             token never rides back in the URL hash. */
          flowType: 'pkce'
        }
      });
    } catch (e) {
      client = null;
      initError = (e && e.message) || 'Could not create the Supabase client.';
    }
  } else if (hasUrl && hasKey && !global.supabase) {
    initError = 'The Supabase SDK did not load. Check your internet connection and refresh.';
  }

  /* used by the Connect box on the login screen */
  function saveConfig(nextUrl, nextKey) {
    global.localStorage.setItem(STORE_KEY, JSON.stringify({
      url: String(nextUrl).trim(),
      key: String(nextKey).trim()
    }));
  }

  function clearConfig() {
    global.localStorage.removeItem(STORE_KEY);
  }

  /* a real round trip, so we know the key is accepted before reloading */
  function testConnection(testUrl, testKey) {
    if (!global.fetch) return Promise.resolve(true);
    var base = String(testUrl).replace(/\/+$/, '');
    return global.fetch(base + '/auth/v1/settings', {
      headers: { apikey: testKey, Authorization: 'Bearer ' + testKey }
    }).then(function (r) {
      return r.ok;
    }).catch(function () {
      return false;
    });
  }

  /* is the Google provider switched on for this project?
     null means "could not tell" — the caller then tries the normal flow. */
  function googleEnabled() {
    if (!global.fetch || !url || !key) return Promise.resolve(null);
    var base = String(url).replace(/\/+$/, '');
    return global.fetch(base + '/auth/v1/settings', {
      headers: { apikey: key, Authorization: 'Bearer ' + key }
    }).then(function (r) {
      if (!r.ok) return null;
      return r.json();
    }).then(function (data) {
      if (!data || !data.external) return null;
      return !!data.external.google;
    }).catch(function () {
      return null;
    });
  }

  global.BiliSupabase = {
    client: client,
    isConfigured: !!client,
    mode: client ? 'supabase' : 'demo',
    url: url,
    hasUrl: hasUrl,
    hasKey: hasKey,
    source: source,
    initError: initError,
    saveConfig: saveConfig,
    clearConfig: clearConfig,
    testConnection: testConnection,
    googleEnabled: googleEnabled
  };
})(window);
