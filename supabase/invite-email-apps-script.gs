/**
 * BiliLIST — invite email sender (Google Apps Script, no Brevo / no CLI)
 *
 * SETUP (all in the browser, ~5 minutes):
 *  1. Go to https://script.google.com while signed in as bililist1107@gmail.com
 *  2. New Project → delete the default code → paste this whole file → Save.
 *  3. Pick function "setup" in the toolbar → Run → review permissions → allow.
 *     (This stores your shared secret in the script.)
 *  4. Deploy → New deployment → Web app:
 *       Description: BiliLIST invites
 *       Execute as: Me
 *       Who has access: Anyone
 *     → Deploy → authorize → copy the Web app URL.
 *  5. Paste that URL into supabase/invite-email-sql-only.sql (one line) and
 *     paste the SAME shared secret you chose in step 3, then run the SQL.
 *
 * The SQL trigger POSTs { secret, to, subject, html } to this web app.
 */

// CHANGE THIS to any long random string, then keep it identical in the SQL file.
var SHARED_SECRET = 'bililist-invite-2026-change-me';

function setup() {
  // A one-time setup run so the permission dialog is approved before deploying.
  Logger.log('BiliLIST invite sender ready. Secret: ' + SHARED_SECRET);
}

function doPost(e) {
  try {
    var body = e && e.postData && e.postData.contents
      ? JSON.parse(e.postData.contents)
      : {};

    // Reject anything that does not carry our shared secret.
    if (body.secret !== SHARED_SECRET) {
      return respond({ ok: false, error: 'Unauthorized' });
    }
    if (!body.to || !body.html) {
      return respond({ ok: false, error: 'Missing to/html' });
    }

    GmailApp.sendEmail(body.to, body.subject || 'BiliLIST invitation',
      'This email contains HTML. Open it in an HTML-capable mail client.',
      { htmlBody: body.html, name: 'BiliLIST' });

    return respond({ ok: true });
  } catch (err) {
    return respond({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet(e) {
  return respond({ ok: true, service: 'BiliLIST invite sender' });
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
