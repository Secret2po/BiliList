# BiliLIST — Interactive Prototype

**A little order, a lighter day.**

A shared grocery + task list web application for households, roommates and friend
groups. This repository contains a **clickable, high-fidelity front-end prototype**
built from the BiliLIST UI mockups and the CS 3114 Feasibility Study / SPMP.

> **Status:** Prototype (front-end only). No backend yet — all data is sample data
> held in the browser's `localStorage`. See *Roadmap to the real build* below.

---

## 1. Running the prototype

There is **no build step and no dependencies to install**. Pick whichever is easiest:

| Option | Steps |
| --- | --- |
| **A. Double-click** | Open `index.html` in Chrome / Edge / Firefox. Works straight from the file system. |
| **B. Local server** (recommended) | From this folder run `python serve.py`, then open <http://127.0.0.1:8123/> |
| **C. VS Code** | Install the *Live Server* extension, right-click `index.html` → *Open with Live Server*. |

> `serve.py` is the same as `python -m http.server` except it sends `no-store`
> headers. Plain `http.server` lets the browser cache `app.js` / `styles.css`,
> so your edits do not show up until you hard-refresh. Use `serve.py` while
> you are working on the prototype.

**Logging in:** the prototype connects to Supabase when `assets/js/config.js`
contains a project URL and publishable key (it does by default). Use
**Continue with Google** after enabling the Google provider once, or sign in
with an email and password. Both routes land on the dashboard. If Supabase is
not configured, the screen falls back to demo mode so the prototype can still be
shown.

