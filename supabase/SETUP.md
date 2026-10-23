# Connecting BiliLIST to Supabase

BiliLIST keeps signed-in data in Supabase. This guide connects the project,
runs the schema, turns on real accounts and explains where each screen stores
its rows. If Supabase is not configured the app still runs in **demo mode**
(everything in `localStorage`).

---

## 1. Create the project (5 min)

1. Go to <https://supabase.com> → **New project**
2. Name it `bililist`, pick a strong database password, pick the region closest
   to the Philippines (**Singapore** or **Tokyo**), wait for it to provision.
3. You land in the project dashboard.

## 2. Run the schema (2 min)

1. In the dashboard open **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this repo, copy **everything**, paste it in.
3. Press **Run**. It should finish with no errors.

That script creates:

| Object | Purpose |
| --- | --- |
| `profiles` | one row per account (name, avatar) |
| `workspaces` | a household or friend group |
| `workspace_members` | who is in it and their role (owner / editor / viewer) |
| `categories` | the aisles, with keywords, editable per household |
| `lists` | the shopping / chore / event lists |
| `items` | the groceries, with amount + unit, assignee and done flag |
| `pantry` | what is already on the shelf |
| `events` | calendar entries, optionally linked to a list |
| `activity` | the "a shared effort" feed |

It also creates:

* **Row level security policies** that enforce the Owner / Editor / Viewer rules
  and keep each workspace's rows private.
* `handle_new_user()` — a new account gets a profile, a starter workspace and
  the default categories.
* `seed_workspace(uuid)` — the one place that writes the starter categories and
  the first list. It is used by the sign-up trigger and by the RPC below.
* `ensure_user_workspace()` — an **authenticated RPC** the app calls right after
  sign-in. It returns the user's workspace and creates one (plus the starter
  data) for accounts that do not have one yet. This covers accounts created
  before the trigger existed.
* `move_item_to_pantry()` / `remove_item_from_pantry()` — triggers that keep
  `pantry` in sync when an item is checked off, unchecked or deleted.
* `pantry_workspace_name_key` — a case-insensitive unique index so one product
  is one pantry line per workspace, which makes the trigger upsert safe.

> **Upgrading an existing project?** Re-run the whole `schema.sql`. It is safe to
> repeat: tables use `if not exists`, functions use `create or replace`, and the
> migration code removes duplicate pantry rows before it adds the unique index.
> After running it, the older prototype data in `localStorage` is imported once
> the first time the account signs in against an empty workspace, then the local
> blob is deleted.

## 3. Add your keys (1 min)

The project URL is already filled in. You only need the public key, and there
are two ways to give it to the app.

**Fastest — from the login screen.** The "Demo mode" box on the sign-in page
links straight to your project's API keys. Copy the **Publishable key** (or the
legacy **anon** key), paste it into the box and press **Connect**. The app
checks it against Supabase before accepting it and reloads into live mode.
That key is stored in `localStorage` for that browser only.

**Permanent — in the repo.** Open `assets/js/config.js` and paste it there, so
every browser and every teammate gets it:

```js
window.BILILIST_CONFIG = {
  supabaseUrl: 'https://xsjwhwrnseevlntxwjeg.supabase.co',
  supabaseAnonKey: 'sb_publishable_...'
};
```

A key saved from the login screen overrides `config.js` for that browser. To
clear it, run `localStorage.removeItem('bililist.supabase')` in the console.

> The anon key is **meant** to be public. It only exposes rows that the RLS
> policies allow. Never put the `service_role` / secret key in the frontend —
> the Connect box refuses `sb_secret_…` keys.

## 4. Turn on the email code

For the 6-digit code to arrive you need an email provider:

1. Dashboard → **Authentication** → **Providers** → **Email**.
2. Supabase ships with a built-in SMTP that works for a few emails a day
   (fine for a demo). For real usage, add **Resend**, **Brevo** or
   **SendGrid** under **Authentication → Emails → SMTP**.
3. Under **Authentication → URL Configuration**, set **Site URL** to your
   public URL (`https://secret2po.github.io/BiliList/`, see
   [`../DEPLOY.md`](../DEPLOY.md)) and add
   `https://secret2po.github.io/BiliList/**` to the redirect allow list. Keep
   `http://localhost:8123/**` only if you also develop locally. A
   `192.168.x.x` address is private to one Wi-Fi and will not work for
   groupmates.
4. **Add the code to the email templates.** Supabase's stock templates only
   contain a link, so the 6-digit code never appears. Go to
   **Authentication → Emails** and put `{{ .Token }}` in the body of
   **Confirm signup** and **Reset password** (and **Magic Link** if you use
   it), for example:

   ```html
   <h2>Your BiliLIST code</h2>
   <p>Enter this code to finish signing in:</p>
   <p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p>
   ```

---

## 5. Turn on Google sign-in

The **Continue with Google** button calls
`supabase.auth.signInWithOAuth({ provider: 'google' })`. Supabase performs the
OAuth exchange, so the browser never touches your Google client secret.

### 5a. In Google Cloud Console

1. Open <https://console.cloud.google.com> and create (or pick) a project.
2. **APIs & Services → OAuth consent screen** → choose **External**, then fill
   in the app name, support email and developer contact. While the app is in
   **Testing**, add every Google account you will demo with under **Test users**.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   application type **Web application**.
4. Add the **Authorized JavaScript origins**:
   - `https://xsjwhwrnseevlntxwjeg.supabase.co`
