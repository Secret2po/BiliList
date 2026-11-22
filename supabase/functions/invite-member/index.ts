// BiliLIST — invite-member Edge Function
// Deploy: supabase functions deploy invite-member
// Secrets (Supabase Dashboard -> Project Settings -> Edge Functions -> Secrets):
//   BREVO_API_KEY   = your Brevo SMTP/API key (xsmtpsib-...)
//   BREVO_SENDER    = bililist1107@gmail.com  (a verified Brevo sender)
//   BREVO_SENDER_NAME = BiliLIST
//
// The client calls this with { email, role, workspaceName, inviterName, inviteUrl }.
// It sends a branded HTML email with ONE big button that opens the invite in
// the app, where the recipient can Accept or Reject.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const HTML_TEMPLATE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f2eee2;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2eee2;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#1b6b3a;padding:28px 32px;">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:bold;color:#ffffff;letter-spacing:1px;">BiliLIST</div>
<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#d6e8d6;margin-top:4px;">Make a list. Share the load. Live lighter.</div>
</td></tr>
<tr><td style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:#2c3527;font-size:15px;line-height:1.6;">
<p style="margin:0 0 16px;">Hi there,</p>
<p style="margin:0 0 16px;"><b>__INVITER__</b> invited you to join <b>__WORKSPACE__</b> on BiliLIST as an <b>__ROLE__</b>.</p>
<p style="margin:0 0 16px;">Open the invitation below to accept or decline — it is your choice.</p>
<p style="margin:26px 0;"><a href="__INVITE_URL__" style="background:#1b6b3a;color:#ffffff;text-decoration:none;padding:14px 30px;border-radius:999px;font-weight:bold;font-size:16px;display:inline-block;">View invitation</a></p>
<p style="margin:0 0 16px;">This invitation expires in <b>7 days</b>. If you were not expecting it, you can safely ignore this email — nothing changes without your approval.</p>
<p style="margin:0;font-size:13px;color:#6b7263;">Shared lists, calmer days,<br><b style="color:#2c3527;">The BiliLIST team</b></p>
</td></tr>
<tr><td style="padding:18px 32px;background:#faf6ec;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8a8f7f;">BiliLIST · A little order, a lighter day.</td></tr>
</table></td></tr></table></body></html>`;

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  try {
    const body = await req.json();
    const { email, role, workspaceName, inviterName, inviteUrl } = body;
    if (!email || !inviteUrl) {
      return new Response(JSON.stringify({ error: 'email and inviteUrl are required' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const apiKey = Deno.env.get('BREVO_API_KEY');
    const sender = Deno.env.get('BREVO_SENDER') || 'bililist1107@gmail.com';
    const senderName = Deno.env.get('BREVO_SENDER_NAME') || 'BiliLIST';
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'BREVO_API_KEY secret is not set' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const html = HTML_TEMPLATE
      .replace('__INVITER__', esc(inviterName || 'A household member'))
      .replace('__WORKSPACE__', esc(workspaceName || 'their household'))
      .replace('__ROLE__', esc(role || 'Editor'))
      .replace('__INVITE_URL__', esc(inviteUrl));

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: senderName, email: sender },
        to: [{ email: String(email).trim() }],
        subject: `You're invited to ${workspaceName || 'a BiliLIST household'}`,
        htmlContent: html,
      }),
    });
    const payload = await res.text();
    if (!res.ok) {
      return new Response(payload, { status: res.status, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ sent: true }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = (e && e.message) || 'Unexpected error';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
