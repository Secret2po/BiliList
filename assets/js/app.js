/* ==========================================================================
   BiliLIST — prototype application logic
   Vanilla JS, no build step. State is persisted to localStorage.
   ========================================================================== */
(function () {
  'use strict';

  var D = window.BiliList;
  var STORE_KEY = 'bililist.prototype.v1';

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
    lists: JSON.parse(JSON.stringify(D.lists)),
    lifeAdmin: JSON.parse(JSON.stringify(D.lifeAdmin)),
    events: JSON.parse(JSON.stringify(D.events)),
    activity: JSON.parse(JSON.stringify(D.activity)),
    members: JSON.parse(JSON.stringify(D.members)),
    categories: JSON.parse(JSON.stringify(D.categories)),
    pending: [
      { email: 'mika.santos@email.com', role: 'Editor', sent: '2 days ago' }
    ],
    activeListId: 'l1',
    activeAisleTab: 'tobuy',
    spendingRange: 'w1',
    calMonth: new Date(D.TODAY.getFullYear(), D.TODAY.getMonth(), 1),
    selectedDay: D.iso(D.TODAY),
    addCategory: 'auto',
    addQty: { n: 1, u: 'pcs' },
    addQtyTouched: false,
    editUnit: 'pcs',
    editingId: null,
    catPanelOpen: false,
    expandedCats: {}
  };

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
    return c ? 'other' : (state.categories[0] ? state.categories[0].id : 'other');
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
  /* a flat row of unit chips — no native dropdown, so nothing can overflow */
  function unitPicker(selected, id) {
    return '<div class="unit-picker" id="' + id + '">' + D.units.map(function (g) {
      return '<div class="up-group">' +
        '<span class="up-label">' + esc(g.group) + '</span>' +
        g.units.map(function (u) {
          return '<button type="button" class="unit-chip' + (u.k === selected ? ' is-active' : '') + '" data-unit="' + u.k + '">' + esc(u.l) + '</button>';
        }).join('') +
      '</div>';
    }).join('') + '</div>';
  }
  /* {n: 2, u: 'pcs'} -> "2 pcs" */
  function qtyText(q) {
    if (q == null) return '';
    if (typeof q === 'string') return q;
    return q.n + ' ' + unitLabel(q.u);
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

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        signedIn: state.signedIn,
        lists: state.lists,
        lifeAdmin: state.lifeAdmin,
        events: state.events,
        members: state.members,
        categories: state.categories,
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
        if (!it.qty || typeof it.qty !== 'object') it.qty = { n: 1, u: 'pc' };
        if (it.qty.u === 'run') it.qty.u = 'pc';
      });
    });
  }

  function resetDemo() {
    localStorage.removeItem(STORE_KEY);
    location.reload();
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
    var you = state.members.filter(function (m) { return m.you; })[0] || state.members[0];
    var ws = activeWorkspace();
    $('#chip-avatar').textContent = you.initials;
    $('#chip-household').textContent = ws.name;
    $('#chip-sub').textContent = you.name.split(' ')[0] + ' · Household ' + you.role.toLowerCase();
    renderProfileMenu(you, ws);
  }

  function activeWorkspace() {
    for (var i = 0; i < D.workspaces.length; i++) if (D.workspaces[i].active) return D.workspaces[i];
    return D.workspaces[0];
  }

  function renderProfileMenu(you, ws) {
    $('#pmenu-avatar').textContent = you.initials;
    $('#pmenu-name').textContent = you.name;
    $('#pmenu-mail').textContent = you.email;

    $('#pmenu-workspaces').innerHTML = D.workspaces.map(function (w) {
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
        '<p>Welcome back, Alex. Here\'s what\'s new in your household\'s plate.</p>' +
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
    return '<div class="item-pop" data-pop="' + it.id + '">' +
      '<div class="pop-head">' +
        '<span>Edit item</span>' +
        '<button class="pop-x" data-act="cancel-edit" aria-label="Close">' + icon('x') + '</button>' +
      '</div>' +
      '<label class="pop-label">Name</label>' +
      '<input class="input" id="edit-name" value="' + esc(it.name) + '" aria-label="Item name">' +
      '<label class="pop-label">Quantity</label>' +
      '<div class="pop-qty">' +
        '<input class="input pop-n" id="edit-qty-n" type="number" min="0" step="1" value="' + it.qty.n + '" aria-label="Amount">' +
        unitPicker(state.editUnit || it.qty.u, 'edit-unit-picker') +
      '</div>' +
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

    var qtyRow = '<div class="sug-qty">' +
      '<div class="sug-qty-top">' +
        '<span class="sug-qty-label">Add as</span>' +
        '<input class="input sug-qty-n" id="sug-qty-n" type="number" min="0" step="1" value="' + state.addQty.n + '" aria-label="Amount">' +
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

  /* the "Pantry & Inventory" tab shows what is already on the shelves */
  function inventoryRows() {
    return D.pantry.map(function (p) {
      return '<div class="inv-row">' +
        '<span class="inv-ico' + (p.level === 'low' ? ' is-low' : '') + '">' + icon(p.level === 'low' ? 'bulb' : 'box') + '</span>' +
        '<span class="inv-name">' + esc(p.name) + '</span>' +
        '<span class="inv-qty">' + esc(p.qty) + '</span>' +
        '<span class="inv-exp' + (p.level === 'low' ? ' is-low' : '') + '">' + esc(p.expiry) + '</span>' +
        '<button class="inv-add" data-pantry="' + esc(p.name) + '">' + icon('plus') + ' Add to list</button>' +
      '</div>';
    }).join('');
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

    var body = '';
    if (tab === 'inventory') {
      body = '<div class="inv-head"><span>Item</span><span>On hand</span><span>Shelf life</span><span></span></div>' +
        '<div class="inv-body">' + inventoryRows() + '</div>';
    } else {
      var items = tab === 'pantry' ? bought : toBuy;
      var groups = aisleGroups(items).map(function (g) {
        return '<div class="aisle-group">' +
          '<div class="aisle-head">' +
            '<span class="aisle-name"><i class="a-dot"></i>' + esc(g.name) + '</span>' +
            '<span class="aisle-cols"><span>Quantity</span><span>Assigned to</span></span>' +
          '</div>' +
          '<div class="aisle-body">' + g.items.map(itemRow).join('') + '</div>' +
        '</div>';
      }).join('');

      body = groups || '<div class="empty-state">' +
        (tab === 'pantry'
          ? 'Nothing in the pantry yet. Items you check off land here automatically.'
          : 'Everything is bought. Nice work — nothing left to pick up.') +
      '</div>';
    }

    var nextRun = state.events.filter(function (e) { return e.kind === 'list'; })[0];
    var nextLabel = 'Not scheduled';
    if (nextRun) nextLabel = shortDate(new Date(nextRun.date + 'T00:00:00'));

    var tabs = [
      { id: 'tobuy', label: 'To Buy', n: toBuy.length },
      { id: 'pantry', label: 'Pantry', n: bought.length },
      { id: 'inventory', label: 'Inventory', n: D.pantry.length }
    ].map(function (t) {
      return '<button class="ls-pill' + (tab === t.id ? ' is-active' : '') + '" data-tab="' + t.id + '">' +
        t.label + ' <span class="pill-count">' + t.n + '</span></button>';
    }).join('');

    return '<section class="card list-card">' +
      '<div class="list-head">' +
        '<div class="list-title-row">' +
          '<div>' +
            '<span class="eyebrow">Shared grocery list</span>' +
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

      '<div class="add-row">' +
        '<div class="add-input-wrap">' +
          '<div class="add-input">' +
            '<svg class="ic"><use href="#i-search"/></svg>' +
            '<input class="input" id="new-item" placeholder="Search or add an item — e.g. dishwashing liquid" autocomplete="off">' +
          '</div>' +
          '<div class="sug-panel" id="sug-panel" hidden>' + suggestPanelHtml('') + '</div>' +
        '</div>' +
        '<button class="btn-add" data-act="add-item" id="btn-add-item">' + icon('plus') +
          '<span>' + (state.addCategory === 'auto' ? 'Add item' : 'Add to ' + esc(catName(state.addCategory))) + '</span>' +
        '</button>' +
        '<span class="add-hint">Type to search — we suggest items and detect the category for you</span>' +
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
      '<div class="life-items">' + rows + '</div>' +
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
      '<div class="coming-list">' + rows + '</div>' +
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
      '<div class="effort-list">' + rows + '</div>' +
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
    var pantryRows = D.pantry.map(function (p) {
      return '<div class="pantry-row">' +
        '<span class="pantry-ico">' + icon(p.level === 'low' ? 'bulb' : 'box') + '</span>' +
        '<div class="p-name">' + esc(p.name) + '</div>' +
        '<div class="p-qty">' + esc(p.qty) + '</div>' +
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
    state.categories.push({ id: id, name: name, tone: toneEl ? toneEl.dataset.tone : 'green', custom: true, keywords: kws });

    save();
    renderCategoriesPanel();
    render();
    toast('Category “' + name + '” created');
  }

  function renameCategory(id, name) {
    var c = catById(id);
    if (!c) return;
    var clean = String(name || '').trim();
    if (!clean) { renderCategoriesPanel(); return; }
    c.name = clean;
    save();
    render();
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
    if (state.addCategory === id) state.addCategory = 'auto';
    save();
    renderCategoriesPanel();
    render();
    toast('Category “' + c.name + '” deleted — its items moved to ' + catName(fallback));
  }

  function addKeyword(catId, kw) {
    var c = catById(catId);
    if (!c) return;
    var k = String(kw || '').trim().toLowerCase();
    if (!k) return;
    c.keywords = c.keywords || [];
    if (c.keywords.indexOf(k) === -1) c.keywords.push(k);
    save();
  }

  function removeKeyword(catId, kw) {
    var c = catById(catId);
    if (!c) return;
    c.keywords = (c.keywords || []).filter(function (k) { return k !== kw; });
    save();
  }

  /* =============================== RENDERER =============================== */
  function render() {
    var root = $('#page-root');
    if (state.route === 'lists') root.innerHTML = renderLists();
    else if (state.route === 'spending') root.innerHTML = renderSpending();
    else root.innerHTML = renderDashboard();
    renderTopbar();
  }

  /* =============================== DRAWER ================================ */
  function renderDrawer() {
    var you = state.members.filter(function (m) { return m.you; })[0] || state.members[0];
    var online = state.members.filter(function (m) { return m.online; }).length;

    var ws = D.workspaces.map(function (w) {
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
        '<span class="avatar avatar-lg">' + esc(you.initials) + '</span>' +
        '<div class="grow">' +
          '<div class="pc-name">' + esc(you.name) + '</div>' +
          '<div class="pc-mail">' + esc(you.email) + '</div>' +
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
        '<p class="members-copy">Share the shopping, share the to-dos. Invite someone to The Lopez Household.</p>' +

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

  function addItem(rawText) {
    var input = $('#new-item');
    var raw = (rawText !== undefined ? rawText : (input ? input.value : '')).trim();
    if (!raw) { if (input) input.focus(); return; }

    var parts = raw.split(',');
    var name = tidyName(parts[0].trim());

    /* the category the user pinned wins, otherwise auto-detect */
    var cat = state.addCategory !== 'auto' ? state.addCategory : guessCategory(name);
    var qty = { n: state.addQty.n, u: state.addQty.u };

    /* "apples, 3 kg" typed by hand overrides the picker */
    if (parts.length > 1) qty = parseQty(parts.slice(1).join(',').trim() || '1 pc');

    var list = activeList();
    list.items.push({
      id: 'n' + Date.now(),
      name: name,
      qty: qty,
      cat: cat,
      aisle: catName(cat),
      owner: (state.members.filter(function (m) { return m.you; })[0] || state.members[0]).id,
      done: false
    });
    save();
    render();
    state.addQtyTouched = false;
    toast('Added “' + name + '” · ' + qtyText(qty) + ' → ' + catName(cat));
    var ni = $('#new-item'); if (ni) ni.focus();
  }

  function addSuggestion(name, cat, n, u) {
    var list = activeList();
    var useCat = cat || (state.addCategory !== 'auto' ? state.addCategory : guessCategory(name));
    var qty = { n: (n === undefined || n === '' ? 1 : Number(n)), u: u || 'pc' };
    list.items.push({
      id: 'n' + Date.now(),
      name: tidyName(name),
      qty: qty,
      cat: useCat,
      aisle: catName(useCat),
      owner: (state.members.filter(function (m) { return m.you; })[0] || state.members[0]).id,
      done: false
    });
    save();
    render();
    toast('Added “' + name + '” · ' + qtyText(qty) + ' → ' + catName(useCat));
  }

  function saveItemEdit(id) {
    var nameEl = $('#edit-name'), nEl = $('#edit-qty-n'), catEl = $('#edit-cat');
    if (!nameEl || !catEl) return;
    var name = (nameEl.value || '').trim();
    if (!name) { nameEl.classList.add('invalid'); nameEl.focus(); return; }
    nameEl.classList.remove('invalid');
    var list = activeList();
    list.items.forEach(function (it) {
      if (it.id === id) {
        it.name = name;
        if (nEl) {
          var n = parseFloat(nEl.value);
          it.qty = { n: (isNaN(n) ? 1 : n), u: state.editUnit || it.qty.u };
        }
        it.cat = catEl.value;
        it.aisle = catName(catEl.value);
      }
    });
    state.editingId = null;
    save();
    render();
    toast('Item updated');
  }

  function refreshSuggestions() {
    var input = $('#new-item');
    var panel = $('#sug-panel');
    if (!input || !panel) return;
    /* pre-fill the amount + unit from the best catalogue match, until the
       user sets it by hand */
    if (!state.addQtyTouched) state.addQty = defaultQtyFor(input.value);
    panel.innerHTML = suggestPanelHtml(input.value);
    panel.hidden = false;
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

  function newList() {
    var name = prompt('Name your new list', 'New list');
    if (!name) return;
    state.lists.push({
      id: 'l' + Date.now(),
      name: name.trim(),
      kind: 'grocery',
      icon: 'cart',
      tint: 'green',
      shared: true,
      aisle: 'Other',
      items: []
    });
    save();
    render();
    toast('List “' + name.trim() + '” created');
  }

  function signOut() {
    state.signedIn = false;
    save();
    closeDrawer();
    showLogin();
    toast('Signed out');
  }

  /* =============================== AUTH ================================== */
  function showLogin() {
    $('#view-app').classList.add('hidden');
    $('#view-login').classList.remove('hidden');
  }
  function showApp() {
    $('#view-login').classList.add('hidden');
    $('#view-app').classList.remove('hidden');
    render();
  }

  function setSignupMode(on) {
    var h = $('#login-heading'), s = $('#login-sub'), alt = $('#login-alt'), btn = $('#btn-login');
    if (on) {
      h.textContent = 'Create your account';
      s.textContent = 'Start a shared list with the people you live, shop or plan with.';
      btn.innerHTML = 'Create account ' + icon('arrow-right');
      alt.innerHTML = 'Already have an account? <a class="link-green" href="#" id="link-signin">Sign in</a>';
    } else {
      h.textContent = 'Welcome back';
      s.textContent = 'Your groceries, to-dos, and everyday plans. Right where you left them.';
      btn.innerHTML = 'Log in ' + icon('arrow-right');
      alt.innerHTML = 'Don\'t have an account? <a class="link-green" href="#" id="link-signup-2">Sign up for free</a>';
    }
    var su = $('#link-signup'), su2 = $('#link-signup-2'), si = $('#link-signin');
    if (su) su.style.display = on ? 'none' : '';
    if (su2) su2.style.display = on ? 'none' : '';
    if (si) si.style.display = on ? '' : 'none';
  }

  /* =============================== EVENTS ================================= */
  function bind() {
    /* ---- login ---- */
    $('#btn-google').addEventListener('click', function () {
      state.signedIn = true; save(); showApp();
      toast('Signed in with Google');
    });

    $('#login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var email = $('#f-email'), pass = $('#f-pass');
      var okEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim());
      var okPass = pass.value.trim().length > 0;

      $('#err-email').classList.toggle('show', !okEmail);
      $('#err-pass').classList.toggle('show', !okPass);
      email.classList.toggle('invalid', !okEmail);
      pass.classList.toggle('invalid', !okPass);
      if (!okEmail) { email.focus(); return; }
      if (!okPass) { pass.focus(); return; }

      state.signedIn = true;
      save();
      showApp();
      toast('Welcome back, Alex');
    });

    $('#toggle-pass').addEventListener('click', function () {
      var p = $('#f-pass');
      var showing = p.type === 'text';
      p.type = showing ? 'password' : 'text';
      this.innerHTML = icon(showing ? 'eye' : 'eye-off');
      this.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    });

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest && (t.closest('#link-signup') || t.closest('#link-signup-2'))) {
        e.preventDefault(); setSignupMode(true);
      }
      if (t.closest && t.closest('#link-signin')) {
        e.preventDefault(); setSignupMode(false);
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
        D.workspaces.forEach(function (w) { w.active = w.id === wsBtn.dataset.ws; });
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
    $('#view-app').addEventListener('focusin', onAppFocusIn);
    $('#view-app').addEventListener('focusout', onAppFocusOut);
    $('#cat-modal').addEventListener('click', onCatPanelClick);
    $('#cat-modal').addEventListener('change', onCatPanelChange);
    $('#cat-modal').addEventListener('keydown', onCatPanelKeydown);
    $('#drawer-content').addEventListener('click', onDrawerClick);
    $('#drawer-content').addEventListener('change', onDrawerChange);
    $('#scrim').addEventListener('click', closeDrawer);
    window.addEventListener('hashchange', onHashChange);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target && e.target.id === 'new-item') { e.preventDefault(); addItem(); }
      if (e.key === 'Escape') {
        closeDrawer();
        toggleProfileMenu(false);
        if (state.catPanelOpen) closeCategories();
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
      } else {
        state.addQty.u = el.dataset.unit;
        state.addQtyTouched = true;
      }
      return;
    }

    if (el.dataset.scat) {
      state.addCategory = el.dataset.scat;
      refreshSuggestions();
      renderListFooterBits();
      return;
    }
    if (el.dataset.sugName) {
      addSuggestion(el.dataset.sugName, el.dataset.sugCat, el.dataset.sugN, el.dataset.sugU);
      return;
    }

    if (el.dataset.pantry) {
      var plist = activeList();
      var pcat = guessCategory(el.dataset.pantry);
      plist.items.push({
        id: 'n' + Date.now(),
        name: el.dataset.pantry,
        qty: '1 pc',
        cat: pcat,
        aisle: catName(pcat),
        owner: (state.members.filter(function (m) { return m.you; })[0] || state.members[0]).id,
        done: false
      });
      save();
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
        list.items.forEach(function (it) {
          if (it.id === row.dataset.id) it.done = !it.done;
        });
        save(); render();
        break;
      }
      case 'del': {
        var r2 = el.closest('.item-row');
        var l2 = activeList();
        var removed = l2.items.filter(function (i) { return i.id === r2.dataset.id; })[0];
        l2.items = l2.items.filter(function (i) { return i.id !== r2.dataset.id; });
        save(); render();
        if (removed) toast('Removed “' + removed.name + '”');
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
      case 'add-query': {
        var qi = $('#new-item');
        addItem(qi ? qi.value : '');
        break;
      }
      case 'add-item': addItem(); break;
      case 'new-list': newList(); break;
      case 'new-pantry': toast('Pantry capture is part of the next build'); break;
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
    if (t.id === 'new-item') {
      showSuggestions();
      refreshSuggestions();
      return;
    }
    if (t.id === 'sug-qty-n') {
      var n = parseFloat(t.value);
      state.addQty.n = isNaN(n) ? 1 : n;
      state.addQtyTouched = true;
    }
  }

  function onAppChange(e) {
    var t = e.target;
    if (!t) return;
    if (t.id === 'sug-qty-u') {
      state.addQty.u = t.value;
      state.addQtyTouched = true;
      return;
    }
  }
  function onAppFocusIn(e) {
    if (e.target && e.target.id === 'new-item') { showSuggestions(); refreshSuggestions(); }
  }
  function onAppFocusOut(e) {
    if (!e.target || e.target.id !== 'new-item') return;
    setTimeout(function () {
      var panel = $('#sug-panel');
      if (!panel) return;
      if (panel.contains(document.activeElement)) return;
      panel.hidden = true;
    }, 180);
  }
  function showSuggestions() {
    var panel = $('#sug-panel');
    if (panel) panel.hidden = false;
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
      D.workspaces.forEach(function (w) { w.active = w.id === el.dataset.ws; });
      renderDrawer();
      toast('Switched to ' + (D.workspaces.filter(function (w) { return w.active; })[0] || {}).name);
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
    bind();
    var h = (location.hash || '').replace('#/', '');
    if (['dashboard', 'lists', 'spending'].indexOf(h) !== -1) state.route = h;
    if (state.signedIn) showApp(); else showLogin();
    window.__bililist = { state: state, reset: resetDemo, D: D };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