> Google setup (Google Cloud client + Supabase provider + redirect URLs) is in
> [`supabase/SETUP.md`](supabase/SETUP.md#5-turn-on-google-sign-in). Cancelling
> the Google account chooser returns to the login screen with a message and does
> not sign anyone in.

**Resetting the demo:** the app persists changes to `localStorage`
(key `bililist.prototype.v1`). To get back to the seeded sample data, run this in
the browser console:

```js
__bililist.reset();   // clears storage and reloads
```

---

## 2. What is in the prototype

### Screen 1 — Login (`index.html`, `#/login`)
* Split layout: credential form on the left, product hero on the right.
* Warm `#FEF0CB` header and footer bands, with **Create an account** as the
  top-right shortcut.
* **Continue with Google** via Supabase OAuth (`prompt=select_account`). A
  cancelled chooser stays on the login screen and shows an error; a chosen
  account lands on `#/dashboard`.
* Email + password with inline validation, show/hide password toggle,
  "Remember me", "Forgot password?".
* **Create an account** / **Sign up for free** flips the form into a sign-up state
  (the same panel, different copy) so the flow can be demonstrated end to end.
* Sign-out from the profile drawer returns to this screen and clears the
  Supabase session.

### Screen 2 — Dashboard (`#/dashboard`)
Three-column home screen. The **centre column is the hero** — the active list
sits on a soft-green card (`#D4EDDA`) so it reads as the core utility of the app,
against the warm cream page background.

* **Left rail**
  * Greeting + today's date + **Create a list**.
  * *Your space* — quick links to every list with live counts.
  * *Spending insights* mini card (see below).
  * *Check before you shop* tip.
* **Centre column — Active List & Inventory (WP3)**
  * **Quick-add search bar with recommendations** — the field at the top of the
    card behaves like a search box, not a plain input. As you type it shows:
    * **What your household already buys** — the item, the usual quantity and
      how often it has been bought (*"Dishwashing liquid — 1 bottle · bought 6× ·
      2 weeks ago"*). Ranked first, because it is the most useful signal.
    * **Catalogue suggestions** — common supermarket products with a sensible
      default quantity.
    * **Items already on the list**, so you do not add the same thing twice.
    * A **fallback row** — *"Add 'dishwashing' to Cleaning"* — so the user is
      never blocked, even when nothing matches. The target category is
      auto-detected and can be overridden.
    * With an empty field it shows the household's **most frequent purchases**.
  * **Category filter chips** — a row of chips at the top of the suggestion
    panel. `Auto-detect` plus every category, **including any the user has
    created**. Picking one filters the suggestions *and* pins the target
    category (the Add button then reads *"Add to Cleaning"*).
  * **Smart categorisation** — the checklist is always grouped by category,
    not a random jumble (supports the Pandamart / SMART LIST usability
    findings).
  * **Task assignment** — the avatar of the member responsible sits in the
    "Assigned to" column of every row.
  * **Re-classify an existing item** — click any item name to open an inline
    editor for the name, the quantity and the **category**. Changing the
    category moves the item to the right group immediately.
  * **Inventory toggle** — three working tabs above the list:
    *To Buy* (the active list) · *Pantry* (items you have already checked off,
    they move here automatically) · *Inventory* (what is already on the shelves,
    with shelf life and a running-low state).
  * Check items off → the "in the bag" counter, progress bar and header counts
    update instantly.
  * *A little life admin* — household to-dos with check-off.
* **Right sidebar — Calendar & Event Planning**
  * *Our calendar* — real October 2026 month grid, today highlighted, days with
    events dotted, previous/next month navigation.
  * *Coming up* — the next **5** upcoming events with the day of the week, and
    a **direct link to the grocery list each event needs** (e.g. *Shane's
    birthday dinner → Birthday dinner list*). Clicking the link switches the
    centre column to that list.

### Screen 2b — Custom categories (the "Customize categories" panel)
The tag button in the list header opens a modal where the household controls
its own taxonomy. Everything is saved to `localStorage` and applies everywhere.

* **Rename any category** — e.g. turn *Produce* into *Fruits & Veg*. The new
  name shows up in the list, the add-item search and the reports immediately.
* **Edit the keywords** of a category. Keywords are what the search matches on,
  so adding *"candle"* to a category makes `scented candle` auto-file itself
  there. Keywords are shown as chips (first three, then *"+N more"* to expand)
  and each one can be removed.
* **Create a brand-new category** — name it, pick a colour, optionally give it
  keywords. It immediately appears as a chip in the add-item search, as a
  heading in the list, and as an option in the per-item category dropdown.
* **Delete a category** — its items move to *Other* rather than disappearing.
* **Reset to default** restores the eight built-in categories.

> The eight built-in categories (Produce, Dairy & eggs, Bakery, Meat & poultry,
> Cleaning, Snacks, Beverages, Other) are only a starting point. They are
> ordinary rows in the same table, so nothing about them is hard-coded in the UI.

### Screen 2c — Global header (profile & collaboration)
Top-right avatar opens a **profile menu** rather than dumping you straight into
a drawer:

* **Household switcher** — The Lopez Household / Weekend crew, with a check on
  the active workspace. Switching updates the header chip instantly.
* **Manage Members** — opens the full drawer and scrolls to the member panel
  (invite by email, assign Owner/Editor/Viewer, see who is online).
* *My profile*, *Household settings*, *Sign out*.
* The BiliLIST logo at the top left is the universal **home** button (`#/dashboard`).

### Screen 3 — Profile / Household drawer (`#/profile`, or the mobile Profile tab)
Right-hand slide-over drawer, exactly as in the mockup.

* Your identity card + **My profile**.
* **Switch workspace** — The Lopez Household / Weekend crew, with a check on the
  active one.
* **Manage Members** (scrolls + highlights the member panel), **Household
  settings**, **Sign out**.
* **Manage Members** panel: member list with online status and a live
  **Owner / Editor / Viewer** role dropdown, plus **Invite by email** with a role
  picker. Invites are validated, then appear as a pending-invite card with a
  **Resend** action.
* Footer note explaining the three roles.

### Screen 4 — My lists (`#/lists`)
* Tile grid of every list with type icon, progress bar, "X of Y done" and the
  members involved. Clicking a tile opens that list on the dashboard.
* **Pantry & inventory** table: what is already at home, shelf life, a
  *running low* state and an **Add to list** shortcut so nobody buys the same
  thing twice.

### Screen 5 — Spending insights (`#/spending`)
* Four KPI cards (this week, average trip, items bought, budget left).
* Stacked 7-day chart split by Produce / Dairy & eggs / Everything else.
* *Where it went* breakdown by aisle with percentages.
* The same **1W / 1M / 3M / 6M / 1Y** segmented control used on the dashboard card.

### Spending insights card (left rail, WP4)
* **Budget snapshot** — total spent for the period against the set budget, with
  a meter bar and the exact amount still available.
* **Timeframe filters** — segmented **1W / 1M / 3M / 6M / 1Y** control directly
  on the card. Each range re-renders the total, the budget, the remaining
  amount and the mini-chart series (daily bars for 1W, monthly for 1M/3M/6M,
  quarterly for 1Y).
* **Mini-chart** — simplified bar trend of the spending.
* The **whole card is clickable** and expands into the full Spending Insights
  module.

---

## 3. File layout

```
BiliList/
├── index.html              # app shell + login screen markup + SVG icon sprite
├── preview.html            # dev helper: renders the app in a 1440px frame
├── serve.py                # no-cache local server (edits show up on refresh)
├── assets/
│   ├── css/styles.css      # all styling (design tokens at the top)
│   ├── js/
│   │   ├── data.js         # sample data + aisle auto-detection rules
│   │   └── app.js          # state, rendering, router, interactions
│   └── img/
│       ├── logo-mark.svg   # BiliLIST badge (vector, recreated from the logo)
│       └── BiliLIST_logo2.jpg  # ← drop your original artwork here
└── README.md
```

### About the logo

The badge was rebuilt as a **vector SVG** so it stays crisp at any size and can
be recoloured. It is a close recreation, not the original file.

To use the real artwork, save it as **`assets/img/BiliLIST_logo2.jpg`** — the app
detects the file on load and swaps it in automatically, everywhere the logo
appears (header, login, hero). If the file is absent, the SVG fallback is used
and nothing breaks.

> Until that file exists, the browser console will show a single
> `404 …/BiliLIST_logo2.jpg` line. That is the auto-detect probe asking for the
> file; it disappears the moment you add it.

---

## 4. Design system

All tokens live at the top of `assets/css/styles.css` under `:root`.

| Token | Value | Used for |
| --- | --- | --- |
| `--green-600` | `#2C7749` | Primary actions, brand "Bili" |
| `--navy-800` | `#14245C` | Brand "LIST", headings on dark |
| `--teal-900` | `#173033` | Headline text, deep neutrals |
| `--gold-500` | `#D9A441` | Tips, expiry warnings, footer band |
| `--cream-150` | `#FEF0CB` | Login header / footer band |
| `--cream-50` | `#FDFCF7` | Page background (warm cream) |
| `--cream-200` | `#F4EFDC` | Progress tracks, inactive chips |
| `--green-soft` | `#D4EDDA` | Active list card (soft green) |
| `--green-soft-dp` | `#C2E4CB` | Quick-add bar band on the soft green |

Type: **Poppins** (headings) + **Inter** (body), with system fallbacks so the page
still reads correctly if Google Fonts is unreachable (e.g. offline demo).

---

## 5. How this maps to the Feasibility Study

| Study requirement | Where it shows in the prototype |
| --- | --- |
| One live list everyone can edit | Shared grocery list with per-item assignment |
| Items sorted into aisles | Aisle grouping + auto-detect on add |
| Household can shape its own taxonomy | Customize categories panel — rename, add keywords, create, delete |
| Buying the right product the first time | Add-item search with purchase-history + catalogue recommendations |
| Purchased items → home inventory | *Inventory* tab + Pantry & inventory table with shelf life |
| Spending-trend reports | Spending insights page + mini card on the dashboard |
| Calendar task tracking & event planning | Our calendar, Coming up (5 events → direct list links), A little life admin |
| Offline fallback sync | *Planned* — see roadmap |
| Group-based access control | Owner / Editor / Viewer roles + workspace switcher |
| Simplified entry, no unit conversion | Free-text `name, qty` field only |
| Dummy data only (RA 10173) | Every name, email and price in `data.js` is fictional |

---

## 6. Roadmap to the real build

The SPMP schedules a **Working Prototype in Week 9**, with Increment 3
(Notification & Real-time Synchronization) landing in Weeks 10–12. The pieces
still to build, in order:

1. **Backend** — Node.js + MySQL, REST endpoints for users, households, lists,
   items, events and transactions.
2. **Auth** — real registration, password hashing, sessions and the
   *User Session & Collaboration Controller* that enforces household membership.
3. **Real-time sync** — a WebSocket layer so several members editing the same
   list see each other's changes live.
4. **Offline fallback** — a local queue (IndexedDB) that replays edits once the
   connection returns.
5. **Notifications** — push/email reminders for the calendar and for a shared
   list being changed.
6. **Mobile** — React Native or Flutter sharing the same REST contract.

The front-end in this repository was written to make that swap painless: all
screen markup is produced by small `render*()` functions in `assets/js/app.js`,
so a React/Vue rewrite or a swap to fetch-based data access touches one file.

---

*Team: Caparros · Revadenira · Veridiano · Matias — CS 3114 Software Engineering 1*
