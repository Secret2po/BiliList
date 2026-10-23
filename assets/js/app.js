/* ==========================================================================
   BiliLIST — prototype application logic
   Vanilla JS, no build step. State is persisted to localStorage.
   ========================================================================== */
(function () {
  'use strict';

  var D = window.BiliList;
  var STORE_KEY = 'bililist.prototype.v2';
  var OAUTH_PENDING_KEY = 'bililist.oauth.pending';
  var UI_KEY = 'bililist.ui.v1';
  var MIGRATE_KEY = 'bililist.migrated.';

  /* When a Supabase session is active, this is the source of truth. The
     localStorage prototype state is only used for demo / offline mode. */
  var cloud = {
    active: false,
    ready: false,
    loading: false,
    userId: null,
    workspaceId: null,
    workspace: null,
    channel: null,
    channelSeq: 0,
    realtime: 'off',
    refreshTimer: null,
    refreshing: false,
    lastWriteAt: 0
  };

  /* ------------------------------------------------------------------ util */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function icon(name, cls) {
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '"><use href="#i-' + name + '"/></svg>';
  }
  function peso(n) { return '₱' + Number(n).toLocaleString('en-PH'); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MON_LEAD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  function longDate(d) { return DOW[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function shortDate(d) { return DOW_SHORT[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3); }
  function monthLabel(d) { return MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }

  function memberById(id) {
    for (var i = 0; i < state.members.length; i++) if (state.members[i].id === id) return state.members[i];
    return { initials: '?', name: 'Unknown', role: 'Viewer' };
  }

  /* ----------------------------------------------------------------- state */
  var state = {
    route: 'dashboard',
    signedIn: false,
    user: null,
    workspaces: [],
    lists: JSON.parse(JSON.stringify(D.lists)),
    lifeAdmin: JSON.parse(JSON.stringify(D.lifeAdmin)),
    events: JSON.parse(JSON.stringify(D.events)),
    activity: JSON.parse(JSON.stringify(D.activity)),
    members: JSON.parse(JSON.stringify(D.members)),
    categories: JSON.parse(JSON.stringify(D.categories)),
    inventory: JSON.parse(JSON.stringify(D.pantry)),
    pending: [],
    activeListId: null,
    activeAisleTab: 'tobuy',
    spendingRange: 'w1',
    calMonth: new Date(D.TODAY.getFullYear(), D.TODAY.getMonth(), 1),
    selectedDay: D.iso(D.TODAY),
    addCategory: 'auto',
    addQty: { n: 1, u: 'pcs' },
    addQtyTouched: false,
    editUnit: 'pcs',
    listQuery: '',
    addModal: { open: false, step: 'search', query: '', draft: null },
    editingId: null,
    catPanelOpen: false,
    expandedCats: {}
  };

  /* ------------------------------------------------------- account boot-up */
  function initialsOf(name) {
    var parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    var first = parts[0].charAt(0);
    var second = parts.length > 1 ? parts[parts.length - 1].charAt(0) : (parts[0].charAt(1) || '');
    return (first + second).toUpperCase();
  }

  function prettyName(raw) {
    var pretty = String(raw || '').replace(/[._-]+/g, ' ').trim().replace(/\s+/g, ' ') || 'You';
    return pretty.replace(/\b[a-z]/g, function (ch) { return ch.toUpperCase(); });
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
  }

  /* There are no demo accounts any more: the household, its members and the
     greeting are all derived from whoever is signed in. */
  function applyUser(user) {
    state.user = user || null;

    var email = (user && user.email) || '';
    var meta = (user && user.user_metadata) || {};
    var raw = meta.username || meta.full_name || (email ? email.split('@')[0] : 'You');
    var pretty = prettyName(raw);

    state.members = [{
      id: 'me',
      name: pretty,
      email: email,
      initials: initialsOf(pretty),
      role: 'Owner',
      online: true,
      you: true
    }];

    state.workspaces = [{
      id: 'w1',
      name: pretty.split(' ')[0] + "'s household",
      sub: "1 member · You're the owner",
      icon: 'house',
      active: true
    }];

    ensureStarterState();
  }

  /* everybody needs at least one list to land on */
  function ensureStarterState() {
    if (!state.lists.length) {
      state.lists = [{
        id: 'l1',
        name: 'My first list',
        kind: 'grocery',
        icon: 'cart',
        tint: 'green',
        shared: true,
        items: []
      }];
    }
    var found = false;
    for (var i = 0; i < state.lists.length; i++) {
      if (state.lists[i].id === state.activeListId) found = true;
    }
    if (!found) state.activeListId = state.lists[0].id;
  }

  function you() {
    for (var i = 0; i < state.members.length; i++) {
      if (state.members[i].you) return state.members[i];
    }
    return state.members[0] || { id: 'me', name: 'You', email: '', initials: '?', role: 'Owner', you: true };
  }

  /* ------------------------------------------------------- category helpers */
  function catById(id) {
    for (var i = 0; i < state.categories.length; i++) {
      if (state.categories[i].id === id) return state.categories[i];
    }
    return null;
  }
  function catName(id, fallback) {
    var c = catById(id);
    return c ? c.name : (fallback || 'Other');
  }
  function catTone(id) {
    var c = catById(id);
    return c ? (c.tone || 'grey') : 'grey';
  }
  function otherCatId() {
    var c = catById('other');
    if (c) return c.id;
    /* Cloud categories use UUID ids, so also look for the category by name. */
    for (var i = 0; i < state.categories.length; i++) {
      if (String(state.categories[i].name || '').toLowerCase() === 'other') return state.categories[i].id;
    }
    return state.categories[0] ? state.categories[0].id : 'other';
  }
  /* longest keyword wins, so "dish soap" beats "soap" */
  function guessCategory(name) {
    var n = String(name || '').toLowerCase();
    var best = null;
    state.categories.forEach(function (c) {
      (c.keywords || []).forEach(function (k) {
        if (k && n.indexOf(k.toLowerCase()) !== -1) {
          if (!best || k.length > best.len) best = { id: c.id, len: k.length };
        }
      });
    });
    return best ? best.id : otherCatId();
  }
  /* the category a new item will land in right now */
  function targetCategory() {
    return state.addCategory === 'auto' ? null : state.addCategory;
  }
  function targetCategoryLabel() {
    if (state.addCategory === 'auto') return 'Auto';
    return catName(state.addCategory);
  }

  /* ---------------------------------------------------------- unit helpers */
  var UNIT_INDEX = null;
  function unitIndex() {
    if (UNIT_INDEX) return UNIT_INDEX;
    UNIT_INDEX = {};
    D.units.forEach(function (g) {
      g.units.forEach(function (u) {
        UNIT_INDEX[u.k.toLowerCase()] = u.k;
        UNIT_INDEX[u.l.toLowerCase()] = u.k;
      });
    });
    return UNIT_INDEX;
  }
  function unitLabel(k) {
    var key = unitIndex()[String(k || '').toLowerCase()] || k;
    for (var i = 0; i < D.units.length; i++) {
      for (var j = 0; j < D.units[i].units.length; j++) {
        if (D.units[i].units[j].k === key) return D.units[i].units[j].l;
      }
    }
    return k || '';
  }
  /* the full definition (limits + step) for a unit */
  function unitDef(k) {
    var key = unitIndex()[String(k || '').toLowerCase()] || k;
    for (var i = 0; i < D.units.length; i++) {
      for (var j = 0; j < D.units[i].units.length; j++) {
        if (D.units[i].units[j].k === key) return D.units[i].units[j];
      }
    }
    return { k: key, l: key, min: 1, max: 99, step: 1 };
  }
  /* validate an amount against its unit. No letters, no nonsense ranges. */
  function validateQty(raw, unitKey) {
    var u = unitDef(unitKey);
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return { ok: false, msg: 'Enter how many you need.' };
    if (/[a-z]/i.test(s)) return { ok: false, msg: 'Numbers only — no letters.' };
    if (!/^\d*\.?\d+$/.test(s)) return { ok: false, msg: 'Enter a number, e.g. 2 or 1.5.' };
    var n = parseFloat(s);
    if (isNaN(n)) return { ok: false, msg: 'Enter a number, e.g. 2 or 1.5.' };
    if (n <= 0) return { ok: false, msg: 'Must be more than 0.' };
    if (n < u.min) return { ok: false, msg: 'Minimum is ' + unitQty(u, u.min) + '.' };
    if (n > u.max) return { ok: false, msg: 'Maximum is ' + unitQty(u, u.max) + ' in one trip.' };
    return { ok: true, n: n, msg: '' };
  }
  /* a sensible example amount for this unit */
  function unitExample(u) {
    if (u.k === 'kg') return '1.5 kg';
    if (u.k === 'g') return '250 g';
    if (u.k === 'L') return '1.5 L';
    if (u.k === 'ml') return '500 ml';
    return '2 ' + u.l;
  }
  /* "1 bottle" / "24 bottles" */
  function unitQty(u, n) {
    var l = u.l;
    if (n === 1) return '1 ' + l;
    if (/^(kg|g|L|ml|pcs)$/.test(l)) return n + ' ' + l;
    if (/(s|x|ch|sh)$/.test(l)) return n + ' ' + l + 'es';
    if (/[^s]$/.test(l)) return n + ' ' + l + 's';
    return n + ' ' + l;
  }
  /* a flat row of unit chips — no native dropdown, so nothing can overflow */
  function unitPicker(selected, id) {
    return '<div class="unit-picker" id="' + id + '">' + D.units.map(function (g) {
      return '<div class="up-group">' +
        '<span class="up-label">' + esc(g.group) + '</span>' +
        '<div class="up-chips">' + g.units.map(function (u) {
          return '<button type="button" class="unit-chip' + (u.k === selected ? ' is-active' : '') + '" data-unit="' + u.k + '">' + esc(u.l) + '</button>';
        }).join('') + '</div>' +
      '</div>';
    }).join('') + '</div>';
  }
  /* {n: 2, u: 'pcs'} -> "2 pcs" */
  function qtyText(q) {
    if (q == null) return '';
    if (typeof q === 'string') return q;
    return unitQty(unitDef(q.u), q.n);
  }
  /* "250 g" -> {n: 250, u: 'g'} */
  function parseQty(str) {
    var m = String(str == null ? '' : str).trim().match(/^([\d]*\.?\d+)\s*(.*)$/);
    if (!m) return { n: 1, u: 'pcs' };
    var rest = (m[2] || '').trim();
    var u = unitIndex()[rest.toLowerCase()] || (rest || 'pcs');
    var n = parseFloat(m[1]);
    return { n: isNaN(n) ? 1 : n, u: u };
  }

  /* ------------------------------------------------------------ suggestions */
  function scoreMatch(query, fields) {
    if (!query) return 0;
    var q = query.toLowerCase();
    var best = 0;
    fields.forEach(function (f) {
      var v = String(f || '').toLowerCase();
      if (!v) return;
      if (v === q) best = Math.max(best, 100);
      else if (v.indexOf(q) === 0) best = Math.max(best, 70);
      else if (v.indexOf(q) !== -1) best = Math.max(best, 50);
      else {
        v.split(/[\s,\-]+/).forEach(function (w) {
          if (w === q) best = Math.max(best, 40);
          else if (w.indexOf(q) === 0) best = Math.max(best, 25);
        });
      }
    });
    return best;
  }

  function suggestionsFor(query, catFilter) {
    var q = query.trim();
    var inCat = function (c) { return !catFilter || catFilter === 'auto' || c === catFilter; };

    var history = D.history.map(function (h) {
      return {
        name: h.name, cat: h.cat, n: h.n, u: h.u,
        meta: 'bought ' + h.times + '× · ' + h.when,
        score: scoreMatch(q, [h.name, h.cat, h.u])
      };
    }).filter(function (h) { return inCat(h.cat) && h.score > 0; })
      .sort(function (a, b) { return b.score - a.score; });

    var catalogue = D.catalogue.map(function (c) {
      return {
        name: c.name, cat: c.cat, n: c.n, u: c.u,
        meta: c.alt || '',
        score: scoreMatch(q, [c.name, c.alt, c.cat, c.u])
      };
    }).filter(function (c) { return inCat(c.cat) && c.score > 0; })
      .sort(function (a, b) { return b.score - a.score; });

    /* already on the active list */
    var list = activeList();
    var onList = list.items.map(function (it) {
      return {
        name: it.name, cat: it.cat, n: it.qty.n, u: it.qty.u,
        meta: it.done ? 'already bought' : 'already on this list',
        score: scoreMatch(q, [it.name])
      };
    }).filter(function (o) { return inCat(o.cat) && o.score > 0; });

    /* no query yet → show what this household buys most often */
    if (!q) {
      history = D.history.slice().sort(function (a, b) { return b.times - a.times; })
        .filter(function (h) { return inCat(h.cat); }).slice(0, 5)
        .map(function (h) {
          return { name: h.name, cat: h.cat, n: h.n, u: h.u, meta: 'bought ' + h.times + '× · ' + h.when, score: 0 };
        });
      catalogue = [];
    }

    /* de-dupe by name, keeping the best entry */
    var seen = {}, merged = [];
    history.concat(onList, catalogue).forEach(function (s) {
      var k = s.name.toLowerCase();
      if (seen[k]) return;
      seen[k] = true;
      merged.push(s);
    });
    return { history: merged.slice(0, 6), all: merged };
  }

  /* the sensible default amount + unit for something the user is typing */
  function defaultQtyFor(name) {
    var res = suggestionsFor(name, null);
    if (res.all.length) {
      var s = res.all[0];
      return { n: s.n, u: s.u };
    }
    return { n: 1, u: 'pc' };
  }

  function readUiState() {
    try {
      return JSON.parse(localStorage.getItem(UI_KEY) || '{}') || {};
    } catch (e) { return {}; }
  }

  function saveUiState() {
    try {
      localStorage.setItem(UI_KEY, JSON.stringify({
        activeListId: state.activeListId,
        route: state.route,
        spendingRange: state.spendingRange
      }));
    } catch (e) { /* storage may be unavailable */ }
  }

  function save() {
    /* Signed-in users are persisted in Supabase. Only keep a little UI
       preference locally so a refresh can reopen the same list. */
    if (cloud.active) {
      saveUiState();
      return;
    }
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        signedIn: state.signedIn,
        lists: state.lists,
        lifeAdmin: state.lifeAdmin,
        events: state.events,
        members: state.members,
        categories: state.categories,
        inventory: state.inventory,
        pending: state.pending,
        activeListId: state.activeListId
      }));
    } catch (e) { /* prototype: storage may be unavailable */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (data.lists) state.lists = data.lists;
      if (data.lifeAdmin) state.lifeAdmin = data.lifeAdmin;
      if (data.events) state.events = data.events;
      if (data.members) state.members = data.members;
      if (data.categories) state.categories = data.categories;
      if (data.inventory) state.inventory = data.inventory;
      if (data.pending) state.pending = data.pending;
      if (data.activeListId) state.activeListId = data.activeListId;
      state.signedIn = !!data.signedIn;
      migrateItems();
    } catch (e) { /* ignore malformed state */ }
  }

  /* Older saves stored the aisle as a label and the quantity as free text.
     Move them onto category ids and {n, u} quantity objects. */
  function migrateItems() {
    state.lists.forEach(function (l) {
      l.items.forEach(function (it) {
        if (!it.cat) {
          var match = null;
          state.categories.forEach(function (c) {
            if (c.name.toLowerCase() === String(it.aisle || '').toLowerCase()) match = c.id;
          });
          it.cat = match || otherCatId();
        }
        if (typeof it.qty === 'string') it.qty = parseQty(it.qty);
        if (!it.qty || typeof it.qty !== 'object') it.qty = { n: 1, u: 'pcs' };
        if (it.qty.u === 'run') it.qty.u = 'pcs';
      });
    });
    state.inventory.forEach(function (p) {
      if (typeof p.qty === 'string') p.qty = parseQty(p.qty);
      if (!p.qty || typeof p.qty !== 'object') p.qty = { n: 1, u: 'pcs' };
      if (!p.cat) p.cat = guessCategory(p.name);
    });
  }

  function resetDemo() {
    localStorage.removeItem(STORE_KEY);
    localStorage.removeItem(UI_KEY);
    location.reload();
  }

  /* ======================================================================
     SUPABASE DATA STORE
     ----------------------------------------------------------------------
     Signed-in accounts read and write the shared workspace in Supabase:
       To Buy / Pantry  -> public.items (done = false / true)
       Inventory        -> public.pantry
       Lists            -> public.lists
       Categories       -> public.categories
     localStorage is only used in demo mode, or as a one-time import source.
     ====================================================================== */
  function cloudMode() { return !!(cloud.active && S.client); }

  function cloudData(res, label) {
    if (!res || res.error) {
      var err = (res && res.error) || new Error('Could not load ' + (label || 'data'));
      throw err;
    }
    return res.data || [];
  }

  function cloudError(prefix, err) {
    console.error(prefix, err);
    var detail = err && (err.message || err.error_description || err.details || err.hint);
    toast(prefix + (detail ? ' — ' + detail : ''));
  }

  function cloudListVisual(kind) {
    if (kind === 'tasks') return { icon: 'tasks', tint: 'gold' };
    if (kind === 'event') return { icon: 'cake', tint: 'blue' };
    if (kind === 'inventory') return { icon: 'box', tint: 'navy' };
    return { icon: 'cart', tint: 'green' };
  }

  function mapCloudCategory(row) {
    return {
      id: row.id,
      name: row.name,
      tone: row.tone || 'grey',
      custom: !!row.is_custom,
      keywords: row.keywords || [],
      sort_order: Number(row.sort_order) || 0
    };
  }

  function mapCloudItem(row) {
    var cat = row.category_id || otherCatId();
    return {
      id: row.id,
      name: row.name,
      qty: { n: Number(row.qty_amount) || 1, u: row.qty_unit || 'pcs' },
      cat: cat,
      aisle: catName(cat),
      owner: row.assigned_to === cloud.userId ? 'me' : (row.assigned_to || 'me'),
      done: !!row.done,
      boughtAt: row.bought_at || null,
      pantryAdded: null
    };
  }

  function mapCloudPantry(row) {
    var cat = row.category_id || guessCategory(row.name);
    return {
      id: row.id,
      name: row.name,
      qty: { n: Number(row.qty_amount) || 1, u: row.qty_unit || 'pcs' },
      cat: cat,
      expiry: row.expiry || 'On the shelf',
      level: row.level || 'full'
    };
  }

  function mapCloudList(row, items) {
    var visual = cloudListVisual(row.kind);
    return {
      id: row.id,
      name: row.name,
      kind: row.kind || 'grocery',
      icon: visual.icon,
      tint: visual.tint,
      shared: row.is_shared !== false,
      items: items || []
    };
  }

  function capRole(role) {
    var r = String(role || 'viewer').toLowerCase();
    return r.charAt(0).toUpperCase() + r.slice(1);
  }

  function mapCloudMembers(rows, profiles, user) {
    var byId = {};
    (profiles || []).forEach(function (p) { byId[p.id] = p; });
    var list = (rows || []).map(function (m) {
      var p = byId[m.user_id] || {};
      var isYou = m.user_id === user.id;
      var name = prettyName(p.full_name || p.username || (isYou ? user.email : 'Member'));
      return {
        id: isYou ? 'me' : m.user_id,
        name: name,
        email: isYou ? (user.email || '') : '',
        initials: initialsOf(name),
        role: capRole(m.role),
        online: !!m.online,
        you: isYou
      };
    });
    if (!list.some(function (m) { return m.you; })) {
      var name = prettyName(user.email || 'You');
      list.unshift({
        id: 'me',
        name: name,
        email: user.email || '',
        initials: initialsOf(name),
        role: 'Owner',
        online: true,
        you: true
      });
    }
    return list;
  }

  function ensureCloudWorkspace(user) {
    return S.client.rpc('ensure_user_workspace').then(function (r) {
      if (r.error) throw r.error;
      var wsId = r.data;
      if (!wsId) throw new Error('No workspace returned');
      return S.client.from('workspaces').select('*').eq('id', wsId).single().then(function (wr) {
        if (wr.error) throw wr.error;
        return wr.data;
      });
    }).catch(function (rpcError) {
      /* If the RPC has not been deployed yet, fall back to an existing
         membership. This keeps older databases usable until schema.sql is run. */
      return S.client.from('workspace_members')
        .select('workspace_id, workspaces(*)')
        .eq('user_id', user.id)
        .limit(1)
        .then(function (r) {
          if (r.error) throw rpcError;
          var row = (r.data || [])[0];
          if (!row || !row.workspaces) throw rpcError;
          return row.workspaces;
        });
    });
  }

  function fetchCloudSnapshot(user, knownWorkspace) {
    var start = knownWorkspace ? Promise.resolve(knownWorkspace) : ensureCloudWorkspace(user);
    return start.then(function (workspace) {
      cloud.workspace = workspace;
      cloud.workspaceId = workspace.id;
      return Promise.all([
        S.client.from('categories').select('*').eq('workspace_id', workspace.id).order('sort_order', { ascending: true }),
        S.client.from('lists').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: true }),
        S.client.from('pantry').select('*').eq('workspace_id', workspace.id).order('name', { ascending: true }),
        S.client.from('workspace_members').select('user_id, role, online, joined_at').eq('workspace_id', workspace.id)
      ]).then(function (res) {
        var categories = cloudData(res[0], 'categories');
        var lists = cloudData(res[1], 'lists');
        var pantry = cloudData(res[2], 'pantry');
        var members = cloudData(res[3], 'members');

        /* An account should always have somewhere to put an item. */
        var listsPromise = lists.length
          ? Promise.resolve(lists)
          : S.client.from('lists')
              .insert({ workspace_id: workspace.id, name: 'The weekly shop', kind: 'grocery' })
              .select('*').single()
              .then(function (lr) {
                if (lr.error) throw lr.error;
                return [lr.data];
              });

        return listsPromise.then(function (finalLists) {
          var listIds = finalLists.map(function (l) { return l.id; });
          var itemsPromise = listIds.length
            ? S.client.from('items').select('*').in('list_id', listIds).order('created_at', { ascending: true })
            : Promise.resolve({ data: [], error: null });

          return itemsPromise.then(function (ir) {
            var items = cloudData(ir, 'items');
            var memberIds = members.map(function (m) { return m.user_id; });
            var profilesPromise = memberIds.length
              ? S.client.from('profiles').select('id, username, full_name, avatar').in('id', memberIds)
              : Promise.resolve({ data: [], error: null });

            return profilesPromise.then(function (pr) {
              return {
                workspace: workspace,
                categories: categories,
                lists: finalLists,
                pantry: pantry,
                items: items,
                members: members,
                profiles: cloudData(pr, 'profiles')
              };
            });
          });
        });
      });
    });
  }

  function applyCloudSnapshot(snapshot) {
    state.categories = snapshot.categories.length
      ? snapshot.categories.map(mapCloudCategory)
      : JSON.parse(JSON.stringify(D.categories));

    state.inventory = snapshot.pantry.map(mapCloudPantry);
    state.members = mapCloudMembers(snapshot.members, snapshot.profiles, state.user);

    var memberCount = state.members.length;
    state.workspaces = [{
      id: snapshot.workspace.id,
      name: snapshot.workspace.name,
      sub: memberCount + ' member' + (memberCount === 1 ? '' : 's') + " · You're the owner",
      icon: snapshot.workspace.kind === 'friend_group' ? 'friends' : 'house',
      active: true
    }];

    var byList = {};
    snapshot.items.forEach(function (row) {
      if (!byList[row.list_id]) byList[row.list_id] = [];
      byList[row.list_id].push(mapCloudItem(row));
    });
    state.lists = snapshot.lists.map(function (row) {
      return mapCloudList(row, byList[row.id] || []);
    });

    ensureStarterState();
    var ui = readUiState();
    if (ui.activeListId) {
      for (var i = 0; i < state.lists.length; i++) {
        if (state.lists[i].id === ui.activeListId) { state.activeListId = ui.activeListId; break; }
      }
    }

    cloud.workspace = snapshot.workspace;
    cloud.workspaceId = snapshot.workspace.id;
    cloud.active = true;
    cloud.ready = true;

    /* Cloud data is authoritative. Remove the old prototype blob so a stale
       To Buy / Pantry copy is never left behind in this browser. */
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
  }

  function localCategoryName(cat) {
    var c = catById(cat);
    if (c) return c.name;
    for (var i = 0; i < D.categories.length; i++) {
      if (D.categories[i].id === cat) return D.categories[i].name;
    }
    return '';
  }

  function mappedCategoryId(cat, byName) {
    if (isUuid(cat) && catById(cat)) return cat;
    var name = localCategoryName(cat);
    if (name && byName[name.toLowerCase()]) return byName[name.toLowerCase()];
    return byName.other || null;
  }

  /* Normal writes use the UUIDs already in state.categories. This also handles
     old slug ids left in a browser save. */
  function categoryIdFor(cat) {
    var byName = {};
    state.categories.forEach(function (c) { byName[String(c.name || '').toLowerCase()] = c.id; });
    return mappedCategoryId(cat, byName);
  }

  function markMigrated(userId) {
    try { localStorage.setItem(MIGRATE_KEY + userId, '1'); } catch (e) { /* ignore */ }
  }

  function alreadyMigrated(userId) {
    try { return localStorage.getItem(MIGRATE_KEY + userId) === '1'; } catch (e) { return false; }
  }

  /* One-time import of the old localStorage prototype data. It only runs when
     the cloud workspace is still empty, so it can never overwrite real data. */
  function maybeMigrateLocal(user, snapshot) {
    if (alreadyMigrated(user.id)) return Promise.resolve(false);

    var localItems = [];
    state.lists.forEach(function (l) {
      (l.items || []).forEach(function (it) { localItems.push({ list: l, item: it }); });
    });
    var localPantry = state.inventory.slice();

    if (!localItems.length && !localPantry.length) {
      markMigrated(user.id);
      return Promise.resolve(false);
    }
    if (snapshot.items.length || snapshot.pantry.length) {
      markMigrated(user.id);
      return Promise.resolve(false);
    }

    var byName = {};
    snapshot.categories.forEach(function (c) { byName[String(c.name || '').toLowerCase()] = c.id; });

    var chain = Promise.resolve();
    state.categories.forEach(function (c) {
      if (byName[String(c.name || '').toLowerCase()]) return;
      chain = chain.then(function () {
        return S.client.from('categories').insert({
          workspace_id: snapshot.workspace.id,
          name: c.name,
          tone: c.tone || 'grey',
          keywords: c.keywords || [],
          is_custom: true,
          sort_order: 100
        }).select('*').single().then(function (r) {
          if (r.error) throw r.error;
          byName[String(r.data.name || '').toLowerCase()] = r.data.id;
        });
      });
    });

    var emptyCloudLists = snapshot.lists.filter(function (l) {
      return !snapshot.items.some(function (it) { return it.list_id === l.id; });
    });

    return chain.then(function () {
      var plans = [];
      var used = {};
      state.lists.forEach(function (localList, index) {
        var target = null;
        if (index === 0 && emptyCloudLists.length && !used[emptyCloudLists[0].id]) {
          target = emptyCloudLists[0];
          used[target.id] = true;
        }
        plans.push({ local: localList, cloud: target });
      });

      var listChain = Promise.resolve();
      plans.forEach(function (plan) {
        listChain = listChain.then(function () {
          if (plan.cloud) {
            return S.client.from('lists').update({
              name: plan.local.name,
              kind: plan.local.kind || 'grocery'
            }).eq('id', plan.cloud.id).select('*').single().then(function (r) {
              if (r.error) throw r.error;
              plan.cloud = r.data;
            });
          }
          return S.client.from('lists').insert({
            workspace_id: snapshot.workspace.id,
            name: plan.local.name,
            kind: plan.local.kind || 'grocery'
          }).select('*').single().then(function (r) {
            if (r.error) throw r.error;
            plan.cloud = r.data;
          });
        });
      });

      return listChain.then(function () {
        var itemChain = Promise.resolve();
        plans.forEach(function (plan) {
          (plan.local.items || []).forEach(function (item) {
            itemChain = itemChain.then(function () {
              return S.client.from('items').insert({
                list_id: plan.cloud.id,
                name: item.name,
                category_id: mappedCategoryId(item.cat, byName),
                qty_amount: item.qty.n,
                qty_unit: item.qty.u,
                done: !!item.done,
                assigned_to: user.id
              });
            }).then(function (r) {
              if (r.error) throw r.error;
            });
          });
        });

        return itemChain.then(function () {
          var pantryChain = Promise.resolve();
          localPantry.forEach(function (p) {
            pantryChain = pantryChain.then(function () {
              return S.client.from('pantry')
                .select('id, qty_amount, qty_unit')
                .eq('workspace_id', snapshot.workspace.id)
                .ilike('name', p.name)
                .limit(1)
                .then(function (r) {
                  if (r.error) throw r.error;
                  var existing = (r.data || [])[0];
                  var payload = {
                    workspace_id: snapshot.workspace.id,
                    name: p.name,
                    category_id: mappedCategoryId(p.cat, byName),
                    qty_amount: p.qty.n,
                    qty_unit: p.qty.u,
                    expiry: p.expiry || 'On the shelf',
                    level: p.level || 'full'
                  };
                  if (existing) {
                    return S.client.from('pantry').update(payload).eq('id', existing.id);
                  }
                  return S.client.from('pantry').insert(payload);
                });
            }).then(function (r) {
              if (r.error) throw r.error;
            });
          });

          return pantryChain.then(function () {
            markMigrated(user.id);
            try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
            toast('Your local lists were copied to your account.');
            return true;
          });
        });
      });
    }).catch(function (err) {
      console.warn('Local data migration skipped', err);
      return false;
    });
  }

  function hydrateCloud(user) {
    cloud.active = true;
    cloud.loading = true;
    cloud.userId = user.id;
    cloud.ready = false;

    return fetchCloudSnapshot(user).then(function (snapshot) {
      return maybeMigrateLocal(user, snapshot).then(function (migrated) {
        return migrated ? fetchCloudSnapshot(user) : snapshot;
      });
    }).then(function (snapshot) {
      applyCloudSnapshot(snapshot);
      cloud.loading = false;
      try { startRealtime(); } catch (e) { console.warn('Realtime unavailable', e); }
      return snapshot;
    }).catch(function (err) {
      stopRealtime();
      cloud.loading = false;
      cloud.active = false;
      cloud.ready = false;
      throw err;
    });
  }

  /* ---------------------------------------------------------- realtime sync */
  /* Changes from another device (or another tab) arrive here. They are
     debounced into one snapshot fetch and postponed while the user is typing
     or has a dialog open, so a background refresh never closes an editor. */
  function noteCloudWrite() {
    cloud.lastWriteAt = Date.now();
  }

  function realtimeBusy() {
    if (document.querySelector('#add-modal.show') ||
        document.querySelector('#cat-modal.show') ||
        document.querySelector('#drawer.show') ||
        document.querySelector('#profile-menu.show') ||
        document.querySelector('.item-pop')) {
      return true;
    }
    var ae = document.activeElement;
    return !!(ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName));
  }

  function liveBadgeHtml() {
    if (!cloud.active || cloud.realtime === 'off') return '';
    var live = cloud.realtime === 'SUBSCRIBED';
    return '<span class="live-badge' + (live ? ' is-live' : '') + '" id="live-badge"' +
      ' title="' + (live ? 'Live — changes appear on every device' : 'Connecting to live sync…') + '">' +
      '<i></i><span>' + (live ? 'Live' : 'Connecting') + '</span></span>';
  }

  function updateLiveBadge() {
    var badge = document.getElementById('live-badge');
    if (!badge) return;
    if (cloud.realtime === 'off') { badge.style.display = 'none'; return; }
    badge.style.display = '';
    var live = cloud.realtime === 'SUBSCRIBED';
    badge.classList.toggle('is-live', live);
    badge.setAttribute('title', live ? 'Live — changes appear on every device' : 'Connecting to live sync…');
    var label = badge.querySelector('span');
    if (label) label.textContent = live ? 'Live' : 'Connecting';
  }

  function realtimeRelevant(payload) {
    var row = (payload.new && Object.keys(payload.new).length) ? payload.new : (payload.old || {});
    var i, j;

    if (payload.table === 'items') {
      if (payload.eventType === 'DELETE') {
        for (i = 0; i < state.lists.length; i++) {
          for (j = 0; j < state.lists[i].items.length; j++) {
            if (state.lists[i].items[j].id === row.id) return true;
          }
        }
        return false;
      }
      for (i = 0; i < state.lists.length; i++) {
        if (state.lists[i].id === row.list_id) return true;
      }
      return false;
    }

    if (payload.table === 'lists') {
      if (payload.eventType === 'DELETE') {
        for (i = 0; i < state.lists.length; i++) if (state.lists[i].id === row.id) return true;
        return false;
      }
      return row.workspace_id === cloud.workspaceId;
    }

    if (payload.table === 'pantry') {
      if (payload.eventType === 'DELETE') {
        for (i = 0; i < state.inventory.length; i++) if (state.inventory[i].id === row.id) return true;
        return false;
      }
      return row.workspace_id === cloud.workspaceId;
    }

    if (payload.table === 'categories') {
      if (payload.eventType === 'DELETE') {
        for (i = 0; i < state.categories.length; i++) if (state.categories[i].id === row.id) return true;
        return false;
      }
      return row.workspace_id === cloud.workspaceId;
    }

    if (payload.table === 'workspace_members') {
      return row.workspace_id === cloud.workspaceId;
    }

    return false;
  }

  function onRealtimeEvent(payload) {
    if (!cloud.active || !payload || !realtimeRelevant(payload)) return;
    queueCloudRefresh();
  }

  function queueCloudRefresh() {
    if (!cloud.active || !S.client) return;
    var wait = 250;
    var sinceWrite = Date.now() - (cloud.lastWriteAt || 0);
    if (sinceWrite < 900) wait = 900 - sinceWrite;
    clearTimeout(cloud.refreshTimer);
    cloud.refreshTimer = setTimeout(runCloudRefresh, wait);
  }

  function runCloudRefresh() {
    if (!cloud.active || !S.client) return;
    if (cloud.refreshing) {
      cloud.refreshTimer = setTimeout(runCloudRefresh, 400);
      return;
    }
    if (realtimeBusy()) {
      cloud.refreshTimer = setTimeout(runCloudRefresh, 700);
      return;
    }
    cloud.refreshing = true;
    Promise.resolve()
      .then(function () {
        return fetchCloudSnapshot(state.user || { id: cloud.userId }, cloud.workspace);
      })
      .then(function (snapshot) {
        if (!cloud.active || !state.signedIn) return;
        applyCloudSnapshot(snapshot);
        render();
      })
      .catch(function (err) {
        console.warn('Realtime refresh skipped', err);
      })
      .then(function () {
        cloud.refreshing = false;
      });
  }

  function stopRealtime() {
    if (cloud.refreshTimer) {
      clearTimeout(cloud.refreshTimer);
      cloud.refreshTimer = null;
    }
    var channel = cloud.channel;
    cloud.channel = null;
    cloud.realtime = 'off';
    if (channel && S.client) {
      try { S.client.removeChannel(channel); } catch (e) { /* ignore */ }
    }
    updateLiveBadge();
  }

  function startRealtime() {
    stopRealtime();
    if (!S.client || typeof S.client.channel !== 'function' || !cloud.active || !cloud.workspaceId) return;

    try {
      cloud.channelSeq += 1;
      var channel = S.client.channel('bililist-ws-' + cloud.workspaceId + '-' + cloud.channelSeq);
      ['items', 'lists', 'pantry', 'categories', 'workspace_members'].forEach(function (table) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table: table }, onRealtimeEvent);
      });

      cloud.channel = channel;
      cloud.realtime = 'connecting';
      updateLiveBadge();

      channel.subscribe(function (status) {
        if (cloud.channel !== channel) return;
        cloud.realtime = status;
        updateLiveBadge();
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setTimeout(function () {
            if (cloud.active && cloud.channel === channel) startRealtime();
          }, 4000);
        }
      });
    } catch (e) {
      console.warn('Realtime unavailable', e);
      stopRealtime();
    }
  }

  function cloudInsertItem(listId, item) {
    noteCloudWrite();
    return S.client.from('items').insert({
      list_id: listId,
      name: item.name,
      category_id: categoryIdFor(item.cat),
      qty_amount: item.qty.n,
      qty_unit: item.qty.u,
      done: !!item.done,
      assigned_to: cloud.userId
    }).select('*').single().then(function (r) {
      if (r.error) throw r.error;
      return mapCloudItem(r.data);
    });
  }

  function cloudUpdateItem(item) {
    noteCloudWrite();
    return S.client.from('items').update({
      name: item.name,
      category_id: categoryIdFor(item.cat),
      qty_amount: item.qty.n,
      qty_unit: item.qty.u
    }).eq('id', item.id).select('*').single().then(function (r) {
      if (r.error) throw r.error;
      return mapCloudItem(r.data);
    });
  }

  function cloudToggleItem(item, done) {
    noteCloudWrite();
    return S.client.from('items').update({ done: done }).eq('id', item.id).select('*').single().then(function (r) {
      if (r.error) throw r.error;
      return mapCloudItem(r.data);
    });
  }

  function cloudDeleteItem(item) {
    noteCloudWrite();
    return S.client.from('items').delete().eq('id', item.id).then(function (r) {
      if (r.error) throw r.error;
      return true;
    });
  }

  function cloudRefreshPantry() {
    if (!cloud.active) return Promise.resolve();
    return S.client.from('pantry')
      .select('*')
      .eq('workspace_id', cloud.workspaceId)
      .order('name', { ascending: true })
      .then(function (r) {
        if (r.error) throw r.error;
        state.inventory = (r.data || []).map(mapCloudPantry);
      });
  }

  function cloudInsertList(name, kind) {
    noteCloudWrite();
    return S.client.from('lists').insert({
      workspace_id: cloud.workspaceId,
      name: name,
      kind: kind || 'grocery'
    }).select('*').single().then(function (r) {
      if (r.error) throw r.error;
      return mapCloudList(r.data, []);
    });
  }

  function cloudInsertCategory(cat) {
    noteCloudWrite();
    var maxOrder = 0;
    state.categories.forEach(function (c) { maxOrder = Math.max(maxOrder, Number(c.sort_order) || 0); });
    return S.client.from('categories').insert({
      workspace_id: cloud.workspaceId,
      name: cat.name,
      tone: cat.tone || 'green',
      keywords: cat.keywords || [],
      is_custom: true,
      sort_order: maxOrder + 1
    }).select('*').single().then(function (r) {
      if (r.error) throw r.error;
      return mapCloudCategory(r.data);
    });
  }

  function cloudUpdateCategory(cat) {
    noteCloudWrite();
    return S.client.from('categories').update({
      name: cat.name,
      tone: cat.tone || 'grey',
      keywords: cat.keywords || []
    }).eq('id', cat.id).then(function (r) {
      if (r.error) throw r.error;
      return true;
    });
  }

  function cloudDeleteCategory(id, fallbackId) {
    noteCloudWrite();
    var chain = Promise.resolve();
    if (fallbackId) {
      chain = chain
        .then(function () { return S.client.from('items').update({ category_id: fallbackId }).eq('category_id', id); })
        .then(function (r) { if (r.error) throw r.error; })
        .then(function () { return S.client.from('pantry').update({ category_id: fallbackId }).eq('category_id', id); })
        .then(function (r) { if (r.error) throw r.error; });
    }
    return chain.then(function () {
      return S.client.from('categories').delete().eq('id', id);
    }).then(function (r) {
      if (r.error) throw r.error;
      return true;
    });
  }

  function cloudAddPantry(entry) {
    noteCloudWrite();
    return S.client.from('pantry')
      .select('id, qty_amount, qty_unit')
      .eq('workspace_id', cloud.workspaceId)
      .ilike('name', entry.name)
      .limit(1)
      .then(function (r) {
        if (r.error) throw r.error;
        var existing = (r.data || [])[0];
        var qty = { n: entry.qty.n, u: entry.qty.u };
        if (existing && existing.qty_unit === entry.qty.u) {
          qty.n = Number(existing.qty_amount) + entry.qty.n;
        }
        var payload = {
          workspace_id: cloud.workspaceId,
          name: entry.name,
          category_id: categoryIdFor(entry.cat),
          qty_amount: qty.n,
          qty_unit: qty.u,
          expiry: entry.expiry || 'On the shelf',
          level: entry.level || 'full'
        };
        if (existing) {
          return S.client.from('pantry').update(payload).eq('id', existing.id).select('*').single();
        }
        return S.client.from('pantry').insert(payload).select('*').single();
      }).then(function (r) {
        if (r.error) throw r.error;
        return mapCloudPantry(r.data);
      });
  }

  function cloudUpdatePantry(entry) {
    noteCloudWrite();
    return S.client.from('pantry').update({
      name: entry.name,
      category_id: categoryIdFor(entry.cat),
      qty_amount: entry.qty.n,
      qty_unit: entry.qty.u,
      expiry: entry.expiry || 'On the shelf',
      level: entry.level || 'full'
    }).eq('id', entry.id).select('*').single().then(function (r) {
      if (r.error) throw r.error;
      return mapCloudPantry(r.data);
    });
  }

  function cloudDeletePantry(entry) {
    noteCloudWrite();
    return S.client.from('pantry').delete().eq('id', entry.id).then(function (r) {
      if (r.error) throw r.error;
      return true;
    });
  }

  /* ----------------------------------------------------------------- toast */
  var toastWrap = null;
  function toast(message) {
    if (!toastWrap) toastWrap = $('#toast-wrap');
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = icon('check-thin') + '<span>' + esc(message) + '</span>';
    toastWrap.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 240);
    }, 2400);
  }

  /* =============================== TOPBAR ================================ */
  function renderTopbar() {
    $$('.main-tab').forEach(function (t) {
      t.classList.toggle('is-active', t.dataset.route === state.route);
    });
    $$('.mnav-item').forEach(function (t) {
      t.classList.toggle('is-active', t.dataset.route === state.route);
    });
    var me = you();
    var ws = activeWorkspace();
    $('#chip-avatar').textContent = me.initials;
    $('#chip-household').textContent = ws.name;
    $('#chip-sub').textContent = me.name.split(' ')[0] + ' · Household ' + me.role.toLowerCase();
    renderProfileMenu(me, ws);
  }

  function activeWorkspace() {
    for (var i = 0; i < state.workspaces.length; i++) {
      if (state.workspaces[i].active) return state.workspaces[i];
    }
    return state.workspaces[0] || { id: 'w1', name: 'My household', sub: '', icon: 'house' };
  }

  function renderProfileMenu(me, ws) {
    $('#pmenu-avatar').textContent = me.initials;
    $('#pmenu-name').textContent = me.name;
    $('#pmenu-mail').textContent = me.email || 'Not signed in';

    $('#pmenu-workspaces').innerHTML = state.workspaces.map(function (w) {
      var ico = w.icon === 'house' ? 'house' : 'friends';
      return '<button class="pmenu-ws' + (w.active ? ' is-active' : '') + '" data-ws="' + w.id + '">' +
        '<span class="pmenu-ws-ico"><svg class="ic"><use href="#i-' + ico + '"/></svg></span>' +
        '<span class="pmenu-ws-text">' +
          '<span class="pmenu-ws-name">' + esc(w.name) + '</span>' +
          '<span class="pmenu-ws-sub">' + esc(w.sub) + '</span>' +
        '</span>' +
        (w.active ? '<span class="pmenu-ws-check"><svg class="ic"><use href="#i-check-thin"/></svg></span>' : '') +
      '</button>';
    }).join('');
  }

  function toggleProfileMenu(force) {
    var pm = $('#profile-menu');
    var open = pm.classList.contains('is-open');
    var next = (force === undefined) ? !open : force;
    pm.classList.toggle('is-open', next);
    $('#btn-profile').setAttribute('aria-expanded', next ? 'true' : 'false');
    return next;
  }

  /* =============================== DASHBOARD ============================= */
  function activeList() {
    for (var i = 0; i < state.lists.length; i++) if (state.lists[i].id === state.activeListId) return state.lists[i];
    return state.lists[0];
  }
  function toBuyCount(list) {
    return list.items.filter(function (i) { return !i.done; }).length;
  }

  function greetBlock() {
    return '' +
      '<section class="greet">' +
        '<h1>A little order, a lighter day.</h1>' +
        '<p>Welcome back, ' + esc(you().name.split(' ')[0]) + '. Here\'s what\'s new in your household\'s plate.</p>' +
        '<div class="greet-meta">' +
          '<span class="greet-date">' + icon('calendar') + esc(longDate(D.TODAY)) + '</span>' +
          '<button class="btn-new" data-act="new-list">' + icon('plus') + ' Create a list</button>' +
        '</div>' +
      '</section>';
  }

  function spaceCard() {
    var icons = { grocery: 'cart', tasks: 'tasks', event: 'cake', inventory: 'box' };
    var tints = {
      grocery:  'background:var(--green-100);color:var(--green-600)',
      tasks:    'background:var(--gold-100);color:var(--gold-600)',
      event:    'background:var(--blue-100);color:#3B7BB5',
      inventory:'background:#E7E9F6;color:var(--navy-600)'
    };
    var rows = state.lists.map(function (l) {
      var n = l.items.length;
      return '<button class="space-item' + (l.id === state.activeListId ? ' is-active' : '') + '" data-list="' + l.id + '">' +
        '<span class="si-ico" style="' + tints[l.kind] + '">' + icon(icons[l.kind] || 'list') + '</span>' +
        '<span class="si-name">' + esc(l.name) + '</span>' +
        '<span class="si-count">' + n + '</span>' +
      '</button>';
    }).join('');

    return '<section class="card space-card">' +
      '<div class="card-head">' +
        '<span class="eyebrow">Your space</span>' +
        '<button class="card-more" data-route="lists">View all ' + icon('arrow-right') + '</button>' +
      '</div>' +
      '<div class="space-list">' + rows + '</div>' +
      '<button class="space-add" data-act="new-list">' + icon('plus') + ' Add a list</button>' +
    '</section>';
  }

  function spendMiniCard() {
    var sp = D.spending;
    var r = sp.ranges[state.spendingRange];
    var mini = sp.mini[state.spendingRange];

    var tabs = sp.rangeOrder.map(function (k) {
      return '<button class="spend-tab' + (state.spendingRange === k ? ' is-active' : '') + '" data-srange="' + k + '">' + sp.rangeLabels[k] + '</button>';
    }).join('');

    var max = Math.max.apply(null, mini.values) || 1;
    var bars = mini.values.map(function (v, i) {
      var cls = i === mini.hot ? 'is-hot' : (v > 0 ? 'is-past' : '');
      var h = v > 0 ? Math.max(6, Math.round((v / max) * 100)) : 2;
      return '<div class="bar-wrap"><div class="bar ' + cls + '" style="height:' + h + '%"></div>' +
        '<div class="day">' + mini.labels[i] + '</div></div>';
    }).join('');

    var left = r.budget - r.amount;
    var pct = Math.min(100, Math.round((r.amount / r.budget) * 100));

    return '<section class="card spend-card spend-card--click" data-route="spending" role="button" tabindex="0" ' +
        'aria-label="Open the full spending insights module">' +
      '<div class="spend-head">' +
        '<span class="card-title">Spending insights</span>' +
        '<span class="spend-expand">' + icon('arrow-up-right') + '</span>' +
      '</div>' +
      '<div class="spend-tabs" role="tablist">' + tabs + '</div>' +
      '<div class="spend-total"><span class="amt">' + peso(r.amount) + '</span><span class="of">of ' + peso(r.budget) + '</span></div>' +
      '<div class="spend-label">' + esc(r.label) + ' · household budget</div>' +
      '<div class="spend-meter"><i style="width:' + pct + '%"></i></div>' +
      '<div class="mini-chart">' + bars + '</div>' +
      '<div class="spend-note"><span class="dot"></span> ' +
        (left >= 0 ? peso(left) + ' left to spend ' + r.period : peso(Math.abs(left)) + ' over budget for ' + r.period) + '</div>' +
      '<div class="spend-link">Open full spending insights ' + icon('arrow-right') + '</div>' +
    '</section>';
  }

  function tipCard() {
    return '<section class="tip-card">' +
      '<span class="tip-ico">' + icon('bulb') + '</span>' +
      '<div>' +
        '<div class="tip-title">Check before you shop</div>' +
        '<div class="tip-body">A quick peek in your pantry can save a second trip.</div>' +
      '</div>' +
    '</section>';
  }

  /* ------------------------------------------------------ grocery list card */
  function aisleGroups(items) {
    var order = [], map = {};
    items.forEach(function (it) {
      var key = it.cat || otherCatId();
      var label = catName(key, it.aisle);
      /* items that fall back to "Other" keep their own heading (Chores, Party…) */
      if (key === otherCatId() && it.aisle && String(it.aisle).toLowerCase() !== 'other' && it.aisle !== label) {
        key = 'label:' + it.aisle;
        label = it.aisle;
      }
      if (!map[key]) { map[key] = { key: key, name: label, items: [] }; order.push(map[key]); }
      map[key].items.push(it);
    });
    return order;
  }

  function itemRow(it) {
    var m = memberById(it.owner);
    var open = state.editingId === it.id;
    return '<div class="item-row' + (it.done ? ' done' : '') + (open ? ' is-open' : '') + '" data-id="' + it.id + '">' +
      '<button class="tick' + (it.done ? ' on' : '') + '" data-act="toggle" aria-label="Toggle ' + esc(it.name) + '">' + icon('check') + '</button>' +
      '<span class="item-name">' + esc(it.name) + '</span>' +
      '<span class="item-qty">' + esc(qtyText(it.qty)) + '</span>' +
      '<span class="item-owner"><span class="avatar avatar-sm" title="' + esc(m.name) + '">' + esc(m.initials) + '</span></span>' +
      '<button class="item-edit" data-act="edit-item" aria-label="Edit ' + esc(it.name) + '" title="Edit item">' + icon('pencil') + '</button>' +
      '<button class="item-del" data-act="del" aria-label="Remove ' + esc(it.name) + '">' + icon('trash') + '</button>' +
      (open ? itemPopover(it) : '') +
    '</div>';
  }

  /* the edit popover — opens from the pencil so the row itself stays calm */
  function itemPopover(it) {
    var catOptions = state.categories.map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === it.cat ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');
    var ud = unitDef(it.qty.u);
    return '<div class="item-pop" data-pop="' + it.id + '">' +
      '<div class="pop-head">' +
        '<span>Edit item</span>' +
        '<button class="pop-x" data-act="cancel-edit" aria-label="Close">' + icon('x') + '</button>' +
      '</div>' +
      '<label class="pop-label">Name</label>' +
      '<input class="input" id="edit-name" value="' + esc(it.name) + '" aria-label="Item name">' +
      '<label class="pop-label">Quantity</label>' +
      '<div class="pop-qty">' +
        '<input class="input pop-n" id="edit-qty-n" type="text" inputmode="decimal" value="' + it.qty.n + '" aria-label="Amount">' +
        unitPicker(state.editUnit || it.qty.u, 'edit-unit-picker') +
      '</div>' +
      '<p class="qty-hint">Up to ' + unitQty(ud, ud.max) + ' in one trip. Decimals are fine — ' + unitExample(ud) + ' works.</p>' +
      '<p class="qty-error" id="edit-error" hidden></p>' +
      '<label class="pop-label">Category</label>' +
      '<select class="role-select pop-cat" id="edit-cat" aria-label="Category">' + catOptions + '</select>' +
      '<div class="pop-foot">' +
        '<button class="pop-del" data-act="del">Remove</button>' +
        '<span class="grow"></span>' +
        '<button class="pop-cancel" data-act="cancel-edit">Cancel</button>' +
        '<button class="pop-save" data-act="save-item">Save</button>' +
      '</div>' +
    '</div>';
  }

  function showEditError(msg) {
    var el = $('#edit-error');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
  }
  function clearEditError() {
    var el = $('#edit-error');
    if (el) { el.hidden = true; el.textContent = ''; }
  }

  /* ------------------------------------------------------ suggestion panel */
  function suggestPanelHtml(query) {
    var res = suggestionsFor(query, state.addCategory);
    var q = query.trim();

    var catChips = '<button class="sug-cat is-auto' + (state.addCategory === 'auto' ? ' is-active' : '') + '" data-scat="auto">Auto-detect</button>' +
      state.categories.map(function (c) {
        return '<button class="sug-cat tone-' + (c.tone || 'grey') + (state.addCategory === c.id ? ' is-active' : '') + '" data-scat="' + c.id + '">' +
          '<i></i>' + esc(c.name) + '</button>';
      }).join('');

    var rows = res.all.slice(0, 8).map(function (s) {
      var c = catById(s.cat);
      return '<button class="sug-item" data-sug-name="' + esc(s.name) + '" data-sug-cat="' + esc(s.cat) + '" data-sug-n="' + s.n + '" data-sug-u="' + esc(s.u) + '">' +
        '<span class="sug-ico tone-' + (c ? c.tone : 'grey') + '">' + icon('cart') + '</span>' +
        '<span class="sug-text">' +
          '<span class="sug-name">' + esc(s.name) + '</span>' +
          '<span class="sug-meta">' + esc(s.n + ' ' + unitLabel(s.u)) + (s.meta ? ' · ' + esc(s.meta) : '') + '</span>' +
        '</span>' +
        '<span class="sug-cat-label tone-' + (c ? c.tone : 'grey') + '">' + esc(c ? c.name : 'Other') + '</span>' +
      '</button>';
    }).join('');

    var empty = !res.all.length
      ? '<div class="sug-empty">No match yet — you can still add it under a category of your choice.</div>'
      : '';

    var dest = state.addCategory === 'auto' ? catName(guessCategory(q)) : catName(state.addCategory);
    var addRow = q
      ? '<button class="sug-add" data-act="add-query">' + icon('plus') +
          '<span>Add “<b>' + esc(q) + '</b>” to <b>' + esc(dest) + '</b></span>' +
        '</button>'
      : '';

    var ud = unitDef(state.addQty.u);
    var qtyRow = '<div class="sug-qty">' +
      '<div class="sug-qty-top">' +
        '<span class="sug-qty-label">Add as</span>' +
        '<input class="input sug-qty-n" id="sug-qty-n" type="text" inputmode="decimal" value="' + state.addQty.n + '" aria-label="Amount">' +
        '<span class="sug-qty-hint">max ' + unitQty(ud, ud.max) + '</span>' +
      '</div>' +
      unitPicker(state.addQty.u, 'sug-qty-u') +
    '</div>';

    return '<div class="sug-cats">' + catChips + '</div>' +
      qtyRow +
      '<div class="sug-list">' +
        (res.all.length ? '<div class="sug-group-title">' + (q ? 'Suggestions' : 'Frequent in your household') + '</div>' : '') +
        rows + empty + addRow +
      '</div>';
  }

  /* ============================ ADD ITEM MODAL =========================== */
  function openAddModal(seed) {
    state.addModal = {
      open: true,
      step: 'search',
      query: seed || '',
      draft: null
    };
    state.addCategory = 'auto';
    state.addQtyTouched = false;
    state.addQty = defaultQtyFor(seed || '');
    renderAddModal();
    $('#add-modal').classList.add('show');
    document.body.style.overflow = 'hidden';
    setTimeout(function () {
      var el = $('#add-search');
      if (el) { el.focus(); el.select(); }
    }, 60);
  }

  function closeAddModal() {
    state.addModal = { open: false, step: 'search', query: '', draft: null };
    $('#add-modal').classList.remove('show');
    document.body.style.overflow = '';
  }

  /* the second step: review the product before it goes on the list */
  function reviewStep(draft) {
    var catOptions = state.categories.map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === draft.cat ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');
    var ud = unitDef(draft.u);
    return '<div class="review">' +
      '<div class="review-head">' + icon('pencil') + '<span>Review before adding</span></div>' +
      '<label class="pop-label">Product name</label>' +
      '<input class="input" id="rv-name" value="' + esc(draft.name) + '" aria-label="Product name">' +
      '<label class="pop-label">How much</label>' +
      '<div class="pop-qty">' +
        '<input class="input pop-n" id="rv-n" type="text" inputmode="decimal" value="' + draft.n + '" aria-label="Amount">' +
        unitPicker(draft.u, 'rv-unit-picker') +
      '</div>' +
      '<p class="qty-hint">Up to ' + unitQty(ud, ud.max) + ' in one trip. Decimals are fine — ' + unitExample(ud) + ' works.</p>' +
      '<p class="qty-error" id="rv-error" hidden></p>' +
      '<label class="pop-label">Category</label>' +
      '<select class="role-select pop-cat" id="rv-cat" aria-label="Category">' + catOptions + '</select>' +
      '<div class="pop-foot">' +
        '<button class="pop-cancel" data-act="add-back">Back to search</button>' +
        '<span class="grow"></span>' +
        '<button class="pop-cancel" data-act="close-add">Cancel</button>' +
        '<button class="pop-save" data-act="confirm-add">Add to list</button>' +
      '</div>' +
    '</div>';
  }

  function renderAddModal() {
    var m = state.addModal;
    if (!m || !m.open) return;
    var box = $('#add-modal-body');
    if (!box) return;

    var head = '<div class="modal-head">' +
      '<div>' +
        '<span class="eyebrow">' + (m.step === 'review' ? 'Step 2 of 2' : 'Step 1 of 2') + ' · ' + esc(activeList().name) + '</span>' +
        '<h2>' + (m.step === 'review' ? 'Check the details' : 'Add an item') + '</h2>' +
      '</div>' +
      '<button class="drawer-close" data-act="close-add" aria-label="Close">' + icon('x') + '</button>' +
    '</div>';

    if (m.step === 'review') {
      box.innerHTML = head + '<div class="modal-body">' + reviewStep(m.draft) + '</div>';
      return;
    }

    var searchBox = '<div class="add-search">' +
      '<div class="add-input">' +
        '<svg class="ic"><use href="#i-search"/></svg>' +
        '<input class="input" id="add-search" placeholder="Search ' + D.catalogue.length + '+ Filipino products — e.g. dishwashing liquid" value="' + esc(m.query) + '" autocomplete="off">' +
      '</div>' +
    '</div>';

    box.innerHTML = head +
      '<div class="modal-body modal-body--add">' +
        searchBox +
        '<div id="add-suggestions">' + suggestPanelHtml(m.query) + '</div>' +
      '</div>';
  }

  /* only the suggestions part changes, so the search box keeps focus */
  function renderAddSuggestions() {
    var host = $('#add-suggestions');
    if (!host) return;
    host.innerHTML = suggestPanelHtml(state.addModal.query);
  }

  /* ---------------------------------------------------------- pantry */
  /* The "Pantry & Inventory" tab is the household inventory: what is already
     on the shelves. Checking an item off in To Buy tops it up. */
  function inventoryRows() {
    if (!state.inventory.length) {
      return '<div class="empty-state">Nothing in the pantry yet.<br>Check items off your list and they will land here.</div>';
    }
    return state.inventory.map(function (p) {
      return '<div class="inv-row">' +
        '<span class="inv-ico' + (p.level === 'low' ? ' is-low' : '') + '">' + icon(p.level === 'low' ? 'bulb' : 'box') + '</span>' +
        '<span class="inv-name">' + esc(p.name) + '</span>' +
        '<span class="inv-qty">' + esc(qtyText(p.qty)) + '</span>' +
        '<span class="inv-exp' + (p.level === 'low' ? ' is-low' : '') + '">' + esc(p.expiry || 'On the shelf') + '</span>' +
        '<button class="inv-add" data-pantry="' + esc(p.name) + '" data-pantry-cat="' + esc(p.cat || '') + '" data-pantry-n="' + p.qty.n + '" data-pantry-u="' + esc(p.qty.u) + '" aria-label="Add ' + esc(p.name) + ' to the list">' + icon('plus') + ' Add to list</button>' +
      '</div>';
    }).join('');
  }

  /* checking an item off puts it in the pantry: top up an existing line,
     or create a new one */
  function addToInventory(item) {
    var key = item.name.toLowerCase().trim();
    var existing = null;
    state.inventory.forEach(function (p) {
      if (!existing && p.name.toLowerCase().trim() === key) existing = p;
    });
    if (existing) {
      if (existing.qty.u === item.qty.u) existing.qty.n += item.qty.n;
      else existing.qty = { n: existing.qty.n, u: existing.qty.u };
      item.pantryAdded = { merged: true, n: item.qty.n, u: item.qty.u, name: existing.name };
      return existing.name + ' topped up to ' + qtyText(existing.qty);
    }
    var entry = {
      id: 'inv' + Date.now(),
      name: item.name,
      qty: { n: item.qty.n, u: item.qty.u },
      cat: item.cat,
      expiry: 'Just bought',
      level: 'full'
    };
    state.inventory.push(entry);
    item.pantryAdded = { merged: false, n: item.qty.n, u: item.qty.u, id: entry.id };
    return item.name + ' added to the pantry';
  }

  /* and un-checking takes it back out again */
  function removeFromInventory(item) {
    var a = item.pantryAdded;
    if (!a) return;
    if (a.merged) {
      state.inventory.forEach(function (p) {
        if (p.name === a.name && p.qty.u === a.u) p.qty.n = Math.max(0, p.qty.n - a.n);
      });
    } else {
      state.inventory = state.inventory.filter(function (p) { return p.id !== a.id; });
    }
    item.pantryAdded = null;
  }

  function listCard() {
    var list = activeList();
    var all = list.items;
    var toBuy = all.filter(function (i) { return !i.done; });
    var bought = all.filter(function (i) { return i.done; });
    var tab = state.activeAisleTab;

    var done = bought.length;
    var total = all.length;
    var pct = total ? Math.round((done / total) * 100) : 0;

    /* the find-in-list search only filters what is already on the list,
       and it looks across every tab */
    var q = state.listQuery.trim().toLowerCase();
    var matches = function (it) {
      if (!q) return true;
      /* name and quantity only — matching the category name gave false
         positives (searching "egg" matched everything in "Dairy & eggs") */
      return it.name.toLowerCase().indexOf(q) !== -1 ||
             qtyText(it.qty).toLowerCase().indexOf(q) !== -1;
    };

    /* if the active tab has no hits but another tab does, jump there */
    if (q) {
      var here = (tab === 'pantry' ? bought : toBuy).filter(matches).length;
      var elsewhere = 0;
      if (!here) {
        elsewhere = (tab === 'pantry' ? toBuy : bought).filter(matches).length;
        if (elsewhere) {
          state.activeAisleTab = (tab === 'pantry' ? 'tobuy' : 'pantry');
          tab = state.activeAisleTab;
          toast('No match here — showing the ' + (tab === 'pantry' ? 'Pantry' : 'To Buy') + ' tab instead');
        }
      }
    }

    var body = '';
    var shown = 0;
    if (tab === 'inventory') {
      body = '<div class="inv-head"><span>Item</span><span>On hand</span><span>Shelf life</span><span></span></div>' +
        '<div class="inv-body">' + inventoryRows() + '</div>';
    } else {
      var items = (tab === 'pantry' ? bought : toBuy).filter(matches);
      shown = items.length;
      var groups = aisleGroups(items).map(function (g) {
        return '<div class="aisle-group">' +
          '<div class="aisle-head">' +
            '<span class="aisle-name"><i class="a-dot"></i>' + esc(g.name) + '</span>' +
            '<span class="aisle-cols"><span>Quantity</span><span>Assigned to</span></span>' +
          '</div>' +
          '<div class="aisle-body">' + g.items.map(itemRow).join('') + '</div>' +
        '</div>';
      }).join('');

      if (!groups) {
        body = '<div class="empty-state">' +
          (q
            ? 'Nothing on this list matches “' + esc(state.listQuery.trim()) + '”.<br>' +
              '<button class="empty-cta" data-act="add-named" data-name="' + esc(state.listQuery.trim()) + '">+ Add it to the list</button>'
            : (tab === 'pantry'
              ? 'Nothing in the pantry yet. Items you check off land here automatically.'
              : (list.items.length === 0
                ? 'No items yet. Press “Add item” to start your list.'
                : 'Everything is bought. Nice work — nothing left to pick up.'))) +
        '</div>';
      } else {
        body = groups;
      }
    }

    var nextRun = state.events.filter(function (e) { return e.kind === 'list'; })[0];
    var nextLabel = 'Not scheduled';
    if (nextRun) nextLabel = shortDate(new Date(nextRun.date + 'T00:00:00'));

    var tabs = [
      { id: 'tobuy', label: 'To Buy', n: toBuy.length },
      { id: 'pantry', label: 'Pantry', n: bought.length },
      { id: 'inventory', label: 'Inventory', n: state.inventory.length }
    ].map(function (t) {
      return '<button class="ls-pill' + (tab === t.id ? ' is-active' : '') + '" data-tab="' + t.id + '">' +
        t.label + ' <span class="pill-count">' + t.n + '</span></button>';
    }).join('');

    return '<section class="card list-card">' +
      '<div class="list-head">' +
        '<div class="list-title-row">' +
          '<div>' +
            '<span class="eyebrow">Shared grocery list' + liveBadgeHtml() + '</span>' +
            '<h2>' + esc(list.name) + '</h2>' +
          '</div>' +
          '<div class="list-actions">' +
            '<button class="sq-btn" data-act="open-categories" title="Customize categories" aria-label="Customize categories">' + icon('tag') + '</button>' +
            '<button class="sq-btn" aria-label="More options">' + icon('more') + '</button>' +
            '<button class="btn-share" data-act="share">' + icon('share') + ' Share list</button>' +
          '</div>' +
        '</div>' +
        '<div class="list-meta">' +
          '<span class="m">' + icon('calendar') + ' Next run: <b>' + esc(nextLabel) + '</b></span>' +
          '<span class="m">' + icon('box') + ' <b>' + total + '</b> items</span>' +
          '<span class="m">' + icon('check') + ' <b>' + done + '</b> done</span>' +
        '</div>' +
        '<div class="list-switch" role="tablist">' + tabs + '</div>' +
      '</div>' +

      '<div class="list-toolbar">' +
        '<div class="find-input">' +
          '<svg class="ic"><use href="#i-search"/></svg>' +
          '<input class="input" id="list-search" placeholder="Find in this list…" value="' + esc(state.listQuery) + '" autocomplete="off" aria-label="Find items in this list">' +
          (state.listQuery
            ? '<button class="find-clear" data-act="clear-search" aria-label="Clear search">' + icon('x') + '</button>'
            : '') +
        '</div>' +
        (q ? '<span class="find-count">' + shown + ' of ' + total + '</span>' : '') +
        /* you only add shopping items from the To Buy list */
        (tab === 'tobuy'
          ? '<button class="btn-add" data-act="open-add">' + icon('plus') + '<span>Add item</span></button>'
          : '') +
      '</div>' +

      body +

      '<div class="list-foot">' +
        icon('check') +
        '<b>' + done + ' of ' + total + '</b> in the bag' +
        '<span class="bar"><i style="width:' + pct + '%"></i></span>' +
      '</div>' +
    '</section>';
  }

  function lifeCard() {
    var rows = state.lifeAdmin.map(function (t) {
      var m = memberById(t.owner);
      return '<div class="life-item' + (t.done ? ' done' : '') + '" data-life="' + t.id + '">' +
        '<button class="tick' + (t.done ? ' on' : '') + '" data-act="toggle-life">' + icon('check') + '</button>' +
        '<span class="li-name">' + esc(t.name) + '</span>' +
        '<span class="li-when"><b>' + esc(t.when) + '</b> · ' + esc(m.initials) + '</span>' +
      '</div>';
    }).join('');

    return '<section class="card life-card">' +
      '<div class="card-head">' +
        '<span class="card-title">A little life admin</span>' +
        '<button class="card-more" data-route="lists">View tasks ' + icon('arrow-right') + '</button>' +
      '</div>' +
      '<div class="life-items">' + (rows || '<p class="empty-line">Nothing on the list yet.</p>') + '</div>' +
    '</section>';
  }

  /* -------------------------------------------------------------- calendar */
  function eventsOn(dateStr) {
    return state.events.filter(function (e) { return e.date === dateStr; });
  }

  function calCard() {
    var m = state.calMonth;
    var first = new Date(m.getFullYear(), m.getMonth(), 1);
    var days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    var lead = (first.getDay() + 6) % 7;

    var cells = '';
    for (var i = 0; i < lead; i++) cells += '<div class="cal-day empty"></div>';
    for (var d = 1; d <= days; d++) {
      var date = new Date(m.getFullYear(), m.getMonth(), d);
      var key = D.iso(date);
      var has = eventsOn(key).length > 0;
      var isToday = key === D.iso(D.TODAY);
      var cls = 'cal-day' + (has ? ' has-event' : '') + (isToday ? ' today' : '') + (key === state.selectedDay ? ' selected' : '');
      cells += '<div class="' + cls + '" data-day="' + key + '">' + d + '</div>';
    }

    return '<section class="card cal-card">' +
      '<div class="cal-head">' +
        '<span class="cal-month">' + esc(monthLabel(m)) + '</span>' +
        '<span class="cal-nav">' +
          '<button data-cal="prev" aria-label="Previous month">' + icon('arrow-left') + '</button>' +
          '<button data-cal="next" aria-label="Next month">' + icon('arrow-right') + '</button>' +
          '<button data-cal="add" aria-label="Add event">' + icon('cal-plus') + '</button>' +
        '</span>' +
      '</div>' +
      '<div class="cal-grid">' +
        MON_LEAD.map(function (d) { return '<div class="cal-dow">' + d + '</div>'; }).join('') +
        cells +
      '</div>' +
      '<div class="cal-legend">' +
        '<span><i class="today-dot"></i> Today</span>' +
        '<span><i></i> Scheduled</span>' +
      '</div>' +
    '</section>';
  }

  function comingCard() {
    var todayKey = D.iso(D.TODAY);
    var upcoming = state.events
      .filter(function (e) { return e.date >= todayKey; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; })
      .slice(0, 5);

    var rows = upcoming.map(function (e) {
      var d = new Date(e.date + 'T00:00:00');
      var isToday = e.date === todayKey;
      var link = e.listId
        ? '<button class="ci-link" data-list="' + e.listId + '">' + icon('list') + ' ' + esc(e.chip) + '</button>'
        : '<span class="chip ' + (e.kind === 'list' ? 'chip-green' : 'chip-gold') + '">' + esc(e.chip) + '</span>';
      return '<div class="coming-item">' +
        '<div class="ci-date' + (isToday ? ' is-today' : '') + '">' +
          '<span class="d">' + d.getDate() + '</span><span class="m">' + MONTHS[d.getMonth()].slice(0, 3) + '</span>' +
        '</div>' +
        '<div class="ci-body">' +
          '<div class="ci-title">' + esc(e.title) + '</div>' +
          '<div class="ci-time">' + icon('clock') + esc(DOW[d.getDay()]) + ' · ' + esc(e.time) + '</div>' +
          '<div class="ci-chips">' + link + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    return '<section class="card coming-card">' +
      '<div class="card-head">' +
        '<span class="card-title">Coming up</span>' +
        '<button class="card-more" data-act="new-event">' + icon('plus') + '</button>' +
      '</div>' +
      '<div class="coming-list">' + (rows || '<p class="empty-line">Nothing scheduled yet.</p>') + '</div>' +
    '</section>';
  }

  function effortCard() {
    var rows = state.activity.map(function (a) {
      var icons = { share: 'share', check: 'check-thin', push: 'arrow-up-right', join: 'users' };
      return '<div class="effort-item">' +
        '<span class="avatar avatar-sm avatar-muted">' + esc(a.initials) + '</span>' +
        '<div class="ei-text">' +
          '<div>' + esc(a.who) + ' <span style="color:var(--muted)">' + esc(a.text) + '</span></div>' +
          '<div class="ei-when">' + esc(a.when) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    return '<section class="card effort-card">' +
      '<div class="card-head">' +
        '<span class="card-title">A shared effort</span>' +
        '<button class="card-more">View all</button>' +
      '</div>' +
      '<div class="effort-list">' + (rows || '<p class="empty-line">No activity yet.</p>') + '</div>' +
    '</section>';
  }

  function renderDashboard() {
    return '<div class="page"><div class="dash">' +
      '<div class="dash-col dash-left">' + greetBlock() + spaceCard() + spendMiniCard() + tipCard() + '</div>' +
      '<div class="dash-col dash-center">' + listCard() + lifeCard() + '</div>' +
      '<div class="dash-col dash-right">' + calCard() + comingCard() + effortCard() + '</div>' +
    '</div></div>';
  }

  /* =============================== LISTS PAGE ============================= */
  function listTile(l) {
    var done = l.items.filter(function (i) { return i.done; }).length;
    var pct = l.items.length ? Math.round((done / l.items.length) * 100) : 0;
    var tints = {
      grocery:  'background:var(--green-100);color:var(--green-600)',
      tasks:    'background:var(--gold-100);color:var(--gold-600)',
      event:    'background:var(--blue-100);color:#3B7BB5',
      inventory:'background:#E7E9F6;color:var(--navy-600)'
    };
    var icons = { grocery: 'cart', tasks: 'tasks', event: 'cake', inventory: 'box' };
    var who = l.items.slice(0, 3).map(function (i) { return memberById(i.owner).initials; })
      .filter(function (v, i, a) { return a.indexOf(v) === i; });

    return '<button class="list-tile" data-list="' + l.id + '">' +
      '<div class="tile-top">' +
        '<span class="tile-ico" style="' + tints[l.kind] + '">' + icon(icons[l.kind] || 'list') + '</span>' +
        '<span class="chip chip-green">' + (l.shared ? 'Shared' : 'Private') + '</span>' +
      '</div>' +
      '<div class="tile-title">' + esc(l.name) + '</div>' +
      '<div class="tile-meta">' + l.items.length + ' items · ' + toBuyCount(l) + ' still to buy</div>' +
      '<div class="tile-bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="tile-foot">' +
        '<span>' + done + ' of ' + l.items.length + ' done</span>' +
        '<span class="tile-members">' + who.map(function (w) { return '<span class="avatar avatar-sm">' + w + '</span>'; }).join('') + '</span>' +
      '</div>' +
    '</button>';
  }

  function renderLists() {
    var pantryRows = state.inventory.map(function (p) {
      return '<div class="pantry-row">' +
        '<span class="pantry-ico">' + icon(p.level === 'low' ? 'bulb' : 'box') + '</span>' +
        '<div class="p-name">' + esc(p.name) + '</div>' +
        '<div class="p-qty">' + esc(qtyText(p.qty)) + '</div>' +
        '<div class="p-exp' + (p.level === 'low' ? ' is-low' : '') + '">' + esc(p.expiry) + '</div>' +
        (p.level === 'low'
          ? '<button class="p-add" data-pantry="' + esc(p.name) + '">' + icon('plus') + ' Add to list</button>'
          : '<span class="p-ok">' + icon('check-thin') + ' In stock</span>') +
      '</div>';
    }).join('');

    return '<div class="page">' +
      '<div class="page-head">' +
        '<div>' +
          '<h1>My lists</h1>' +
          '<p>Every grocery run, chore and event in one place.</p>' +
        '</div>' +
        '<div class="page-head-actions">' +
          '<button class="btn-new" data-act="new-list">' + icon('plus') + ' Create a list</button>' +
        '</div>' +
      '</div>' +
      '<div class="list-grid">' + state.lists.map(listTile).join('') + '</div>' +

      '<div class="page-head" style="margin-top:30px">' +
        '<div>' +
          '<h1 style="font-size:19px">Pantry &amp; inventory</h1>' +
          '<p>What you already have at home, so nobody buys it twice.</p>' +
        '</div>' +
        '<div class="page-head-actions">' +
          '<button class="btn-new" data-act="new-pantry">' + icon('plus') + ' Add an item</button>' +
        '</div>' +
      '</div>' +
      '<section class="card pantry-card">' +
        '<div class="pantry-head">' +
          '<span>Item</span><span>On hand</span><span>Shelf life</span><span></span>' +
        '</div>' +
        pantryRows +
      '</section>' +
    '</div>';
  }

  /* ============================= SPENDING PAGE ============================ */
  function renderSpending() {
    var sp = D.spending;
    var r = sp.ranges[state.spendingRange];
    var ch = sp.chart;
    var totals = ch.labels.map(function (_, i) { return ch.produce[i] + ch.dairy[i] + ch.other[i]; });
    var max = Math.max.apply(null, totals) || 1;

    var cols = ch.labels.map(function (label, i) {
      var p = Math.round((ch.produce[i] / max) * 100);
      var d = Math.round((ch.dairy[i] / max) * 100);
      var o = Math.round((ch.other[i] / max) * 100);
      return '<div class="chart-col">' +
        '<span class="val">' + peso(totals[i]) + '</span>' +
        '<div class="stack">' +
          '<div class="seg s3" style="height:' + o + '%"></div>' +
          '<div class="seg s2" style="height:' + d + '%"></div>' +
          '<div class="seg s1" style="height:' + p + '%"></div>' +
        '</div>' +
        '<span class="lbl">' + label + '</span>' +
      '</div>';
    }).join('');

    var stats = sp.stats.map(function (s) {
      return '<div class="stat">' +
        '<div class="s-label">' + icon(s.icon) + esc(s.label) + '</div>' +
        '<div class="s-value">' + esc(s.value) + '</div>' +
        '<div class="s-delta ' + s.dir + '">' + esc(s.delta) + '</div>' +
      '</div>';
    }).join('');

    var breakdown = sp.breakdown.map(function (b) {
      return '<div class="breakdown-row">' +
        '<div class="bd-top"><b>' + esc(b.name) + '</b><span>' + peso(b.amount) + '</span></div>' +
        '<div class="bd-bar"><i style="width:' + b.pct + '%"></i></div>' +
        '<div class="bd-pct">' + b.pct + '% of household spending</div>' +
      '</div>';
    }).join('');

    return '<div class="page">' +
      '<div class="page-head">' +
        '<div>' +
          '<h1>Spending insights</h1>' +
          '<p>' + esc(r.label) + ' · household of 4 · shared across every list</p>' +
        '</div>' +
        '<div class="page-head-actions">' +
          '<button class="btn-new" data-act="export">' + icon('arrow-up-right') + ' Export</button>' +
        '</div>' +
      '</div>' +

      '<div class="stat-grid">' + stats + '</div>' +

      '<div class="spend-layout">' +
        '<section class="card big-chart">' +
          '<div class="big-chart-head">' +
            '<div>' +
              '<div class="big-amount">' + peso(r.amount) + '</div>' +
              '<div class="sub">of ' + peso(r.budget) + ' weekly budget · ' +
                (r.amount <= r.budget ? peso(r.budget - r.amount) + ' left' : peso(r.amount - r.budget) + ' over') + '</div>' +
            '</div>' +
            '<div class="spend-tabs">' +
              sp.rangeOrder.map(function (k) {
                return '<button class="spend-tab' + (state.spendingRange === k ? ' is-active' : '') + '" data-srange="' + k + '">' + sp.rangeLabels[k] + '</button>';
              }).join('') +
            '</div>' +
          '</div>' +
          '<div class="chart-area">' + cols + '</div>' +
          '<div class="legend-row">' +
            '<span><i style="background:var(--green-600)"></i> Produce</span>' +
            '<span><i style="background:var(--green-400)"></i> Dairy &amp; eggs</span>' +
            '<span><i style="background:var(--green-200)"></i> Everything else</span>' +
          '</div>' +
        '</section>' +

        '<section class="card breakdown">' +
          '<div class="card-head"><span class="card-title">Where it went</span>' +
            '<button class="card-more">By aisle ' + icon('chevron-down') + '</button></div>' +
          breakdown +
        '</section>' +
      '</div>' +
    '</div>';
  }

  /* =============================== CATEGORIES ============================= */
  var TONES = ['green', 'gold', 'wheat', 'red', 'blue', 'pink', 'navy', 'violet', 'teal', 'lime', 'brown', 'grey'];

  function countInCategory(catId) {
    var n = 0;
    var list = activeList();
    list.items.forEach(function (it) { if (it.cat === catId) n++; });
    return n;
  }

  function renderCategoriesPanel() {
    var box = $('#cat-panel-body');
    if (!box) return;

    var rows = state.categories.map(function (c) {
      var kws = c.keywords || [];
      var expanded = !!state.expandedCats[c.id];
      var shown = expanded ? kws : kws.slice(0, 3);
      var hidden = kws.length - shown.length;

      var chips = shown.map(function (k) {
        return '<span class="kw-chip">' + esc(k) +
          '<button data-rmkw="' + c.id + '" data-kw="' + esc(k) + '" aria-label="Remove keyword ' + esc(k) + '">&times;</button>' +
        '</span>';
      }).join('');

      var toggle = hidden > 0
        ? '<button class="kw-more" data-toggle-kw="' + c.id + '">+' + hidden + ' more</button>'
        : (expanded && kws.length > 3 ? '<button class="kw-more" data-toggle-kw="' + c.id + '">Show less</button>' : '');

      var input = expanded
        ? '<input class="kw-input" id="kw-' + c.id + '" placeholder="+ keyword" aria-label="Add a keyword">' : '';

      return '<div class="cat-row' + (expanded ? ' is-open' : '') + '" data-cat="' + c.id + '">' +
        '<span class="cat-dot tone-' + (c.tone || 'grey') + '"></span>' +
        '<input class="input cat-name" id="catname-' + c.id + '" value="' + esc(c.name) + '" aria-label="Category name">' +
        '<span class="cat-count">' + countInCategory(c.id) + ' item' + (countInCategory(c.id) === 1 ? '' : 's') + '</span>' +
        '<div class="cat-kws">' + (kws.length ? chips + toggle : '<span class="kw-none">No keywords yet</span>') + '</div>' +
        '<button class="cat-del" data-delcat="' + c.id + '" title="Delete category" aria-label="Delete ' + esc(c.name) + '">' + icon('trash') + '</button>' +
        (expanded ? '<div class="cat-kw-panel"><div class="cat-kws">' + chips + input + '</div></div>' : '') +
      '</div>';
    }).join('');

    box.innerHTML =
      '<p class="cat-copy">These are the categories your household shops by. Rename one, give it new keywords so the ' +
      'search recognises those products, or create a category of your own. Your changes appear in the add-item ' +
      'search, in the list, and in the reports.</p>' +
      '<div class="cat-list">' + rows + '</div>' +
      '<div class="cat-new">' +
        '<span class="cat-new-label">New category</span>' +
        '<input class="input" id="new-cat-name" placeholder="e.g. Household staples" aria-label="New category name">' +
        '<div class="tone-picker" id="tone-picker">' +
          TONES.map(function (t) {
            return '<button class="tone-dot tone-' + t + (t === 'green' ? ' is-active' : '') + '" data-tone="' + t + '" aria-label="' + t + '"></button>';
          }).join('') +
        '</div>' +
        '<input class="input" id="new-cat-kw" placeholder="keywords, comma separated (optional)" aria-label="New category keywords">' +
        '<button class="btn-invite" data-act="add-category">' + icon('plus') + ' Add category</button>' +
      '</div>';
  }

  function openCategories() {
    state.catPanelOpen = true;
    renderCategoriesPanel();
    $('#cat-modal').classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  function closeCategories() {
    state.catPanelOpen = false;
    $('#cat-modal').classList.remove('show');
    document.body.style.overflow = '';
  }

  function addCategory() {
    var nameEl = $('#new-cat-name');
    var kwEl = $('#new-cat-kw');
    var name = (nameEl.value || '').trim();
    if (!name) { nameEl.classList.add('invalid'); nameEl.focus(); return; }
    nameEl.classList.remove('invalid');

    var id = 'c_' + Date.now().toString(36);
    var kws = (kwEl.value || '').split(',').map(function (k) { return k.trim().toLowerCase(); })
      .filter(function (k) { return k.length > 1; });
    var toneEl = $('#tone-picker .is-active');
    var category = { id: id, name: name, tone: toneEl ? toneEl.dataset.tone : 'green', custom: true, keywords: kws };
    state.categories.push(category);

    save();
    renderCategoriesPanel();
    render();
    toast('Category “' + name + '” created');

    if (cloudMode()) {
      cloudInsertCategory(category).then(function (saved) {
        var index = state.categories.indexOf(category);
        if (index !== -1) state.categories[index] = saved;
        if (state.addCategory === id) state.addCategory = saved.id;
        renderCategoriesPanel();
        render();
      }).catch(function (err) {
        state.categories = state.categories.filter(function (x) { return x !== category; });
        renderCategoriesPanel();
        render();
        cloudError('Could not create that category', err);
      });
    }
  }

  function renameCategory(id, name) {
    var c = catById(id);
    if (!c) return;
    var clean = String(name || '').trim();
    if (!clean) { renderCategoriesPanel(); return; }
    c.name = clean;
    save();
    render();
    if (cloudMode()) {
      cloudUpdateCategory(c).catch(function (err) { cloudError('Could not rename that category', err); });
    }
  }

  function deleteCategory(id) {
    var c = catById(id);
    if (!c) return;
    if (state.categories.length <= 1) { toast('Keep at least one category'); return; }
    var fallback = otherCatId() === id ? (state.categories.filter(function (x) { return x.id !== id; })[0] || {}).id : otherCatId();
    state.categories = state.categories.filter(function (x) { return x.id !== id; });
    state.lists.forEach(function (l) {
      l.items.forEach(function (it) { if (it.cat === id) it.cat = fallback; });
    });
    state.inventory.forEach(function (p) { if (p.cat === id) p.cat = fallback; });
    if (state.addCategory === id) state.addCategory = 'auto';
    save();
    renderCategoriesPanel();
    render();
    toast('Category “' + c.name + '” deleted — its items moved to ' + catName(fallback));

    if (cloudMode()) {
      cloudDeleteCategory(id, fallback).catch(function (err) {
        cloudError('Could not delete that category', err);
      });
    }
  }

  function addKeyword(catId, kw) {
    var c = catById(catId);
    if (!c) return;
    var k = String(kw || '').trim().toLowerCase();
    if (!k) return;
    c.keywords = c.keywords || [];
    if (c.keywords.indexOf(k) === -1) c.keywords.push(k);
    save();
    if (cloudMode()) {
      cloudUpdateCategory(c).catch(function (err) { cloudError('Could not save that keyword', err); });
    }
  }

  function removeKeyword(catId, kw) {
    var c = catById(catId);
    if (!c) return;
    c.keywords = (c.keywords || []).filter(function (k) { return k !== kw; });
    save();
    if (cloudMode()) {
      cloudUpdateCategory(c).catch(function (err) { cloudError('Could not save that keyword', err); });
    }
  }

  /* =============================== RENDERER =============================== */
  function render() {
    var root = $('#page-root');
    if (state.route === 'lists') root.innerHTML = renderLists();
    else if (state.route === 'spending') root.innerHTML = renderSpending();
    else root.innerHTML = renderDashboard();
    renderTopbar();
    updateLiveBadge();
  }

  /* =============================== DRAWER ================================ */
  function renderDrawer() {
    var me = you();
    var online = state.members.filter(function (m) { return m.online; }).length;

    var ws = state.workspaces.map(function (w) {
      var ico = w.icon === 'house' ? 'house' : 'friends';
      return '<button class="ws-item' + (w.active ? ' is-active' : '') + '" data-ws="' + w.id + '">' +
        '<span class="ws-ico">' + icon(ico) + '</span>' +
        '<span>' +
          '<span class="ws-name">' + esc(w.name) + '</span>' +
          '<span class="ws-sub">' + esc(w.sub) + '</span>' +
        '</span>' +
        (w.active ? '<span class="ws-check">' + icon('check-thin') + '</span>' : '') +
      '</button>';
    }).join('');

    var memberRows = state.members.map(function (m) {
      return '<div class="member-row">' +
        '<span class="avatar">' + esc(m.initials) + '</span>' +
        '<div>' +
          '<div class="m-name">' + esc(m.name) + (m.you ? ' (you)' : '') + '</div>' +
          '<div class="m-sub">' + esc(m.email) + '</div>' +
        '</div>' +
        '<div class="m-right">' +
          '<span class="status-dot' + (m.online ? '' : ' off') + '"></span>' +
          '<select class="role-select" data-member="' + m.id + '"' + (m.role === 'Owner' ? ' disabled' : '') + '>' +
            '<option' + (m.role === 'Owner' ? ' selected' : '') + '>Owner</option>' +
            '<option' + (m.role === 'Editor' ? ' selected' : '') + '>Editor</option>' +
            '<option' + (m.role === 'Viewer' ? ' selected' : '') + '>Viewer</option>' +
          '</select>' +
        '</div>' +
      '</div>';
    }).join('');

    var pendingRows = state.pending.map(function (p) {
      return '<div class="pending-row">' +
        '<div class="spread">' +
          '<div>' +
            '<div class="m-name">' + esc(p.email) + '</div>' +
            '<div class="m-sub">Invited as ' + esc(p.role) + ' · sent ' + esc(p.sent || 'just now') + '</div>' +
          '</div>' +
          '<button class="btn-resend" data-resend="' + esc(p.email) + '">Resend</button>' +
        '</div>' +
      '</div>';
    }).join('');

    $('#drawer-content').innerHTML = '' +
      '<div class="drawer-head">' +
        '<h2>Your household, together.</h2>' +
        '<button class="drawer-close" data-act="close-drawer" aria-label="Close">' + icon('x') + '</button>' +
      '</div>' +

      '<div class="profile-card">' +
        '<span class="avatar avatar-lg">' + esc(me.initials) + '</span>' +
        '<div class="grow">' +
          '<div class="pc-name">' + esc(me.name) + '</div>' +
          '<div class="pc-mail">' + esc(me.email) + '</div>' +
        '</div>' +
        '<a class="pc-my" href="#" onclick="return false;">My profile</a>' +
      '</div>' +

      '<span class="eyebrow ws-label">Switch workspace</span>' + ws +

      '<button class="drawer-link-row" data-act="manage-members">' +
        '<span class="dl-ico">' + icon('users') + '</span>' +
        '<span class="dl-text">Manage Members<small>' + state.members.length + ' members · ' + online + ' online now</small></span>' +
        '<span class="dl-arrow">' + icon('chevron-right') + '</span>' +
      '</button>' +

      '<div class="drawer-split">' +
        '<button class="drawer-link-row" data-act="household-settings">' +
          '<span class="dl-ico">' + icon('settings') + '</span>' +
          '<span class="dl-text">Household settings</span>' +
        '</button>' +
        '<button class="btn-signout" data-act="signout">Sign out</button>' +
      '</div>' +

      '<div class="divider"></div>' +

      '<div id="members-block">' +
        '<div class="members-head">' +
          '<h3>Manage Members</h3>' +
          '<span class="online-now"><i></i> ' + online + ' online now</span>' +
        '</div>' +
        '<p class="members-copy">Share the shopping, share the to-dos. Invite someone to ' + esc(activeWorkspace().name) + '.</p>' +

        '<label class="invite-label">Invite by email</label>' +
        '<div class="invite-row">' +
          '<input class="input" id="invite-email" placeholder="mika.santos@email.com" autocomplete="off">' +
          '<select class="role-select" id="invite-role">' +
            '<option>Editor</option><option>Viewer</option>' +
          '</select>' +
          '<button class="btn-invite" data-act="invite">' + icon('mail') + ' Send invite</button>' +
        '</div>' +
        '<p class="hint">Editors can add items, set purchases and manage tasks.</p>' +

        '<div style="margin-top:6px">' + memberRows + '</div>' +
        pendingRows +
      '</div>' +

      '<p class="drawer-foot">Owners manage members and settings. Editors update lists and tasks. Viewers can follow without making changes.</p>';
  }

  function openDrawer() {
    renderDrawer();
    $('#drawer').classList.add('show');
    $('#scrim').classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    $('#drawer').classList.remove('show');
    $('#scrim').classList.remove('show');
    document.body.style.overflow = '';
    if (location.hash === '#/profile') {
      history.replaceState(null, '', '#/' + state.route);
    }
  }

  /* =============================== ROUTER ================================ */
  function go(route) {
    if (route === 'profile') { openDrawer(); return; }
    state.route = route;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function onHashChange() {
    var h = (location.hash || '').replace('#/', '');
    if (h === 'profile') { openDrawer(); return; }
    if (['dashboard', 'lists', 'spending'].indexOf(h) !== -1) {
      state.route = h;
      render();
    }
  }

  /* =============================== ACTIONS =============================== */
  function tidyName(name) {
    var s = String(name || '').trim();
    if (!s) return s;
    /* keep the user's own capitals, just lift the first letter */
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /* push an item onto the active list (no validation — callers do that) */
  function pushItem(name, qty, cat) {
    var list = activeList();
    var item = {
      id: 'n' + Date.now() + Math.floor(Math.random() * 100),
      name: tidyName(name),
      qty: qty,
      cat: cat,
      aisle: catName(cat),
      owner: (state.members.filter(function (m) { return m.you; })[0] || state.members[0]).id,
      done: false
    };
    list.items.push(item);

    if (cloudMode()) {
      cloudInsertItem(list.id, item).then(function (saved) {
        var index = list.items.indexOf(item);
        if (index !== -1) list.items[index] = saved;
        render();
      }).catch(function (err) {
        list.items = list.items.filter(function (it) { return it !== item; });
        render();
        cloudError('Could not add that item', err);
      });
    } else {
      save();
    }
    return item;
  }

  /* step 2 -> actually put it on the list */
  function confirmAdd() {
    var m = state.addModal;
    if (!m || !m.draft) return;
    var name = (($('#rv-name') || {}).value || '').trim();
    if (!name) { showQtyError('Give the product a name.'); return; }

    var v = validateQty(($('#rv-n') || {}).value, m.draft.u);
    if (!v.ok) { showQtyError(v.msg); return; }

    pushItem(name, { n: v.n, u: m.draft.u }, $('#rv-cat') ? $('#rv-cat').value : m.draft.cat);
    closeAddModal();
    render();
    toast('Added “' + tidyName(name) + '” · ' + v.n + ' ' + unitLabel(m.draft.u) + ' → ' + catName(m.draft.cat));
  }

  function showQtyError(msg) {
    var el = $('#rv-error');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    var n = $('#rv-n');
    if (n) { n.classList.add('invalid'); n.focus(); }
  }

  function clearQtyError() {
    var el = $('#rv-error');
    if (el) { el.hidden = true; el.textContent = ''; }
    var n = $('#rv-n');
    if (n) n.classList.remove('invalid');
  }

  /* a suggestion was picked -> go to the review step, never add straight away */
  function reviewSuggestion(name, cat, n, u) {
    var useCat = cat || (state.addCategory !== 'auto' ? state.addCategory : guessCategory(name));
    state.addModal.step = 'review';
    state.addModal.draft = {
      name: name,
      cat: useCat,
      n: (n === undefined || n === '' ? 1 : Number(n)),
      u: u || 'pcs'
    };
    renderAddModal();
  }

  /* typed something that is not in the catalogue -> review it too */
  function reviewTyped() {
    var q = (state.addModal.query || '').trim();
    if (!q) return;
    var v = validateQty(state.addQty.n, state.addQty.u);
    state.addModal.step = 'review';
    state.addModal.draft = {
      name: q,
      cat: state.addCategory !== 'auto' ? state.addCategory : guessCategory(q),
      n: v.ok ? v.n : state.addQty.n,
      u: state.addQty.u
    };
    renderAddModal();
  }

  function saveItemEdit(id) {
    var nameEl = $('#edit-name'), nEl = $('#edit-qty-n'), catEl = $('#edit-cat');
    if (!nameEl || !catEl) return;
    var name = (nameEl.value || '').trim();
    if (!name) { nameEl.classList.add('invalid'); nameEl.focus(); return; }
    nameEl.classList.remove('invalid');

    var unit = state.editUnit || 'pcs';
    var v = validateQty(nEl ? nEl.value : '', unit);
    if (!v.ok) {
      nEl.classList.add('invalid');
      showEditError(v.msg);
      return;
    }
    nEl.classList.remove('invalid');
    clearEditError();

    var list = activeList();
    var edited = null;
    list.items.forEach(function (it) {
      if (it.id === id) {
        it.name = name;
        it.qty = { n: v.n, u: unit };
        it.cat = catEl.value;
        it.aisle = catName(catEl.value);
        edited = it;
      }
    });
    state.editingId = null;
    save();
    render();
    toast('Item updated');

    if (cloudMode() && edited) {
      cloudUpdateItem(edited).then(function (saved) {
        list.items = list.items.map(function (it) { return it.id === saved.id ? saved : it; });
        render();
      }).catch(function (err) {
        cloudError('Could not save that edit', err);
      });
    }
  }

  function invite() {
    var emailEl = $('#invite-email');
    var roleEl = $('#invite-role');
    var email = (emailEl.value || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast('Enter a valid email address');
      if (emailEl) { emailEl.classList.add('invalid'); emailEl.focus(); }
      return;
    }
    emailEl.classList.remove('invalid');
    state.pending.push({ email: email, role: roleEl.value });
    save();
    renderDrawer();
    toast('Invite sent to ' + email);
  }

  function newPantryItem() {
    var rawName = prompt('What did you add to the pantry?', '');
    if (rawName === null) return;
    var name = tidyName(String(rawName).trim());
    if (!name) return;

    var rawQty = prompt('How much? For example: 2 pcs, 1 kg, 500 ml', '1 pcs');
    if (rawQty === null) return;
    var qty = parseQty(rawQty);
    var cat = guessCategory(name);
    var entry = {
      id: 'inv' + Date.now(),
      name: name,
      qty: qty,
      cat: cat,
      expiry: 'On the shelf',
      level: 'full'
    };

    state.inventory.push(entry);
    save();
    render();
    toast('“' + name + '” added to the pantry');

    if (cloudMode()) {
      cloudAddPantry(entry).then(function (saved) {
        var index = state.inventory.indexOf(entry);
        if (index !== -1) state.inventory[index] = saved;
        render();
      }).catch(function (err) {
        state.inventory = state.inventory.filter(function (p) { return p !== entry; });
        render();
        cloudError('Could not save that pantry item', err);
      });
    }
  }

  function newList() {
    var name = prompt('Name your new list', 'New list');
    if (!name || !name.trim()) return;
    var clean = name.trim();
    var list = {
      id: 'l' + Date.now(),
      name: clean,
      kind: 'grocery',
      icon: 'cart',
      tint: 'green',
      shared: true,
      aisle: 'Other',
      items: []
    };
    state.lists.push(list);
    state.activeListId = list.id;
    save();
    render();
    toast('List “' + clean + '” created');

    if (cloudMode()) {
      cloudInsertList(clean, 'grocery').then(function (saved) {
        var index = state.lists.indexOf(list);
        if (index !== -1) state.lists[index] = saved;
        if (state.activeListId === list.id) state.activeListId = saved.id;
        save();
        render();
      }).catch(function (err) {
        state.lists = state.lists.filter(function (l) { return l !== list; });
        if (state.activeListId === list.id) ensureStarterState();
        render();
        cloudError('Could not create that list', err);
      });
    }
  }

  function resetLocalState() {
    state.lists = [];
    state.inventory = [];
    state.categories = JSON.parse(JSON.stringify(D.categories));
    state.members = [];
    state.workspaces = [];
    state.pending = [];
    state.activeListId = null;
    state.lifeAdmin = JSON.parse(JSON.stringify(D.lifeAdmin));
    state.events = JSON.parse(JSON.stringify(D.events));
    state.activity = JSON.parse(JSON.stringify(D.activity));
  }

  function signOut() {
    var wasCloud = cloud.active;
    cloud.active = false;
    cloud.ready = false;
    cloud.loading = false;
    cloud.userId = null;
    cloud.workspaceId = null;
    cloud.workspace = null;
    stopRealtime();

    state.signedIn = false;
    auth.user = null;
    setOAuthPending(false);
    hideAppLoading();

    if (wasCloud) {
      /* Never leave one account's cloud data visible in another account's
         browser storage. It will be fetched fresh from Supabase next time. */
      try { localStorage.removeItem(STORE_KEY); localStorage.removeItem(UI_KEY); } catch (e) { /* ignore */ }
      resetLocalState();
    } else {
      save();
    }

    closeDrawer();
    if (S.client) {
      /* clear the Supabase session too, so a refresh cannot sign you back in */
      S.client.auth.signOut().catch(function () { /* offline: local state is already cleared */ });
    }
    setAuthStep('signin');
    showLogin();
    toast('Signed out');
  }

  /* =============================== AUTH ================================== */
  var S = window.BiliSupabase || { client: null, isConfigured: false, mode: 'demo' };

  /* step: signin | signup | verify | newpass
     "verify" is not a tab — it is the email-confirmation step that follows a
     sign-up, and also the step used by "Forgot password?". */
  var auth = {
    step: 'signin',
    purpose: 'signup',      /* signup | recovery */
    pendingEmail: '',
    user: null
  };

  function showLogin() {
    $('#view-app').classList.add('hidden');
    $('#view-login').classList.remove('hidden');
  }
  function showApp() {
    $('#view-login').classList.add('hidden');
    $('#view-app').classList.remove('hidden');
    render();
  }
  function showAppLoading(message) {
    var el = $('#app-loading');
    if (!el) return;
    var text = $('#app-loading-text');
    if (text && message) text.textContent = message;
    el.classList.remove('hidden');
  }
  function hideAppLoading() {
    var el = $('#app-loading');
    if (el) el.classList.add('hidden');
  }

  /* ------------------------------------------------------ auth screen UI */
  function setAuthStep(step) {
    auth.step = step;

    var isSignin = step === 'signin';
    var isSignup = step === 'signup';
    var isVerify = step === 'verify';
    var isNewPass = step === 'newpass';

    /* Google and the email form share the entry point; the verification and
       reset steps are email-only, so the divider and Google button step aside. */
    var googleWrap = $('#google-auth');
    if (googleWrap) googleWrap.hidden = isVerify || isNewPass;

    var orLine = $('.or-line');
    if (orLine) orLine.textContent = isSignup ? 'or sign up with email' : 'or log in with email';

    /* the top-right shortcut mirrors the current step */
    var topLabel = $('#login-top-label');
    var topSignup = $('#link-signup-top');
    var topSignin = $('#link-signin-top');
    if (topLabel) {
      topLabel.textContent = isSignin ? 'New around here?'
        : (isSignup ? 'Already have an account?' : 'Changed your mind?');
    }
    if (topSignup) topSignup.hidden = !isSignin;
    if (topSignin) topSignin.hidden = isSignin;

    /* which fields are on screen */
    $('#field-username').hidden = !isSignup;
    $('#field-password').hidden = isVerify;
    $('#field-confirm').hidden = !(isSignup || isNewPass);
    $('#field-code').hidden = !isVerify;
    $('#row-remember').hidden = !isSignin;

    var heading = $('#login-heading'), sub = $('#login-sub'), btn = $('#btn-login');
    var label = $('#pass-label'), hint = $('#pass-hint');

    if (isSignin) {
      heading.textContent = 'Welcome back';
      sub.textContent = 'Your groceries, to-dos, and everyday plans. Right where you left them.';
      btn.querySelector('span').textContent = 'Log in';
      label.textContent = 'Password';
      hint.textContent = '8 characters minimum.';
      $('#f-pass').placeholder = 'Enter your password';
      $('#auth-secondary').innerHTML = '<span>Don\'t have an account?</span> <a class="link-green" href="#" id="link-signup">Sign up for free</a>';
    } else if (isSignup) {
      heading.textContent = 'Create your account';
      sub.textContent = 'Start a shared list with the people you live, shop or plan with.';
      btn.querySelector('span').textContent = 'Create account';
      label.textContent = 'Password';
      hint.textContent = '8 characters minimum. Your password must not be used by any other account.';
      $('#f-pass').placeholder = 'At least 8 characters';
      $('#auth-secondary').innerHTML = '<span>Already have an account?</span> <a class="link-green" href="#" id="link-signin">Sign in</a>';
    } else if (isVerify) {
      heading.textContent = auth.purpose === 'recovery' ? 'Reset your password' : 'Verify your email';
      sub.textContent = auth.purpose === 'recovery'
        ? 'Enter the code we emailed you, then choose a new password.'
        : 'One last step — enter the code we emailed you to confirm your account.';
      btn.querySelector('span').textContent = auth.purpose === 'recovery' ? 'Continue' : 'Verify email';
      $('#code-hint').textContent = auth.pendingEmail
        ? 'We sent a 6-digit code to ' + auth.pendingEmail
        : 'We sent you a 6-digit code.';
      $('#auth-secondary').innerHTML = '<span>Changed your mind?</span> <a class="link-green" href="#" id="link-signin">Back to sign in</a>';
    } else {
      heading.textContent = 'Set a new password';
      sub.textContent = 'Your code checked out. Pick a new password for your account.';
      btn.querySelector('span').textContent = 'Save password';
      label.textContent = 'New password';
      hint.textContent = '8 characters minimum. Your password must not be used by any other account.';
      $('#auth-secondary').innerHTML = '';
    }

    /* the email is locked while a code is outstanding */
    var em = $('#f-email');
    var locked = isVerify || isNewPass;
    em.readOnly = locked;
    $('#field-email').classList.toggle('is-readonly', locked);

    clearAuthErrors();
  }

  function clearAuthErrors() {
    ['err-username', 'err-email', 'err-pass', 'err-pass2', 'err-code'].forEach(function (id) {
      var el = $('#' + id); if (el) el.classList.remove('show');
    });
    ['f-username', 'f-email', 'f-pass', 'f-pass2', 'f-code'].forEach(function (id) {
      var el = $('#' + id); if (el) el.classList.remove('invalid');
    });
    var note = $('#auth-note');
    if (note) { note.hidden = true; note.textContent = ''; note.className = 'auth-note'; }
  }

  function authError(field, message) {
    var el = $('#' + field);
    if (!el) return;
    var input = { 'err-username': 'f-username', 'err-email': 'f-email', 'err-pass': 'f-pass', 'err-pass2': 'f-pass2', 'err-code': 'f-code' }[field];
    if (field === 'err-username') el.textContent = message || 'Pick a username with 3–24 letters, numbers, dots or underscores.';
    if (field === 'err-email') el.textContent = message || 'Enter a valid email address, e.g. you@example.com';
    if (field === 'err-pass') el.textContent = message || 'Enter your password.';
    if (field === 'err-pass2') el.textContent = message || 'The two passwords do not match.';
    if (field === 'err-code') el.textContent = message || 'That code is not right. Check your email and try again.';
    el.classList.add('show');
    if (input) { var i = $('#' + input); if (i) i.classList.add('invalid'); }
  }

  function authNote(message, kind) {
    var note = $('#auth-note');
    if (!note) return;
    note.textContent = message;
    note.className = 'auth-note' + (kind ? ' is-' + kind : '');
    note.hidden = false;
  }

  /* shown when the project URL is known but the public key is not */
  function showConnectBox() {
    var box = $('#connect-box');
    if (!box) return;
    box.hidden = false;
  }

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function validEmail(v) { return EMAIL_RE.test(String(v || '').trim()); }

  function passwordProblems(pw) {
    var out = [];
    if (!pw) out.push('Enter your password.');
    else {
      if (pw.length < 8) out.push('Use at least 8 characters.');
      if (!/[a-zA-Z]/.test(pw)) out.push('Include a letter.');
      if (!/[0-9]/.test(pw)) out.push('Include a number.');
    }
    return out;
  }

  var USERNAME_RE = /^[a-zA-Z0-9._]{3,24}$/;

  function usernameProblem(u) {
    if (!u) return 'Choose a username.';
    if (!USERNAME_RE.test(u)) return 'Use 3–24 letters, numbers, dots or underscores.';
    if (/^[._]|[._]$/.test(u)) return 'A username cannot start or end with a dot or underscore.';
    return '';
  }

  function usernameAvailable(u) {
    if (!S.client) return Promise.resolve(true);
    return S.client.rpc('username_available', { p_username: u })
      .then(function (r) { return !(r && r.data === false); })
      .catch(function () { return true; });
  }

  /* ---------------------------------------------------------- supabase ops */
  /* One round trip: is this password already in use, and what is the
     fingerprint the sign-up trigger needs? */
  function claimPassword(pw) {
    if (!S.client) return Promise.resolve({ taken: false, fingerprint: null });
    return S.client.rpc('password_claim', { p_password: pw })
      .then(function (r) {
        var d = (r && r.data) || {};
        return { taken: !!d.taken, fingerprint: d.fingerprint || null };
      })
      .catch(function () { return { taken: false, fingerprint: null }; });
  }

  function redirectTo() {
    return window.location.origin + window.location.pathname;
  }

  /* ------------------------------------------------------ Google sign-in */
  /* We flag the moment we leave for Google, so when the browser comes back we
     can tell "an account was chosen" apart from "the prompt was cancelled".
     Cancel must never fall through to a saved session or demo login. */
  function setOAuthPending(on) {
    try {
      if (on) sessionStorage.setItem(OAUTH_PENDING_KEY, '1');
      else sessionStorage.removeItem(OAUTH_PENDING_KEY);
    } catch (e) { /* private browsing: the in-memory flow still works */ }
  }

  function isOAuthPending() {
    try { return sessionStorage.getItem(OAUTH_PENDING_KEY) === '1'; }
    catch (e) { return false; }
  }

  /* Supabase returns OAuth failures in the hash (#error=…) or the query
     string (?error=…). Read both before the SDK tidies the URL up. */
  function authParamsFromUrl() {
    var out = {};
    function read(raw) {
      var s = String(raw || '').replace(/^[?#]/, '');
      if (!s || s.charAt(0) === '/') return;   /* an app route, not an auth result */
      s.split('&').forEach(function (pair) {
        var i = pair.indexOf('=');
        if (i < 1) return;
        var k, v;
        try { k = decodeURIComponent(pair.slice(0, i).replace(/\+/g, ' ')); } catch (e) { k = pair.slice(0, i); }
        try { v = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' ')); } catch (e) { v = pair.slice(i + 1); }
        out[k] = v;
      });
    }
    read(window.location.hash);
    read(window.location.search);
    return out;
  }

  function googleErrorMessage(p) {
    var code = String(p.error_code || p.error || '').toLowerCase();
    var desc = String(p.error_description || p.error_message || '');
    var low = desc.toLowerCase();

    if (code === 'access_denied' || /access[_ ]denied|cancel|denied|closed/.test(low)) {
      return 'Google sign-in was canceled. Choose a Google account to continue — you are not signed in.';
    }
    if (/provider is not enabled|unsupported provider|not enabled/.test(low)) {
      return 'Google sign-in is not enabled yet. Turn it on in Supabase → Authentication → Providers → Google.';
    }
    if (/redirect|uri_mismatch|invalid request/.test(low)) {
      return 'Google rejected the redirect URL. Add this page to the Supabase and Google Cloud redirect URL lists.';
    }
    if (/access blocked|forbidden/.test(low)) {
      return 'Google blocked this sign-in. Check the OAuth consent screen and test-user list in Google Cloud.';
    }
    return 'Google sign-in failed' + (desc ? ': ' + desc : '. Please try again.');
  }

  function cleanAuthUrl() {
    var raw = (window.location.hash || '') + '&' + (window.location.search || '');
    if (!/error=|error_code=|error_description=/.test(raw)) return;
    try { window.history.replaceState(null, '', window.location.pathname); }
    catch (e) { /* older browsers: a stale error in the URL is harmless */ }
  }

  /* Called once on boot. Returns whether this page load is an OAuth return. */
  function readOAuthReturn() {
    var p = authParamsFromUrl();
    var failed = !!(p.error || p.error_code);
    var pending = isOAuthPending();

    if (failed) {
      var code = String(p.error_code || p.error || '').toLowerCase();
      var desc = String(p.error_description || p.error_message || '');
      var message;
      if (pending) {
        message = googleErrorMessage(p);
      } else if (code === 'access_denied' || /access[_ ]denied|cancel/i.test(desc)) {
        message = 'That sign-in was canceled. You are not signed in — please try again.';
      } else {
        message = 'That sign-in link is invalid or has expired. Please start over.';
      }
      setOAuthPending(false);
      cleanAuthUrl();
      return { failed: true, pending: false, message: message };
    }
    return { failed: false, pending: pending, message: '' };
  }

  function setGoogleBusy(busy) {
    var btn = $('#btn-google');
    if (!btn) return;
    btn.disabled = !!busy;
    btn.classList.toggle('is-busy', !!busy);
    var label = btn.querySelector('.btn-google-label');
    if (label) label.textContent = busy ? 'Connecting to Google…' : 'Continue with Google';
  }

  function continueWithGoogle() {
    clearAuthErrors();

    if (!S.client) {
      authNote('Google sign-in needs a live Supabase connection. Add your supabaseUrl and publishable key in assets/js/config.js, then refresh.', 'error');
      return;
    }

    setGoogleBusy(true);

    /* One quick check against the project settings: if the provider is off we
       can explain that instantly instead of sending the user to a dead end. */
    var gate = (typeof S.googleEnabled === 'function') ? S.googleEnabled() : Promise.resolve(null);

    gate.then(function (enabled) {
      if (enabled === false) {
        setGoogleBusy(false);
        authNote('Google sign-in is not enabled yet. Turn it on in Supabase → Authentication → Providers → Google, then try again.', 'error');
        return null;
      }

      /* Drop any leftover local session first. If the user cancels on Google's
         screen there will be no new session, and this guarantees we do not
         silently restore the old one. */
      var ready = Promise.resolve();
      try {
        ready = S.client.auth.signOut({ scope: 'local' }).catch(function () { /* no session */ });
      } catch (e) { ready = Promise.resolve(); }

      return ready.then(function () {
        setOAuthPending(true);
        return S.client.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectTo(),
            skipBrowserRedirect: true,
            queryParams: { prompt: 'select_account', access_type: 'online' }
          }
        });
      }).then(function (r) {
        if (r && r.error) throw r.error;
        if (!r || !r.data || !r.data.url) throw new Error('Google did not return a sign-in URL.');
        window.location.assign(r.data.url);
      });
    }).catch(function (e) {
      setOAuthPending(false);
      setGoogleBusy(false);
      var m = (e && e.message) || 'Could not start Google sign-in. Check your connection and try again.';
      if (/provider is not enabled|unsupported provider/i.test(m)) {
        m = 'Google sign-in is not enabled yet. Turn it on in Supabase → Authentication → Providers → Google.';
      }
      authNote(m, 'error');
    });
  }

  /* "Forgot password?" -> email a reset code, then ask for it */
  function startRecovery(email) {
    auth.purpose = 'recovery';
    auth.pendingEmail = email;
    setAuthStep('verify');
    $('#f-code').value = '';
    $('#f-code').focus();

    if (!S.client) {
      authNote('Demo mode — no reset email was sent. Add your Supabase keys in assets/js/config.js to enable real emails.', 'info');
      return;
    }
    S.client.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() })
      .then(function (r) {
        if (r && r.error) { authNote('We could not send the reset code: ' + r.error.message, 'error'); return; }
        authNote('If an account exists for ' + email + ', a 6-digit reset code is on its way.', 'ok');
      }).catch(function (e) { authNote('We could not send the reset code: ' + e.message, 'error'); });
  }

  function resendCode() {
    var email = auth.pendingEmail;
    if (!email) return;
    if (!S.client) { authNote('Demo mode — no email was sent.', 'info'); return; }

    var req = auth.purpose === 'recovery'
      ? S.client.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() })
      : S.client.auth.resend({ type: 'signup', email: email });

    req.then(function (r) {
      if (r && r.error) { authNote('We could not send a new code: ' + r.error.message, 'error'); return; }
      authNote('Sent a new code to ' + email + '.', 'ok');
    }).catch(function (e) { authNote('We could not send a new code: ' + e.message, 'error'); });
  }

  function verifyCode(email, token) {
    if (!S.client) { signInDemo(); return; }

    var type = auth.purpose === 'recovery' ? 'recovery' : 'signup';

    S.client.auth.verifyOtp({ email: email, token: token, type: type })
      .then(function (r) {
        if (r.error) {
          if (/expired|invalid|incorrect/i.test(r.error.message)) {
            authError('err-code', 'That code is not right or has expired. Ask for a new one.');
          } else {
            authError('err-code', r.error.message);
          }
          return;
        }

        if (auth.purpose === 'recovery') {
          auth.user = r.data.user || null;
          $('#f-pass').value = '';
          $('#f-pass2').value = '';
          setAuthStep('newpass');
          authNote('Email verified. Choose a new password to finish.', 'ok');
          $('#f-pass').focus();
          return;
        }

        onSignedIn(r.data.user);
      }).catch(function (e) { authError('err-code', e.message); });
  }

  function saveNewPassword(pw) {
    if (!S.client) { signInDemo(); return; }
    S.client.auth.updateUser({ password: pw })
      .then(function (r) {
        if (r.error) { authError('err-pass', r.error.message); return; }
        onSignedIn(r.data.user);
      }).catch(function (e) { authError('err-pass', e.message); });
  }

  function signInWithPassword(email, pw) {
    if (!S.client) { signInDemo(); return; }
    S.client.auth.signInWithPassword({ email: email, password: pw })
      .then(function (r) {
        if (r.error) {
          var msg = r.error.message || '';
          if (/not confirmed/i.test(msg)) {
            auth.purpose = 'signup';
            auth.pendingEmail = email;
            setAuthStep('verify');
            $('#f-code').value = '';
            resendCode();
            return;
          }
          if (/invalid login credentials/i.test(msg)) {
            msg = 'Email or password is incorrect. Check both and try again.';
          } else if (/rate limit|too many/i.test(msg)) {
            msg = 'Too many attempts. Wait a minute, then try again.';
          } else if (/failed to fetch|network/i.test(msg)) {
            msg = 'Could not reach the server. Check your connection and try again.';
          }
          authError('err-pass', msg);
          return;
        }
        onSignedIn(r.data.user);
      }).catch(function (e) { authError('err-pass', (e && e.message) || 'Could not sign in. Try again.'); });
  }

  function signUpWithPassword(username, email, pw) {
    if (!S.client) { signInDemo(); return; }

    usernameAvailable(username).then(function (free) {
      if (!free) {
        authError('err-username', 'That username is taken. Try another one.');
        $('#f-username').focus();
        return;
      }

      claimPassword(pw).then(function (claim) {
        if (claim.taken) {
          authError('err-pass', 'That password is already used by another account. Please pick a different one.');
          return;
        }

        var data = { username: username, full_name: username };
        if (claim.fingerprint) data.password_fingerprint = claim.fingerprint;

        S.client.auth.signUp({
          email: email,
          password: pw,
          options: { data: data, emailRedirectTo: redirectTo() }
        }).then(function (r) {
          if (r.error) {
            var m = r.error.message || '';
            if (/PASSWORD_ALREADY_IN_USE/i.test(m)) {
              authError('err-pass', 'That password is already used by another account. Please pick a different one.');
            } else if (/already registered|duplicate/i.test(m)) {
              authError('err-email', 'An account already uses this email. Sign in instead.');
            } else {
              authError('err-pass', m);
            }
            return;
          }

          /* confirmation turned off -> straight in */
          if (r.data.session) { onSignedIn(r.data.user); return; }

          /* confirmation turned on -> ask for the emailed code */
          auth.purpose = 'signup';
          auth.pendingEmail = email;
          setAuthStep('verify');
          $('#f-code').value = '';
          authNote('Account created. We emailed a 6-digit code to ' + email + '.', 'ok');
          $('#f-code').focus();
        }).catch(function (e) { authError('err-pass', e.message); });
      });
    });
  }

  function enterApp(user, opts) {
    opts = opts || {};

    /* getSession() and the auth listener can both report the same sign-in.
       Only the first call should start hydration and show the toast. */
    if (state.signedIn && (cloud.loading || ($('#view-app') && !$('#view-app').classList.contains('hidden')))) {
      auth.user = user || auth.user;
      setOAuthPending(false);
      return;
    }

    auth.user = user || null;
    state.signedIn = true;
    setOAuthPending(false);
    applyUser(user);

    var hash = (window.location.hash || '').replace('#/', '');
    state.route = opts.route || (['dashboard', 'lists', 'spending'].indexOf(hash) !== -1 ? hash : 'dashboard');
    try { window.history.replaceState(null, '', '#/' + state.route); } catch (e) { /* ignore */ }

    if (S.client && user) {
      showAppLoading('Loading your saved lists…');
      hydrateCloud(user).then(function () {
        hideAppLoading();
        showApp();
        var first = you().name.split(' ')[0];
        toast(opts.google ? 'Signed in with Google — welcome, ' + first + '!' : 'Welcome back, ' + first + '!');
      }).catch(function (err) {
        hideAppLoading();
        cloudError('Could not load your saved lists', err);
        showApp();
      });
      return;
    }

    save();
    showApp();
    var first = you().name.split(' ')[0];
    toast(opts.google ? 'Signed in with Google — welcome, ' + first + '!' : 'Welcome, ' + first + '!');
  }

  function onSignedIn(user, opts) {
    opts = opts || {};

    /* both getSession() and the auth listener can report the same sign-in;
       only the first one should move the screen and show the toast */
    if (state.signedIn && (cloud.loading || ($('#view-app') && !$('#view-app').classList.contains('hidden')))) {
      auth.user = user || auth.user;
      setOAuthPending(false);
      return;
    }

    enterApp(user, opts);
  }

  /* demo mode: no backend, everything stays in the browser */
  function signInDemo() {
    enterApp(null, { demo: true });
  }

  function submitAuth(e) {
    e.preventDefault();
    clearAuthErrors();

    var username = ($('#f-username').value || '').trim();
    var email = ($('#f-email').value || '').trim();
    var pw = $('#f-pass').value || '';
    var pw2 = $('#f-pass2').value || '';
    var code = ($('#f-code').value || '').replace(/\D/g, '');

    /* ---- step 2 of sign-up: the emailed code ---- */
    if (auth.step === 'verify') {
      if (!code) { authError('err-code', 'Enter the 6-digit code from your email.'); $('#f-code').focus(); return; }
      if (code.length !== 6) { authError('err-code', 'The code is 6 digits long.'); $('#f-code').focus(); return; }
      verifyCode(auth.pendingEmail, code);
      return;
    }

    /* ---- step 3 of a password reset: the new password ---- */
    if (auth.step === 'newpass') {
      var np = passwordProblems(pw);
      if (np.length) { authError('err-pass', np[0]); $('#f-pass').focus(); return; }
      if (pw !== pw2) { authError('err-pass2'); $('#f-pass2').focus(); return; }
      saveNewPassword(pw);
      return;
    }

    if (!validEmail(email)) { authError('err-email'); $('#f-email').focus(); return; }

    if (auth.step === 'signup') {
      var up = usernameProblem(username);
      if (up) { authError('err-username', up); $('#f-username').focus(); return; }

      var sp = passwordProblems(pw);
      if (sp.length) { authError('err-pass', sp[0]); $('#f-pass').focus(); return; }
      if (pw !== pw2) { authError('err-pass2'); $('#f-pass2').focus(); return; }

      signUpWithPassword(username, email, pw);
      return;
    }

    var problems = passwordProblems(pw);
    if (problems.length) { authError('err-pass', problems[0]); $('#f-pass').focus(); return; }

    signInWithPassword(email, pw);
  }

  /* =============================== EVENTS ================================= */
  function bind() {
    /* ---- auth ---- */
    $('#login-form').addEventListener('submit', submitAuth);

    var googleBtn = $('#btn-google');
    if (googleBtn) googleBtn.addEventListener('click', continueWithGoogle);

    function bindReveal(btnId, inputId) {
      var b = $('#' + btnId);
      if (!b) return;
      b.addEventListener('click', function () {
        var p = $('#' + inputId);
        var showing = p.type === 'text';
        p.type = showing ? 'password' : 'text';
        this.innerHTML = icon(showing ? 'eye' : 'eye-off');
        this.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      });
    }
    bindReveal('toggle-pass', 'f-pass');
    bindReveal('toggle-pass2', 'f-pass2');

    /* ---- connect box: paste the Supabase public key ---- */
    var connectBtn = $('#connect-save');
    if (connectBtn) {
      var finishConnect = function () { window.location.reload(); };

      connectBtn.addEventListener('click', function () {
        var hint = $('#connect-hint');
        var projectUrl = S.url || 'https://xsjwhwrnseevlntxwjeg.supabase.co';
        var k = ($('#connect-key').value || '').trim();

        hint.className = 'connect-hint';

        if (k.length < 20) {
          hint.textContent = 'That does not look like a key — copy the whole value from the dashboard.';
          hint.className = 'connect-hint is-error';
          return;
        }
        if (/^sb_secret_/.test(k)) {
          hint.textContent = 'That is the secret key. Use the publishable (or anon) key instead.';
          hint.className = 'connect-hint is-error';
          return;
        }

        connectBtn.disabled = true;
        connectBtn.textContent = 'Connecting…';
        hint.textContent = 'Checking the key with Supabase…';

        S.testConnection(projectUrl, k).then(function (ok) {
          if (!ok) {
            connectBtn.disabled = false;
            connectBtn.textContent = 'Connect';
            hint.textContent = 'Supabase rejected that key. Make sure it belongs to project xsjwhwrnseevlntxwjeg and is the publishable / anon key.';
            hint.className = 'connect-hint is-error';
            return;
          }
          S.saveConfig(projectUrl, k);
          hint.textContent = 'Key accepted. Reloading…';
          hint.className = 'connect-hint is-ok';
          finishConnect();
        });
      });

      $('#connect-key').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); connectBtn.click(); }
      });
    }

    document.addEventListener('click', function (e) {
      var su = e.target.closest('#link-signup') || e.target.closest('#link-signup-top');
      if (su) {
        e.preventDefault();
        if (auth.step === 'verify' || auth.step === 'newpass') {
          /* "start over" — abandon the pending code */
          auth.purpose = 'signup';
          auth.pendingEmail = '';
          $('#f-code').value = '';
        }
        setAuthStep('signup');
        return;
      }

      var si = e.target.closest('#link-signin') || e.target.closest('#link-signin-top');
      if (si) {
        e.preventDefault();
        auth.purpose = 'signup';
        auth.pendingEmail = '';
        $('#f-code').value = '';
        $('#f-pass').value = '';
        $('#f-pass2').value = '';
        setAuthStep('signin');
        return;
      }

      var rs = e.target.closest('#link-resend');
      if (rs) {
        e.preventDefault();
        resendCode();
        return;
      }

      var fg = e.target.closest('#link-forgot');
      if (fg) {
        e.preventDefault();
        var em = ($('#f-email').value || '').trim();
        if (!validEmail(em)) { authError('err-email'); $('#f-email').focus(); return; }
        startRecovery(em);
        return;
      }
    });

    /* ---- topbar ---- */
    $('#btn-profile').addEventListener('click', function (e) {
      e.stopPropagation();
      toggleProfileMenu();
    });
    $('#btn-bell').addEventListener('click', function () {
      toast('You have 3 new household updates');
    });
    $('#mnav-profile').addEventListener('click', function (e) {
      e.preventDefault();
      openDrawer();
    });

    /* ---- profile menu ---- */
    $('#pmenu').addEventListener('click', function (e) {
      var wsBtn = e.target.closest('.pmenu-ws');
      if (wsBtn) {
        state.workspaces.forEach(function (w) { w.active = w.id === wsBtn.dataset.ws; });
        renderTopbar();
        toggleProfileMenu(false);
        toast('Switched to ' + activeWorkspace().name);
        return;
      }
      var item = e.target.closest('[data-pm]');
      if (!item) return;
      switch (item.dataset.pm) {
        case 'my-profile':
          toggleProfileMenu(false);
          openDrawer();
          break;
        case 'manage-members':
          toggleProfileMenu(false);
          openDrawer();
          setTimeout(function () {
            var block = $('#members-block');
            if (block) {
              block.scrollIntoView({ behavior: 'smooth', block: 'center' });
              block.animate(
                [{ boxShadow: '0 0 0 0 rgba(60,148,89,0)' }, { boxShadow: '0 0 0 6px rgba(60,148,89,.22)' }, { boxShadow: '0 0 0 0 rgba(60,148,89,0)' }],
                { duration: 900, easing: 'ease-out' }
              );
            }
          }, 320);
          break;
        case 'settings':
          toggleProfileMenu(false);
          toast('Household settings is part of the next build');
          break;
        case 'signout':
          toggleProfileMenu(false);
          signOut();
          break;
      }
    });

    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('#profile-menu')) return;
      toggleProfileMenu(false);
    });
    /* close the item popover when clicking anywhere else */
    document.addEventListener('click', function (e) {
      if (!state.editingId) return;
      if (e.target.closest && (e.target.closest('.item-pop') || e.target.closest('[data-act="edit-item"]'))) return;
      state.editingId = null;
      render();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeDrawer(); toggleProfileMenu(false); }
    });

    /* ---- global click delegation (app) ---- */
    $('#view-app').addEventListener('click', onAppClick);
    $('#view-app').addEventListener('input', onAppInput);
    $('#view-app').addEventListener('change', onAppChange);
    $('#add-modal').addEventListener('click', onAppClick);
    $('#add-modal').addEventListener('input', onAppInput);
    $('#cat-modal').addEventListener('click', onCatPanelClick);
    $('#cat-modal').addEventListener('change', onCatPanelChange);
    $('#cat-modal').addEventListener('keydown', onCatPanelKeydown);
    $('#drawer-content').addEventListener('click', onDrawerClick);
    $('#drawer-content').addEventListener('change', onDrawerChange);
    $('#scrim').addEventListener('click', closeDrawer);
    window.addEventListener('hashchange', onHashChange);

    /* If the browser restores this page from its back/forward cache after the
       user backed out of Google, the load handler never runs. Reset the button
       and confirm there is no session before showing the cancelled message. */
    window.addEventListener('pageshow', function (e) {
      if (!e.persisted) return;
      setGoogleBusy(false);
      if (!isOAuthPending()) return;

      var cancelled = function () {
        setOAuthPending(false);
        showLogin();
        authNote('Google sign-in was canceled. Choose a Google account to continue — you are not signed in.', 'error');
      };

      if (!S.client) { cancelled(); return; }
      S.client.auth.getSession().then(function (r) {
        var session = r && r.data ? r.data.session : null;
        if (session && session.user) onSignedIn(session.user, { google: true });
        else cancelled();
      }).catch(cancelled);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target && e.target.id === 'add-search') {
        e.preventDefault();
        reviewTyped();
        return;
      }
      if (e.key === 'Escape') {
        closeDrawer();
        toggleProfileMenu(false);
        if (state.catPanelOpen) closeCategories();
        if (state.addModal && state.addModal.open) closeAddModal();
      }
    });

    /* ---- brand artwork: prefer the supplied JPG, fall back to the SVG ---- */
    fetch('assets/img/BiliLIST_logo2.jpg', { method: 'HEAD' })
      .then(function (res) {
        if (!res.ok) return;
        $$('[data-brand-art]').forEach(function (el) { el.src = 'assets/img/BiliLIST_logo2.jpg'; });
      })
      .catch(function () { /* the SVG fallback is already in place */ });
  }

  function onAppClick(e) {
    /* clicking the backdrop closes the add modal */
    if (e.target && e.target.id === 'add-modal') { closeAddModal(); return; }
    var el = e.target.closest ? e.target.closest('[data-act],[data-route],[data-list],[data-tab],[data-cal],[data-srange],[data-pantry],[data-scat],[data-sug-name],[data-unit]') : null;
    if (!el) return;

    /* --- add-item suggestions --- */
    /* --- unit chips (no dropdown, so nothing can overflow) --- */
    if (el.dataset.unit) {
      var picker = el.closest('.unit-picker');
      if (!picker) return;
      $$('.unit-chip', picker).forEach(function (c) { c.classList.toggle('is-active', c === el); });
      if (picker.id === 'edit-unit-picker') {
        state.editUnit = el.dataset.unit;
        var eu = unitDef(el.dataset.unit);
        var eh = document.querySelector('.item-pop .qty-hint');
        if (eh) eh.textContent = 'Up to ' + unitQty(eu, eu.max) + ' in one trip. Decimals are fine — ' + unitExample(eu) + ' works.';
        clearEditError();
      } else if (picker.id === 'rv-unit-picker') {
        if (state.addModal && state.addModal.draft) state.addModal.draft.u = el.dataset.unit;
        var ru = unitDef(el.dataset.unit);
        var rh = document.querySelector('.review .qty-hint');
        if (rh) rh.textContent = 'Up to ' + unitQty(ru, ru.max) + ' in one trip. Decimals are fine — ' + unitExample(ru) + ' works.';
        clearQtyError();
      } else {
        state.addQty.u = el.dataset.unit;
        state.addQtyTouched = true;
        var su = unitDef(el.dataset.unit);
        var sh = document.querySelector('.sug-qty-hint');
        if (sh) sh.textContent = 'max ' + unitQty(su, su.max);
        var sn = $('#sug-qty-n');
        if (sn) {
          var sv = validateQty(sn.value, el.dataset.unit);
          sn.classList.toggle('invalid', !sv.ok && sn.value.trim() !== '');
        }
      }
      return;
    }

    if (el.dataset.scat) {
      state.addCategory = el.dataset.scat;
      if (state.addModal && state.addModal.open) {
        if (!state.addQtyTouched) state.addQty = defaultQtyFor(state.addModal.query);
        renderAddSuggestions();
      }
      return;
    }
    if (el.dataset.sugName) {
      reviewSuggestion(el.dataset.sugName, el.dataset.sugCat, el.dataset.sugN, el.dataset.sugU);
      return;
    }

    if (el.dataset.pantry) {
      var pcat = el.dataset.pantryCat || guessCategory(el.dataset.pantry);
      var pn = el.dataset.pantryN ? Number(el.dataset.pantryN) : 1;
      var pu = el.dataset.pantryU || 'pcs';
      pushItem(el.dataset.pantry, { n: pn, u: pu }, pcat);
      render();
      toast('“' + el.dataset.pantry + '” added to ' + catName(pcat));
      return;
    }

    if (el.dataset.route) { go(el.dataset.route); return; }
    if (el.dataset.list) {
      var target = null;
      state.lists.forEach(function (l) { if (l.id === el.dataset.list) target = l; });
      state.activeListId = el.dataset.list;
      save();
      if (state.route === 'lists') { go('dashboard'); }
      else render();
      if (target) toast('Now viewing “' + target.name + '”');
      return;
    }
    if (el.dataset.tab) { state.activeAisleTab = el.dataset.tab; render(); return; }
    if (el.dataset.srange) { state.spendingRange = el.dataset.srange; render(); return; }
    if (el.dataset.cal) {
      if (el.dataset.cal === 'prev') state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() - 1, 1);
      else if (el.dataset.cal === 'next') state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + 1, 1);
      else { toast('Event editor is part of the next build'); return; }
      render();
      return;
    }
    if (el.dataset.day) { state.selectedDay = el.dataset.day; render(); return; }

    switch (el.dataset.act) {
      case 'toggle': {
        var row = el.closest('.item-row');
        var list = activeList();
        var msg = null;
        var changed = null;
        list.items.forEach(function (it) {
          if (it.id !== row.dataset.id) return;
          it.done = !it.done;
          changed = it;
          if (cloudMode()) {
            /* Supabase keeps the pantry in sync with a trigger. */
            msg = it.name + (it.done ? ' moved to the pantry' : ' moved back to To Buy');
          } else if (it.done) {
            msg = addToInventory(it);
          } else {
            removeFromInventory(it);
            msg = it.name + ' moved back to To Buy';
          }
        });
        save(); render();
        if (msg) toast(msg);

        if (cloudMode() && changed) {
          var nextDone = changed.done;
          cloudToggleItem(changed, nextDone).then(function (saved) {
            list.items = list.items.map(function (it) { return it.id === saved.id ? saved : it; });
            return cloudRefreshPantry().then(render).catch(function (err) {
              render();
              cloudError('Item saved, but the pantry could not refresh', err);
            });
          }).catch(function (err) {
            changed.done = !nextDone;
            render();
            cloudError('Could not update that item', err);
          });
        }
        break;
      }
      case 'del': {
        var r2 = el.closest('.item-row');
        var l2 = activeList();
        var removed = l2.items.filter(function (i) { return i.id === r2.dataset.id; })[0];
        l2.items = l2.items.filter(function (i) { return i.id !== r2.dataset.id; });
        save(); render();
        if (removed) toast('Removed “' + removed.name + '”');

        if (cloudMode() && removed) {
          cloudDeleteItem(removed).then(function () {
            return cloudRefreshPantry().then(render).catch(function (err) {
              render();
              cloudError('Item removed, but the pantry could not refresh', err);
            });
          }).catch(function (err) {
            l2.items.push(removed);
            render();
            cloudError('Could not remove that item', err);
          });
        }
        break;
      }
      case 'toggle-life': {
        var li = el.closest('.life-item');
        state.lifeAdmin.forEach(function (t) { if (t.id === li.dataset.life) t.done = !t.done; });
        save(); render();
        break;
      }
      case 'edit-item': {
        var er = el.closest('.item-row');
        var l0 = activeList();
        var target = l0.items.filter(function (i) { return i.id === er.dataset.id; })[0];
        if (state.editingId === er.dataset.id) {
          state.editingId = null;
          render();
        } else {
          state.editingId = er.dataset.id;
          state.editUnit = target ? target.qty.u : 'pcs';
          render();
          /* flip the popover upward when the row sits near the bottom */
          setTimeout(function () {
            var pop = document.querySelector('.item-pop');
            if (!pop) return;
            var row = pop.closest('.item-row').getBoundingClientRect();
            if (row.bottom + 320 > window.innerHeight) pop.classList.add('pop-up');
          }, 0);
        }
        break;
      }
      case 'save-item': {
        var sr = el.closest('.item-row');
        saveItemEdit(sr.dataset.id);
        break;
      }
      case 'cancel-edit':
        state.editingId = null; render();
        break;
      case 'open-add': openAddModal(''); break;
      case 'close-add': closeAddModal(); break;
      case 'add-back':
        state.addModal.step = 'search';
        state.addModal.draft = null;
        renderAddModal();
        break;
      case 'confirm-add': confirmAdd(); break;
      case 'add-query': reviewTyped(); break;
      case 'add-named': openAddModal(el.dataset.name || ''); break;
      case 'clear-search': state.listQuery = ''; render(); break;
      case 'new-list': newList(); break;
      case 'new-pantry': newPantryItem(); break;
      case 'new-event': toast('Event editor is part of the next build'); break;
      case 'share': toast('Share link copied to clipboard'); break;
      case 'export': toast('Spending report exported as CSV'); break;
      case 'open-categories': openCategories(); break;
    }
  }

  /* keeps the "Add to X" button label in sync with the chosen category */
  function renderListFooterBits() {
    var btn = $('#btn-add-item');
    if (btn) {
      btn.innerHTML = icon('plus') + '<span>' +
        (state.addCategory === 'auto' ? 'Add item' : 'Add to ' + esc(catName(state.addCategory))) + '</span>';
    }
  }

  /* live search in the add-item field */
  function onAppInput(e) {
    var t = e.target;
    if (!t) return;
    var id = t.id;

    /* the find-in-list search only filters the list */
    if (id === 'list-search') {
      state.listQuery = t.value;
      render();
      var again = $('#list-search');
      if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
      return;
    }

    /* the add modal's product search */
    if (id === 'add-search') {
      state.addModal.query = t.value;
      if (!state.addQtyTouched) state.addQty = defaultQtyFor(t.value);
      renderAddSuggestions();
      return;
    }

    /* amount fields — validate as you type, no letters allowed */
    if (id === 'sug-qty-n' || id === 'rv-n' || id === 'edit-qty-n') {
      var unitKey = id === 'rv-n' ? (state.addModal.draft ? state.addModal.draft.u : 'pcs')
                : id === 'edit-qty-n' ? (state.editUnit || 'pcs')
                : state.addQty.u;
      var v = validateQty(t.value, unitKey);
      t.classList.toggle('invalid', !v.ok && t.value.trim() !== '');
      t.setAttribute('aria-invalid', v.ok ? 'false' : 'true');
      if (id === 'rv-n') { if (v.ok) clearQtyError(); else showQtyError(v.msg); }
      if (id === 'edit-qty-n') { if (v.ok) clearEditError(); else showEditError(v.msg); }
      if (id === 'sug-qty-n' && v.ok) {
        state.addQty.n = v.n;
        state.addQtyTouched = true;
      }
      return;
    }
  }

  function onAppChange(e) {
    var t = e.target;
    if (!t) return;
    if (t.id === 'list-search') { state.listQuery = t.value; render(); }
  }

  /* =============================== CATEGORY PANEL ======================== */
  function onCatPanelClick(e) {
    var close = e.target.closest('[data-act="close-categories"]');
    if (close) { closeCategories(); return; }

    if (e.target.id === 'cat-modal') { closeCategories(); return; }

    var tone = e.target.closest('.tone-dot');
    if (tone) {
      $$('#tone-picker .tone-dot').forEach(function (b) { b.classList.remove('is-active'); });
      tone.classList.add('is-active');
      return;
    }

    var rm = e.target.closest('[data-rmkw]');
    if (rm) { removeKeyword(rm.dataset.rmkw, rm.dataset.kw); renderCategoriesPanel(); return; }

    var toggleKw = e.target.closest('[data-toggle-kw]');
    if (toggleKw) {
      var kid = toggleKw.dataset.toggleKw;
      state.expandedCats[kid] = !state.expandedCats[kid];
      renderCategoriesPanel();
      return;
    }

    var del = e.target.closest('[data-delcat]');
    if (del) { deleteCategory(del.dataset.delcat); return; }

    var add = e.target.closest('[data-act="add-category"]');
    if (add) { addCategory(); return; }

    var reset = e.target.closest('[data-act="reset-categories"]');
    if (reset) {
      if (cloudMode()) {
        toast('Categories are shared with your household — rename or remove them instead.');
        return;
      }
      state.categories = JSON.parse(JSON.stringify(D.categories));
      state.addCategory = 'auto';
      save(); renderCategoriesPanel(); render();
      toast('Categories reset to default');
      return;
    }
  }

  function onCatPanelChange(e) {
    if (e.target.classList && e.target.classList.contains('cat-name')) {
      renameCategory(e.target.id.replace('catname-', ''), e.target.value);
    }
  }

  function onCatPanelKeydown(e) {
    if (e.key !== 'Enter') return;
    if (e.target.classList && e.target.classList.contains('kw-input')) {
      e.preventDefault();
      addKeyword(e.target.id.replace('kw-', ''), e.target.value);
      e.target.value = '';
      renderCategoriesPanel();
      return;
    }
    if (e.target.id === 'new-cat-name' || e.target.id === 'new-cat-kw') {
      e.preventDefault();
      addCategory();
    }
  }

  function onDrawerClick(e) {
    var el = e.target.closest ? e.target.closest('[data-act],[data-ws],[data-resend]') : null;
    if (!el) return;

    if (el.dataset.ws) {
      state.workspaces.forEach(function (w) { w.active = w.id === el.dataset.ws; });
      renderDrawer();
      toast('Switched to ' + (state.workspaces.filter(function (w) { return w.active; })[0] || {}).name);
      return;
    }
    if (el.dataset.resend) { toast('Invite re-sent to ' + el.dataset.resend); return; }

    switch (el.dataset.act) {
      case 'close-drawer': closeDrawer(); break;
      case 'manage-members': {
        var block = $('#members-block');
        if (block) {
          block.scrollIntoView({ behavior: 'smooth', block: 'center' });
          block.animate(
            [{ boxShadow: '0 0 0 0 rgba(60,148,89,0)' }, { boxShadow: '0 0 0 6px rgba(60,148,89,.22)' }, { boxShadow: '0 0 0 0 rgba(60,148,89,0)' }],
            { duration: 900, easing: 'ease-out' }
          );
        }
        break;
      }
      case 'invite': invite(); break;
      case 'household-settings': toast('Household settings is part of the next build'); break;
      case 'signout': signOut(); break;
    }
  }

  function onDrawerChange(e) {
    if (e.target.dataset && e.target.dataset.member) {
      var id = e.target.dataset.member;
      state.members.forEach(function (m) { if (m.id === id) m.role = e.target.value; });
      save();
      toast('Role updated to ' + e.target.value);
    }
  }

  /* =============================== INIT ================================== */
  function init() {
    load();

    /* Read the OAuth result before Supabase touches the URL. An error here
       means no account was chosen, so we deliberately do not sign anyone in. */
    var oauth = readOAuthReturn();

    bind();

    if (S.client) {
      /* catch the sign-in event for OAuth returns; e-mail/password is handled
         by its own promise, so only act while an OAuth round trip is pending */
      S.client.auth.onAuthStateChange(function (event, session) {
        if (event === 'SIGNED_IN' && session && session.user && !state.signedIn && isOAuthPending()) {
          onSignedIn(session.user, { google: true });
        }
      });

      S.client.auth.getSession().then(function (r) {
        var session = r && r.data ? r.data.session : null;
        var user = session ? session.user : null;

        if (oauth.failed) {
          /* belt and braces: a cancelled prompt must not revive an old session */
          try { S.client.auth.signOut({ scope: 'local' }).catch(function () {}); } catch (e) { /* ignore */ }
          state.signedIn = false;
          showLogin();
          authNote(oauth.message, 'error');
          return;
        }

        if (session && user) {
          var h = (window.location.hash || '').replace('#/', '');
          var route = ['lists', 'spending'].indexOf(h) !== -1 ? h : 'dashboard';
          enterApp(user, { google: !!oauth.pending, route: route });
          return;
        }

        state.signedIn = false;
        showLogin();
        if (oauth.pending) {
          setOAuthPending(false);
          authNote('Google sign-in was canceled. Choose a Google account to continue — you are not signed in.', 'error');
        }
      }).catch(function () {
        state.signedIn = false;
        showLogin();
        if (oauth.pending) setOAuthPending(false);
      });
    } else {
      var hh = (window.location.hash || '').replace('#/', '');
      if (['dashboard', 'lists', 'spending'].indexOf(hh) !== -1) state.route = hh;
      if (oauth.failed) {
        state.signedIn = false;
        showLogin();
        authNote(oauth.message, 'error');
      } else if (state.signedIn) {
        applyUser(null);
        showApp();
      } else {
        showLogin();
      }
    }

    setAuthStep('signin');
    if (!S.client) {
      if (S.hasUrl && !S.hasKey) {
        showConnectBox();
      } else if (S.initError) {
        authNote(S.initError, 'error');
      } else if (S.hasUrl && S.hasKey) {
        authNote('The Supabase SDK did not load. Check your internet connection, then refresh the page.', 'error');
      } else {
        authNote('Demo mode — data is stored in this browser only. Add your Supabase URL and anon key in assets/js/config.js to turn on real accounts.', 'info');
      }
    }

    window.__bililist = {
      state: state,
      reset: resetDemo,
      D: D,
      auth: auth,
      supabase: S,
      setAuthStep: setAuthStep,
      applyUser: applyUser,
      showApp: showApp,
      enterApp: enterApp,
      cloud: cloud,
      realtime: {
        start: startRealtime,
        stop: stopRealtime,
        event: onRealtimeEvent,
        relevant: realtimeRelevant,
        refresh: runCloudRefresh
      }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
