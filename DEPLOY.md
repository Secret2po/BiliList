# Publish BiliLIST on the internet

BiliLIST is a static website, so it can be hosted at a public **HTTPS** URL and
opened from any internet connection. The local server (for example
`python serve.py 8123 0.0.0.0`) is development-only: it is reachable at best on
the same Wi-Fi, a phone on mobile data cannot open `http://192.168.x.x:8123/`,
and Google sign-in cannot return to that private address. Host the same static
files publicly and allow that URL in Supabase instead.

GitHub Pages is the simplest option because the project is already on GitHub.

## 1. Turn on GitHub Pages

1. Open <https://github.com/Secret2po/BiliList/settings/pages>.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Choose branch **`main`** and folder **`/ (root)`**, then click **Save**.
4. Wait for the banner: *Your site is live at
   `https://secret2po.github.io/BiliList/`*.
5. Open that URL in an incognito window. The BiliLIST login screen should load.
   The `.nojekyll` file in the repo keeps GitHub Pages from running Jekyll.

Every push to `main` updates the public site automatically.

## 2. Allow the public URL in Supabase

Open <https://supabase.com/dashboard/project/xsjwhwrnseevlntxwjeg/auth/url-configuration>.

* **Site URL:** `https://secret2po.github.io/BiliList/`
* **Redirect URLs:** add each of these (one per line):
  ```
  https://secret2po.github.io/BiliList/**
  http://localhost:8123/**
  http://127.0.0.1:8123/**
  ```
  The first one is the public site and the only one the demo needs. The
  `localhost` / `127.0.0.1` lines are optional and only for local development
  on your own PC.

Do **not** add a `192.168.x.x` address. It is private to one Wi-Fi network, so
groupmates and phones on mobile data cannot reach it, and Google cannot use it
as a public return address.

Click **Save**.

Why this matters: the app sends the **current page** as `redirectTo`. If that
origin is not on the allow list, Supabase falls back to the **Site URL**. With
PKCE the browser stores a one-time verifier for the origin where the sign-in
started, so a fallback to a different origin (or to an unreachable
`192.168.x.x` address) makes the login fail.

## 3. Check the Google Cloud client

Open <https://console.cloud.google.com/apis/credentials> and edit the **Web
application** OAuth client used by Supabase:

* **Authorized JavaScript origins:** `https://xsjwhwrnseevlntxwjeg.supabase.co`
* **Authorized redirect URIs:** `https://xsjwhwrnseevlntxwjeg.supabase.co/auth/v1/callback`

Supabase handles the Google exchange, so the BiliLIST URL is allowed in
Supabase (step 2), not directly in Google Cloud. If the OAuth consent screen is
still in **Testing**, add the Google account you will demo with under **Test
users**, or publish the app.

The Google provider itself is configured at
<https://supabase.com/dashboard/project/xsjwhwrnseevlntxwjeg/auth/providers>.

## 4. Test from any network

1. Turn **Wi-Fi off** on the phone (use mobile data).
2. Open `https://secret2po.github.io/BiliList/`.
3. Tap **Continue with Google**, choose the demo account, and confirm you return
   to the same HTTPS URL and land on the dashboard.
4. Open the same URL on the laptop and sign in with the **same account**.
5. Add or check off an item on one device; the other should update in about a
   second, with the **Live** pill green.

The local server is no longer required for the presentation. Keep it for
development, or use the public URL everywhere.

> The public URL is open to anyone, but the data is per account. Different
> Google/email accounts get different workspaces, so use the **same demo
> account** on every device that must see the same list. Workspace invites are
> not wired up yet.

## Troubleshooting

| What you see | What to change |
| --- | --- |
| `This site can't be reached` on mobile data | You are opening a `192.168.x.x` address. Use the public HTTPS URL. |
| Google returns to `localhost` or a LAN IP | Supabase **Site URL** is still local. Set it to the public URL and add the public URL under **Redirect URLs**. |
| `Invalid redirect URL` / `requested path is invalid` | The current origin is missing from Supabase **Redirect URLs**. Add it exactly, including the trailing `/**`. |
| `Access blocked` / app not verified | Add the Google account as a **Test user** in Google Cloud → OAuth consent screen, or publish the app. |
| Login works but data does not sync | Re-run the updated `supabase/schema.sql`, then confirm the five tables under **Database → Replication → `supabase_realtime`**. |
| GitHub Pages shows 404 | Wait a minute after enabling Pages; confirm the branch is `main` and the folder is `/ (root)`. |

## Backup host

If GitHub Pages is blocked on the presentation network, drag this folder onto
<https://app.netlify.com/drop> (or connect the GitHub repo). Netlify gives you a
public HTTPS URL; add that URL to Supabase **Site URL** and **Redirect URLs**
the same way. No code changes are needed because the app always uses the
current origin for the OAuth return.

## Security

The Supabase **publishable/anon** key in `assets/js/config.js` is designed to be
public. Row Level Security in `supabase/schema.sql` decides what each signed-in
user can read and write. Never put the `service_role` key in this repo or in
the browser.
