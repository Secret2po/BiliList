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

> You need **admin** access to the repository to change Pages settings. If the
> page says you do not have permission, ask the repo owner (`Secret2po`) to
> enable it. As a fallback, fork the repo to your own account, enable Pages
> there, and use `https://<your-username>.github.io/BiliList/` — then update
> the Supabase URLs and the public link in this guide to match.

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

Why this still matters: email confirmation/reset links and the old Supabase
OAuth fallback send the user back to the **current page**. If that origin is not
on the allow list, Supabase falls back to the **Site URL**, and a different
origin can make the link fail. The primary Google button now uses Google
Identity Services directly, so it does not use this redirect.

## 3. Check the Google Cloud client

BiliLIST uses **Google Identity Services** for the primary Google button. Open
<https://console.cloud.google.com/apis/credentials> and edit the **Web
application** OAuth client used by Supabase:

* **Authorized JavaScript origins:**
  - `https://secret2po.github.io`
  - `http://localhost:8123` (local development)
  - `http://127.0.0.1:8123` (local development)
* **Authorized redirect URIs:**
  - `https://xsjwhwrnseevlntxwjeg.supabase.co/auth/v1/callback`
    (kept for the Supabase OAuth fallback)

Click **Save**. Google may take a few minutes to accept a new origin.

The app sends the Google ID token to Supabase with `signInWithIdToken`. The
Google **Client ID** in Google Cloud must match the one saved in Supabase
(**Authentication → Providers → Google**) and the `googleClientId` value in
`assets/js/config.js`. The account chooser will then show
`secret2po.github.io` instead of the Supabase project ref.

Set the OAuth consent screen **App name** to `BiliLIST` at
<https://console.cloud.google.com/auth/branding>. If the consent screen is still
in **Testing**, add the Google account you will demo with under **Test users**,
or publish the app.

The Google provider itself is configured at
<https://supabase.com/dashboard/project/xsjwhwrnseevlntxwjeg/auth/providers>.

## 4. Test from any network

1. Turn **Wi-Fi off** on the phone (use mobile data).
2. Open `https://secret2po.github.io/BiliList/`.
3. Tap **Continue with Google**, choose the demo account, and confirm the
   Google popup closes, you stay on the same HTTPS URL, and the dashboard loads.
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
| Google popup: `The given origin is not allowed` / `origin_mismatch` | Add the page's exact origin (for example `https://secret2po.github.io`) to **Authorized JavaScript origins** in Google Cloud → Credentials → your OAuth client. For local testing also add `http://localhost:8123` and `http://127.0.0.1:8123`. |
| Google popup says the app is blocked, or `Access blocked` | Add the demo account as a **Test user** in Google Cloud → OAuth consent screen, or publish the app. |
| `Google sign-in failed the nonce check` | Supabase → Authentication → Providers → Google → turn on **Skip nonce checks**, then try again. |
| The old `...supabase.co` name still appears | Hard-refresh the page. The primary flow should show Google's official button. If you see the green custom button, the Direct Google Sign-In script or `googleClientId` did not load, and the app is using the Supabase OAuth fallback. |
| Google returns to `localhost` or a LAN IP | This is the fallback/email flow. Set Supabase **Site URL** to the public URL and add the public URL under **Redirect URLs**. |
| `Invalid redirect URL` / `requested path is invalid` | The current origin is missing from Supabase **Redirect URLs**. Add it exactly. This affects email links and the fallback, not the primary Google popup. |
| Login works but data does not sync | Re-run the updated `supabase/schema.sql`, then confirm the five tables under **Database → Replication → `supabase_realtime`**. |
| GitHub Pages shows 404 | Wait a minute after enabling Pages; confirm the branch is `main` and the folder is `/ (root)`. |

## Backup host

If GitHub Pages is blocked on the presentation network, drag this folder onto
<https://app.netlify.com/drop> (or connect the GitHub repo). Netlify gives you a
public HTTPS URL. Add that origin to Google Cloud → Credentials → your OAuth
client under **Authorized JavaScript origins** (the primary Google button uses
the page origin), and add it to Supabase **Site URL** / **Redirect URLs** for
email links and the fallback. No application code changes are needed because
the app always uses the current origin.

## Security

The Supabase **publishable/anon** key in `assets/js/config.js` is designed to be
public. Row Level Security in `supabase/schema.sql` decides what each signed-in
user can read and write. Never put the `service_role` key in this repo or in
the browser.