5. Add the **Authorized redirect URI**. This is the Supabase callback, **not**
   the BiliLIST page:

   ```
   https://xsjwhwrnseevlntxwjeg.supabase.co/auth/v1/callback
   ```

   Supabase performs the Google exchange, so the BiliLIST public URL is allowed
   in Supabase (section 5b), not directly in Google Cloud. Local development
   uses the same Supabase callback; no localhost origin is needed here.

6. Copy the **Client ID** and **Client secret**.

### 5b. In Supabase

1. **Authentication → Providers → Google** → toggle it **on**.
2. Paste the Client ID and Client secret, then **Save**.
3. **Authentication → URL Configuration**:
   - **Site URL**: `https://secret2po.github.io/BiliList/`
   - **Redirect URLs**: `https://secret2po.github.io/BiliList/**`
   - Optional, local development only: `http://localhost:8123/**` and
     `http://127.0.0.1:8123/**`
4. Re-run `supabase/schema.sql` (safe to repeat). It updates
   `handle_new_user()` so a Google account stores Google's `full_name`,
   `name` and `picture` / `avatar_url` in `profiles`, and still gets a starter
   workspace with the default categories.

### How the Google flow behaves

- The app asks Google for `prompt=select_account`, so the account chooser is
  shown every time. A session is only created after an account is picked.
- If the chooser is **cancelled**, Google returns `error=access_denied`. The app
  reads that result *before* Supabase can restore anything, clears the pending
  flag and any leftover local session, and stays on the login screen with:
  *“Google sign-in was canceled. Choose a Google account to continue — you are
  not signed in.”* It never falls back to demo mode or an older session.
- If an account **is** chosen, Supabase creates the session, the app reads the
  user, and the browser is moved to the home screen (`#/dashboard`).
- If the provider is not enabled yet, the returned error is translated to a
  short hint pointing at **Authentication → Providers → Google**.
- `flowType: 'pkce'` is enabled in `assets/js/supabase-client.js`, so the OAuth
  code is exchanged in the browser instead of putting tokens in the URL hash.

> `redirectTo` is built from the current page URL. The public demo URL is
> `https://secret2po.github.io/BiliList/`, so allow
> `https://secret2po.github.io/BiliList/**` in Supabase. If you develop locally
> and open `http://127.0.0.1:8123/index.html`, that exact URL must also be
> present in the redirect allow list.

---

## How the sign-in works

**Continue with Google** — `signInWithOAuth()` with the Google provider, an
account chooser, cancel handling and a dashboard redirect (see section 5).

**Sign in** — email + password → `signInWithPassword()`.

**Create account** — username, email, password and confirm password. Before
anything is created the app checks `username_available()` and
`password_claim()` so the user gets *"That username is taken"* or *"That
password is already used by another account"* immediately. It then signs up
with a password fingerprint that the database trigger re-checks, so a password
can only ever belong to one account.

**Verify your email** — the same screen becomes a second step straight after
sign-up: the email is locked, and the user types the 6-digit code Supabase
emailed them (`verifyOtp()` with `type: 'signup'`). There is a "Send a new
code" link. This step is not a tab — it only appears when there is a
verification outstanding.

**Forgot password?** — asks Supabase for a reset code
(`resetPasswordForEmail`), then shows the same code step with
`type: 'recovery'`, followed by a "Set a new password" step
(`updateUser({ password })`).

---

## Notes for the write-up

- The unique-password rule is enforced with a **bcrypt fingerprint** computed
  with a per-database salt (`app_secrets`). The plaintext password is never
  stored by us — Supabase stores its own bcrypt hash in `auth.users`.
  *Limitation:* because the fingerprint salt is shared across rows, someone with
  a full database dump could brute-force it offline. For a production system,
  use per-user salts and a "check against a breach list" service instead.
- Row level security is what actually keeps households separate. A user who is
  not a member of a workspace cannot read or write any of its rows, even with
  a valid session.
- The `move_item_to_pantry` trigger keeps `pantry` in sync automatically when
  an item is checked off, unchecked or deleted, so the app does not have to do
  it in two places.

## Where the app stores each screen

| Screen | Table | Notes |
| --- | --- | --- |
| **To Buy** tab | `items` | `done = false` |
| **Pantry** tab | `items` | `done = true`; the trigger also tops up `pantry` |
| **Inventory** tab / *Pantry & inventory* | `pantry` | one case-insensitive row per product |
| Lists | `lists` | scoped to the workspace |
| Category manager | `categories` | rename, keywords, add, delete |
| Last list, route, spending range | `localStorage` | small UI preference only |

`assets/js/app.js` hydrates the workspace once after sign-in
(`ensure_user_workspace()` → categories, lists, items, pantry, members) and then
writes each mutation back to the matching table. The render functions never talk
to Supabase, so the sync layer stays in one place.

### Realtime

After hydration the app opens a Supabase Realtime channel and listens to
`postgres_changes` on `items`, `lists`, `pantry`, `categories` and
`workspace_members`. Remote changes are debounced into one snapshot refresh, so
two devices signed into the same account stay in step without a manual reload.
The **Live** pill next to “Shared grocery list” is green when the channel is
subscribed. Refreshes are paused while a dialog or text field has focus, so they
never close an editor mid-edit.

`Postgres Changes` only broadcasts tables that are in the `supabase_realtime`
publication. The last section of `schema.sql` adds those five tables with an
idempotent `DO` block. If realtime does not connect, confirm the tables are
listed under **Database → Replication → supabase_realtime** in the dashboard
(or re-run `schema.sql`).
