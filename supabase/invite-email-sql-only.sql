-- ==========================================================================
--  BiliLIST — invite emails via Gmail (Google Apps Script), no Brevo / no CLI
--  Run this in Supabase → SQL Editor after schema.sql.
--
--  TWO THINGS TO EDIT (search "CHANGE ME"):
--    1. web_app_url  = the Web app URL from your Google Apps Script deployment
--    2. shared_secret = the SHARED_SECRET from apps-script.gs (must match)
--  Then paste this whole file into the SQL Editor and click Run.
--
--  How it works: an AFTER INSERT trigger on workspace_invites calls a Google
--  Apps Script web app through pg_net (asynchronous, inserts never block).
--  The script emails the branded HTML from bililist1107@gmail.com. It also
--  files an in-app Notification for the invitee if they already use BiliLIST.
-- ==========================================================================

-- 1. Enable the async HTTP extension
create extension if not exists pg_net with schema extensions;

-- 2. Private config table: the web app URL + shared secret (deny-all to clients)
create table if not exists public.app_mail_settings (
  id             int primary key default 1,
  web_app_url    text not null default '',
  shared_secret  text not null default ''
);
alter table public.app_mail_settings enable row level security;
revoke all on public.app_mail_settings from anon, authenticated;

insert into public.app_mail_settings (id, web_app_url, shared_secret)
values (1,
  'CHANGE_ME_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL',
  'CHANGE_ME_YOUR_SHARED_SECRET')
on conflict (id) do nothing;

-- 3. Tiny HTML escaper so names from the database cannot break the email
create or replace function public.esc_html(p_text text)
returns text language sql immutable
set search_path = ''
as $$
  select replace(replace(replace(replace(replace(
    coalesce(p_text, ''),
    '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');
$$;

-- 4. The sender: builds the branded email and POSTs it to the Apps Script
create or replace function public.dispatch_invite_email(p_invite record)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url       text;
  v_secret    text;
  v_ws        text;
  v_inviter   text;
  v_link      text;
  v_html      text;
begin
  select web_app_url, shared_secret into v_url, v_secret
  from public.app_mail_settings where id = 1;

  -- if setup is incomplete, stay silent rather than spamming errors
  if v_url is null or v_url = '' or v_url = 'CHANGE_ME_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL'
     or v_secret is null or v_secret = '' or v_secret = 'CHANGE_ME_YOUR_SHARED_SECRET' then
    return;
  end if;

  select name into v_ws from public.workspaces where id = p_invite.workspace_id;
  select full_name into v_inviter from public.profiles where id = p_invite.invited_by;

  v_link := 'https://secret2po.github.io/BiliList/?invite=' || p_invite.token || '#/dashboard';

  v_html :=
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' ||
    '<meta name="viewport" content="width=device-width, initial-scale=1"></head>' ||
    '<body style="margin:0;padding:0;background:#f2eee2;">' ||
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2eee2;padding:28px 12px;">' ||
    '<tr><td align="center"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">' ||
    '<tr><td style="background:#1b6b3a;padding:28px 32px;">' ||
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:bold;color:#ffffff;letter-spacing:1px;">BiliLIST</div>' ||
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#d6e8d6;margin-top:4px;">Make a list. Share the load. Live lighter.</div></td></tr>' ||
    '<tr><td style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:#2c3527;font-size:15px;line-height:1.6;">' ||
    '<p style="margin:0 0 16px;">Hi there,</p>' ||
    '<p style="margin:0 0 16px;"><b>__INVITER__</b> invited you to join <b>__WORKSPACE__</b> on BiliLIST as an <b>__ROLE__</b>.</p>' ||
    '<p style="margin:0 0 16px;">Open the invitation below to accept or decline — it is your choice.</p>' ||
    '<p style="margin:26px 0;"><a href="__URL__" style="background:#1b6b3a;color:#ffffff;text-decoration:none;padding:14px 30px;border-radius:999px;font-weight:bold;font-size:16px;display:inline-block;">View invitation</a></p>' ||
    '<p style="margin:0 0 16px;">This invitation expires in <b>7 days</b>. If you were not expecting it, you can safely ignore this email.</p>' ||
    '<p style="margin:0;font-size:13px;color:#6b7263;">Shared lists, calmer days,<br><b style="color:#2c3527;">The BiliLIST team</b></p>' ||
    '</td></tr><tr><td style="padding:18px 32px;background:#faf6ec;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8a8f7f;">BiliLIST · A little order, a lighter day.</td></tr>' ||
    '</table></td></tr></table></body></html>';

  v_html := replace(v_html, '__INVITER__',   public.esc_html(coalesce(v_inviter, 'A household member')));
  v_html := replace(v_html, '__WORKSPACE__', public.esc_html(coalesce(v_ws, 'a BiliLIST household')));
  v_html := replace(v_html, '__ROLE__',      public.esc_html(initcap(coalesce(p_invite.role::text, 'editor'))));
  v_html := replace(v_html, '__URL__',       public.esc_html(v_link));

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'secret',  v_secret,
      'to',      p_invite.email,
      'subject', 'You''re invited to ' || coalesce(v_ws, 'a BiliLIST household'),
      'html',    v_html
    )
  );
end;
$$;

-- 5. Trigger: email + in-app notification when an invite is created
create or replace function public.on_invite_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.dispatch_invite_email(new);

  insert into public.notifications (user_id, workspace_id, kind, title, body, data)
  select u.id, new.workspace_id, 'invite',
         coalesce((select full_name from public.profiles where id = new.invited_by), 'A household member')
           || ' invited you to ' || coalesce((select name from public.workspaces where id = new.workspace_id), 'a household'),
         'Open to accept or reject',
         jsonb_build_object('inviteId', new.id, 'token', new.token)
  from auth.users u
  where lower(u.email) = lower(new.email)
    and not exists (
      select 1 from public.notifications n
      where n.user_id = u.id and n.kind = 'invite'
        and n.data ->> 'inviteId' = new.id::text
    );

  return new;
end;
$$;

drop trigger if exists trg_send_invite_email on public.workspace_invites;
create trigger trg_send_invite_email
  after insert on public.workspace_invites
  for each row execute function public.on_invite_created();

-- 6. Resend RPC used by the "Resend" button in Manage Members
create or replace function public.resend_invite_email(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
begin
  select * into v from public.workspace_invites
  where token = p_token and status = 'pending';
  if not found then
    return false;
  end if;
  perform public.dispatch_invite_email(v);
  return true;
end;
$$;

revoke all on function public.resend_invite_email(text) from public;
grant execute on function public.resend_invite_email(text) to authenticated;

-- Done. Test after inviting: select * from net._http_response order by created desc limit 5;
