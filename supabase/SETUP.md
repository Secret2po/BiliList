# Connecting BiliLIST to Supabase

The prototype runs in **demo mode** out of the box (everything in `localStorage`).
This guide turns on the real database, real accounts and email codes.

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

Plus the triggers, the password-uniqueness functions and **row level security
policies** that enforce the Owner / Editor / Viewer rules.

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
3. Under **Authentication → URL Configuration**, set **Site URL** to
   `http://127.0.0.1:8123` and add `http://localhost:8123` to the redirect
   allow list. Add your real domain when you deploy.
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

## How the sign-in works

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
  an item is checked off, so the app does not have to do it in two places.

## Next steps when the backend is live

The frontend still reads and writes `localStorage`. Swapping it to the real
tables means replacing the `state` mutations in `assets/js/app.js` with
Supabase calls — the rendering code does not have to change:

```js
// instead of: list.items.push({...})
await S.client.from('items').insert({ list_id: id, name: 'Avocados', qty_amount: 2, qty_unit: 'pcs' });
```
