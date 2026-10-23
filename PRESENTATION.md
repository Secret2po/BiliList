# BiliLIST — presentation runbook

Short checklist for demo day. BiliLIST is a static site: there is no build step
and nothing to install. The public GitHub Pages URL works on any network,
including phone data, so nobody needs to be on your Wi-Fi.

## Before the day (one-time)

1. **Apply the database schema.** In Supabase open **SQL Editor**, paste the
   whole of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
   The “destructive query” warning is expected; the script drops and recreates
   policies/triggers and is safe to run again. **If you ran an earlier version
   of the schema, run this updated file again** — its last section adds the five
   tables to the `supabase_realtime` publication. Without this step the app
   falls back to local demo mode and the two devices will not share data.
2. **Create the demo account.** Sign in once with email/password and add a test
   item. Use the **same account** on the laptop and the phone — the workspace,
   and therefore the shared lists, belong to the account.
3. **Publish the public site.** Enable GitHub Pages and allow the public URL in
   Supabase: follow [`DEPLOY.md`](DEPLOY.md). The expected URL is
   **`https://secret2po.github.io/BiliList/`**. This is what makes the site and
   Google sign-in work from any internet connection.

Details for Supabase, Google sign-in and the schema are in
[`supabase/SETUP.md`](supabase/SETUP.md).

## Start the app

Open **`https://secret2po.github.io/BiliList/`** on every device — laptop,
phone, or a groupmate's computer. No server needs to be running on your PC, and
the devices do not need to share a Wi-Fi network.

For local development only, `python serve.py` serves `http://127.0.0.1:8123/`
on your own PC. Do not give that address to groupmates: it is not reachable from
another network.

## Two-device demo script

1. Open the public GitHub Pages URL on both devices.
2. Sign in on both with the **same account** (Google or email/password).
3. On the dashboard, confirm the small **Live** pill next to “Shared grocery
   list” is green.
4. On the laptop, add **Milk** to *To Buy*. It should appear on the phone in
   about a second, without refreshing.
5. On the phone, check **Milk** off. It should move to *Pantry* on the laptop
   and update *Inventory* automatically.
6. Delete an item on one device; it should disappear on the other.
7. Optional: change a quantity, add a list, or rename a category — all of those
   changes sync as well.

## If something is wrong

| Symptom | Fix |
| --- | --- |
| **Live** pill is grey or says “Connecting” | Check the internet. In Supabase open **Database → Replication → `supabase_realtime`** and confirm `items`, `lists`, `pantry`, `categories` and `workspace_members` are listed; re-run the schema if they are not. |
| Changes only appear after a reload | The realtime section of the schema was not applied. Re-run [`supabase/schema.sql`](supabase/schema.sql). |
| App falls back to demo mode / cloud data is missing | The `ensure_user_workspace` RPC is missing, which means the schema has not been run. Run it, then reload and sign in again. |
| Phone cannot open the page | Do not use a `192.168.x.x` or `127.0.0.1` address. Open the public `https://secret2po.github.io/BiliList/` URL. |
| Google returns to `localhost` or a LAN IP | Set **Site URL** to `https://secret2po.github.io/BiliList/` and add that URL under **Redirect URLs**. See [`DEPLOY.md`](DEPLOY.md). |
| Google sign-in fails with “redirect” / “invalid request” | The public origin is missing from **Supabase → Authentication → URL Configuration → Redirect URLs**. Add `https://secret2po.github.io/BiliList/**`. |
| Google says “Access blocked” / app not verified | In Google Cloud → OAuth consent screen, add the demo Google account as a **Test user**, or publish the app. |
| A groupmate sees a different list | They are signed in with a different account. Use the **same demo account**, or wire up workspace invites (not implemented yet). |

## Fallback

If the Supabase SDK/config is unavailable, the sign-in buttons fall back to
demo mode, which runs entirely from `localStorage` in one browser. It is useful
for showing the screens without a network, but it **does not sync** between
devices, so use it only as a last resort.
