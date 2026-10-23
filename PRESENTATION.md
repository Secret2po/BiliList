# BiliLIST — presentation runbook

Short checklist for demo day. BiliLIST is a static site: there is no build step
and nothing to install except Python for the local server. Cloud mode also needs
an internet connection because Supabase and its JavaScript SDK are online; demo
mode is the offline fallback.

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
3. **Allow the phone through Windows Firewall.** Open PowerShell **as
   Administrator** and run:
   ```powershell
   New-NetFirewallRule -DisplayName "BiliLIST dev server (8123)" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8123 -RemoteAddress LocalSubnet -Profile Any
   ```
   This only has to be done once per PC. It is needed because the Wi-Fi network
   is on the **Public** profile, where Windows blocks inbound Python by default.
4. **Note the PC's LAN address.** Run `ipconfig`, find the Wi-Fi adapter's IPv4
   address (for example `192.168.1.5`). `serve.py` prints it for you as well.

Details for Supabase, Google sign-in and the schema are in
[`supabase/SETUP.md`](supabase/SETUP.md).

## Start the app

Double-click **`run.bat`**, or from this folder run:

```powershell
python serve.py 8123 0.0.0.0
```

Leave the window open. It prints:

* laptop: `http://localhost:8123/`
* phone: `http://192.168.1.5:8123/` (use the address it prints — it can change)

`run.bat` is just a shortcut for the command above and keeps the window open
after the server stops.

## Two-device demo script

1. Open the laptop URL and the phone URL.
2. Sign in on both with the **same email/password** account.
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
| Phone cannot open the page | Confirm the phone and PC are on the same Wi-Fi, the firewall rule above exists, and the URL starts with `http://`. Brave may try HTTPS first; Chrome is a safe alternative. |
| Google sign-in from the phone fails | Add `http://192.168.1.5:8123/**` (and `http://localhost:8123/**`) under **Supabase → Authentication → URL Configuration → Redirect URLs**, or use email/password for the demo. |
| Port 8123 is already in use | Run `run.bat 8124` (or `python serve.py 8124 0.0.0.0`) and use `:8124` in both URLs. |
| Need to stop the server | Press `Ctrl+C` in the server window. |

## Fallback

If the Supabase SDK/config is unavailable, the sign-in buttons fall back to
demo mode, which runs entirely from `localStorage` in one browser. It is useful
for showing the screens without a network, but it **does not sync** between
devices, so use it only as a last resort.
