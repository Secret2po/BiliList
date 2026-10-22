-- ==========================================================================
--  BiliLIST — Supabase database schema
--  Paste this whole file into the Supabase SQL Editor and run it.
--  (Supabase dashboard -> SQL -> New query -> paste -> Run)
-- ==========================================================================

-- --------------------------------------------------------------------------
--  0. Extensions
-- --------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pgcrypto') then
    create extension pgcrypto with schema public;
  end if;
end $$;

-- --------------------------------------------------------------------------
--  1. Shared types
-- --------------------------------------------------------------------------
do $$ begin
  create type public.member_role   as enum ('owner', 'editor', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.workspace_kind as enum ('household', 'friend_group');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.list_kind      as enum ('grocery', 'tasks', 'event', 'inventory');
exception when duplicate_object then null; end $$;

-- --------------------------------------------------------------------------
--  2. Password uniqueness
--  "a password that is unique" -> one password may only belong to one account.
--  We never store the password. We store a bcrypt fingerprint made with a
--  per-database salt that lives in app_secrets (readable only by the server).
--  NOTE: because the fingerprint salt is shared by every row, someone with a
--  full database dump could brute-force it offline. That is acceptable for a
--  student project; for production use per-user salts + a breach check.
-- --------------------------------------------------------------------------
create table if not exists public.app_secrets (
  id            int primary key default 1,
  password_salt text not null
);

insert into public.app_secrets (id, password_salt)
values (1, crypt(gen_random_bytes(16)::text, gen_salt('bf', 10)))
on conflict (id) do nothing;

-- deterministic bcrypt fingerprint of a plaintext password
create or replace function public.password_fingerprint(p_password text)
returns text
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select crypt(coalesce(p_password, ''), (select password_salt from public.app_secrets where id = 1));
$$;

-- registry of every password already in use
create table if not exists public.password_registry (
  fingerprint  text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

-- called by the app before sign-up: is this password already taken?
create or replace function public.password_is_taken(p_password text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.password_registry
    where fingerprint = public.password_fingerprint(p_password)
  );
$$;

-- called by the app just before sign-up. Returns both answers in one round trip:
--   taken       -> is this password already used by an account?
--   fingerprint -> the value the client passes to signUp() so the trigger above
--                  can re-check it server side
create or replace function public.password_claim(p_password text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_fp text;
begin
  v_fp := public.password_fingerprint(p_password);
  return jsonb_build_object(
    'taken', exists (
      select 1 from public.password_registry r where r.fingerprint = v_fp
    ),
    'fingerprint', v_fp
  );
end;
$$;

revoke all on function public.password_fingerprint(text) from public, anon, authenticated;
revoke all on function public.password_is_taken(text) from public, anon, authenticated;
revoke all on function public.password_claim(text) from public;
grant execute on function public.password_claim(text) to anon, authenticated;

-- enforced server side: if a client skips the pre-check and posts a
-- fingerprint that is already registered, the sign-up is rejected.
create or replace function public.enforce_unique_password()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_fp text;
begin
  v_fp := coalesce(new.raw_user_meta_data ->> 'password_fingerprint', '');
  if v_fp <> '' and exists (
    select 1 from public.password_registry r where r.fingerprint = v_fp
  ) then
    raise exception 'PASSWORD_ALREADY_IN_USE'
      using hint = 'That password is already used by another account. Please pick a different one.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_unique_password on auth.users;
create trigger trg_enforce_unique_password
  before insert on auth.users
  for each row execute function public.enforce_unique_password();

-- record the fingerprint once the account exists
create or replace function public.register_password_fingerprint()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_fp text;
begin
  v_fp := coalesce(new.raw_user_meta_data ->> 'password_fingerprint', '');
  if v_fp <> '' then
    insert into public.password_registry (fingerprint, user_id)
    values (v_fp, new.id)
    on conflict (fingerprint) do update set user_id = excluded.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_register_password_fingerprint on auth.users;
create trigger trg_register_password_fingerprint
  after insert on auth.users
  for each row execute function public.register_password_fingerprint();

-- --------------------------------------------------------------------------
--  3. Tables
-- --------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  avatar     text,
  created_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  kind       public.workspace_kind not null default 'household',
  owner_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         public.member_role not null default 'editor',
  online       boolean not null default false,
  joined_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.categories (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null,
  tone         text not null default 'green',
  keywords     text[] not null default '{}',
  is_custom    boolean not null default false,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  unique (workspace_id, name)
);

create table if not exists public.lists (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null,
  kind         public.list_kind not null default 'grocery',
  is_shared    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.items (
  id           uuid primary key default gen_random_uuid(),
  list_id      uuid not null references public.lists(id) on delete cascade,
  name         text not null,
  category_id  uuid references public.categories(id) on delete set null,
  qty_amount   numeric not null default 1,
  qty_unit     text not null default 'pcs',
  done         boolean not null default false,
  assigned_to  uuid references auth.users(id) on delete set null,
  bought_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.pantry (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null,
  category_id  uuid references public.categories(id) on delete set null,
  qty_amount   numeric not null default 1,
  qty_unit     text not null default 'pcs',
  expiry       text,
  level        text not null default 'full',
  updated_at   timestamptz not null default now()
);

create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  list_id      uuid references public.lists(id) on delete set null,
  title        text not null,
  starts_at    timestamptz not null,
  time_label   text,
  chip         text,
  kind         text not null default 'event',
  created_at   timestamptz not null default now()
);

create table if not exists public.activity (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,
  text         text not null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_items_list      on public.items(list_id);
create index if not exists idx_items_assigned  on public.items(assigned_to);
create index if not exists idx_pantry_ws      on public.pantry(workspace_id);
create index if not exists idx_events_ws_time  on public.events(workspace_id, starts_at);
create index if not exists idx_activity_ws     on public.activity(workspace_id, created_at desc);

-- --------------------------------------------------------------------------
--  4. Helper functions used by the row level security policies
-- --------------------------------------------------------------------------
create or replace function public.is_member(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace and m.user_id = auth.uid()
  );
$$;

create or replace function public.member_role(p_workspace uuid)
returns public.member_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.role from public.workspace_members m
  where m.workspace_id = p_workspace and m.user_id = auth.uid()
  limit 1;
$$;

-- can this member write? owners and editors can, viewers can only read
create or replace function public.can_edit(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.member_role(p_workspace) in ('owner', 'editor'), false);
$$;

grant execute on function public.is_member(uuid)     to authenticated;
grant execute on function public.member_role(uuid)   to authenticated;
grant execute on function public.can_edit(uuid)      to authenticated;

-- --------------------------------------------------------------------------
--  5. Triggers
-- --------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_items_touch on public.items;
create trigger trg_items_touch before update on public.items
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_pantry_touch on public.pantry;
create trigger trg_pantry_touch before update on public.pantry
  for each row execute function public.touch_updated_at();

-- new sign-up -> profile row + a starter workspace with the default categories
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ws uuid;
  v_name text;
begin
  v_name := coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1));

  insert into public.profiles (id, full_name, avatar)
  values (new.id, v_name, upper(left(coalesce(v_name, 'U'), 1)))
  on conflict (id) do nothing;

  insert into public.workspaces (name, kind, owner_id)
  values (v_name || '''s household', 'household', new.id)
  returning id into v_ws;

  insert into public.workspace_members (workspace_id, user_id, role, online)
  values (v_ws, new.id, 'owner', true);

  -- the eight starter categories
  insert into public.categories (workspace_id, name, tone, sort_order, keywords) values
    (v_ws, 'Produce',            'green', 1,  '{avocado,banana,tomato,apple,lettuce,onion,garlic,carrot,spinach,mango,lemon,cucumber,pepper,potato,calamansi,ampalaya,sitao,kangkung,pechay,ube,suman,binugo}'),
    (v_ws, 'Rice & grains',      'navy',  2,  '{rice,bigas,sinangag,corn,mais,oats,flour,arina,pancit,misua,spaghetti,macaroni,cornstarch}'),
    (v_ws, 'Meat & poultry',     'red',   3,  '{chicken,beef,pork,lamb,bacon,sausage,hotdog,longganisa,tocino,chorizo,ham,litaw}'),
    (v_ws, 'Fish & seafood',     'blue',  4,  '{fish,bangus,tilapia,galunggong,tuna,squid,shrimp,aligue,oyster,tuyo,daing,patis,bagoong}'),
    (v_ws, 'Dairy & eggs',       'gold',  5,  '{milk,cheese,egg,butter,yogurt,cream,kefir,margarine,cheddar,mozzarella,parmesan}'),
    (v_ws, 'Bakery',             'wheat', 6,  '{bread,bun,bagel,croissant,pastry,tortilla,pandesal,sourdough,loaf,puto,spanish}'),
    (v_ws, 'Canned & dried',     'pink',  7,  '{canned,sardines,tuna,corned beef,dried fish,nori,cocoa,canned milk,pineapple,raisins,honey,jam,peanut}'),
    (v_ws, 'Sauces & condiments','grey',  8,  '{soy sauce,toyo,vinegar,sukang,bagoong,patis,ketchup,mayonnaise,salamat,sambal,toyomansi,dayok,atchara}'),
    (v_ws, 'Snacks & sweets',    'violet',9,  '{chips,biscuit,candy,chocolate,cracker,nuts,popcorn,chicharon,prawn cracker,kwek kwek,fish ball,lumpia,balut,turon,shaved ice}'),
    (v_ws, 'Beverages',          'teal',  10, '{juice,soda,water,coffee,tea,cider,beer,wine,milo,kapeng barako,salabat,juice tetra}'),
    (v_ws, 'Frozen',             'lime',  11, '{frozen,ice cream,frozen chicken,frozen fish,ice}'),
    (v_ws, 'Cleaning',           'blue',  12, '{dishwashing,dish soap,detergent,laundry,soap,sponge,bleach,mop,cleaner,foil,trash,tissue,disinfectant,fabric softener}'),
    (v_ws, 'Household & care',   'brown', 13, '{shampoo,soap,toothpaste,toothbrush,deodorant,cotton buds,razor,battery,bulb,diaper,sanitary napkin,lotion}'),
    (v_ws, 'Other',              'grey',  14, '{}');

  -- a starter shopping list
  insert into public.lists (workspace_id, name, kind) values (v_ws, 'The weekly shop', 'grocery');

  return new;
end;
$$;

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- checking an item off puts it in the pantry
create or replace function public.move_item_to_pantry()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ws uuid;
  v_cat uuid;
begin
  if new.done is not distinct from old.done then
    return new;
  end if;

  select l.workspace_id into v_ws from public.lists l where l.id = new.list_id;

  if new.done then
    new.bought_at := now();
    select c.id into v_cat from public.categories c
    where c.workspace_id = v_ws and lower(c.name) = lower(new.name);
    select c.id into v_cat from public.categories c
    where c.workspace_id = v_ws and c.id = new.category_id;

    insert into public.pantry (workspace_id, name, category_id, qty_amount, qty_unit, expiry, level)
    values (v_ws, new.name, new.category_id, new.qty_amount, new.qty_unit, 'Just bought', 'full')
    on conflict do nothing;

    update public.pantry
      set qty_amount = qty_amount + new.qty_amount, updated_at = now()
      where workspace_id = v_ws and lower(name) = lower(new.name);
  else
    update public.pantry
      set qty_amount = greatest(0, qty_amount - new.qty_amount), updated_at = now()
      where workspace_id = v_ws and lower(name) = lower(new.name);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_move_item_to_pantry on public.items;
create trigger trg_move_item_to_pantry
  after insert or update of done on public.items
  for each row execute function public.move_item_to_pantry();

-- --------------------------------------------------------------------------
--  6. Row level security
--  Owner  -> full control
--  Editor -> can change items, lists, pantry, events, categories
--  Viewer -> read only
-- --------------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.workspaces         enable row level security;
alter table public.workspace_members  enable row level security;
alter table public.categories         enable row level security;
alter table public.lists              enable row level security;
alter table public.items               enable row level security;
alter table public.pantry             enable row level security;
alter table public.events             enable row level security;
alter table public.activity           enable row level security;

-- profiles: you can read and update your own
drop policy if exists p_profiles_read  on public.profiles;
create policy p_profiles_read on public.profiles
  for select to authenticated using (true);
drop policy if exists p_profiles_write on public.profiles;
create policy p_profiles_write on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- workspaces
drop policy if exists p_ws_read on public.workspaces;
create policy p_ws_read on public.workspaces
  for select to authenticated using (public.is_member(id));
drop policy if exists p_ws_write on public.workspaces;
create policy p_ws_write on public.workspaces
  for update to authenticated using (public.member_role(id) = 'owner') with check (public.member_role(id) = 'owner');
drop policy if exists p_ws_insert on public.workspaces;
create policy p_ws_insert on public.workspaces
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists p_ws_delete on public.workspaces;
create policy p_ws_delete on public.workspaces
  for delete to authenticated using (owner_id = auth.uid());

-- workspace members
drop policy if exists p_members_read on public.workspace_members;
create policy p_members_read on public.workspace_members
  for select to authenticated using (public.is_member(workspace_id));
drop policy if exists p_members_write on public.workspace_members;
create policy p_members_write on public.workspace_members
  for all to authenticated
  using (public.member_role(workspace_id) = 'owner')
  with check (public.member_role(workspace_id) = 'owner');

-- categories
drop policy if exists p_cat_read on public.categories;
create policy p_cat_read on public.categories
  for select to authenticated using (public.is_member(workspace_id));
drop policy if exists p_cat_write on public.categories;
create policy p_cat_write on public.categories
  for all to authenticated
  using (public.can_edit(workspace_id)) with check (public.can_edit(workspace_id));

-- lists
drop policy if exists p_lists_read on public.lists;
create policy p_lists_read on public.lists
  for select to authenticated using (public.is_member(workspace_id));
drop policy if exists p_lists_write on public.lists;
create policy p_lists_write on public.lists
  for all to authenticated
  using (public.can_edit(workspace_id)) with check (public.can_edit(workspace_id));

-- items
drop policy if exists p_items_read on public.items;
create policy p_items_read on public.items
  for select to authenticated using (
    exists (select 1 from public.lists l where l.id = list_id and public.is_member(l.workspace_id))
  );
drop policy if exists p_items_write on public.items;
create policy p_items_write on public.items
  for all to authenticated using (
    exists (select 1 from public.lists l where l.id = list_id and public.can_edit(l.workspace_id))
  ) with check (
    exists (select 1 from public.lists l where l.id = list_id and public.can_edit(l.workspace_id))
  );

-- pantry
drop policy if exists p_pantry_read on public.pantry;
create policy p_pantry_read on public.pantry
  for select to authenticated using (public.is_member(workspace_id));
drop policy if exists p_pantry_write on public.pantry;
create policy p_pantry_write on public.pantry
  for all to authenticated
  using (public.can_edit(workspace_id)) with check (public.can_edit(workspace_id));

-- events
drop policy if exists p_events_read on public.events;
create policy p_events_read on public.events
  for select to authenticated using (public.is_member(workspace_id));
drop policy if exists p_events_write on public.events;
create policy p_events_write on public.events
  for all to authenticated
  using (public.can_edit(workspace_id)) with check (public.can_edit(workspace_id));

-- activity
drop policy if exists p_activity_read on public.activity;
create policy p_activity_read on public.activity
  for select to authenticated using (public.is_member(workspace_id));
drop policy if exists p_activity_write on public.activity;
create policy p_activity_write on public.activity
  for insert to authenticated with check (public.is_member(workspace_id));
