-- =====================================================================
--  CENTER LODGE  -  booking system schema for Supabase (Postgres)  -  VERSION 2
--  Paste this whole file into Supabase > SQL Editor > New query > Run.
--  Safe to re-run: it updates functions and policies in place, and it
--  upgrades a version 1 database to version 2 without losing any data.
--
--  ROOM RULE (new in v2): a booking only takes rooms off the availability
--  when staff ACCEPT it, when the guest's ONLINE PAYMENT is verified, or
--  when staff create/confirm it. Pending requests do not hold rooms.
--  Room blocks (maintenance etc.) also take rooms off.
--
--  SECURITY MODEL (read this once)
--   * Every table has Row Level Security ON and NO access for the public.
--   * The public website can only call the small set of functions granted
--     at the bottom of this file. Those functions validate every input,
--     calculate prices on the server and never trust the browser.
--   * Only users listed in public.admins can read bookings or call admin_*.
--   * Access codes are stored only as salted SHA-256 hashes.
-- =====================================================================

-- ---------- tables ---------------------------------------------------
create table if not exists public.room_types (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  name            text not null,
  description     text not null default '',
  price_per_night numeric(10,2) not null check (price_per_night > 0),
  total_rooms     int  not null check (total_rooms >= 0),
  max_guests      int  not null default 2 check (max_guests between 1 and 12),
  sort_order      int  not null default 0,
  active          boolean not null default true,
  updated_at      timestamptz not null default now()
);

create table if not exists public.bookings (
  id             uuid primary key default gen_random_uuid(),
  reference      text unique not null,
  room_type_id   uuid not null references public.room_types(id),
  check_in       date not null,
  check_out      date not null,
  rooms          int  not null check (rooms between 1 and 10),
  guests         int  not null check (guests between 1 and 60),
  guest_name     text not null check (char_length(guest_name) between 2 and 80),
  email          text not null check (char_length(email) <= 254),
  phone          text not null check (char_length(phone) <= 30),
  phone_digits   text not null,
  notes          text check (char_length(notes) <= 500),
  status         text not null default 'pending'
                 check (status in ('pending','confirmed','checked_in','checked_out','cancelled','declined','no_show')),
  total_amount   numeric(10,2) not null check (total_amount >= 0),
  paid_amount    numeric(10,2) not null default 0 check (paid_amount >= 0),
  source         text not null default 'web' check (source in ('web','admin')),
  modified_count int  not null default 0,
  modified_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint dates_ok check (check_out > check_in)
);
create index if not exists bookings_inventory_idx on public.bookings (room_type_id, check_in, check_out)
  where status in ('pending','confirmed','checked_in');
create index if not exists bookings_email_idx on public.bookings (lower(email));
create index if not exists bookings_phone_idx on public.bookings (phone_digits);
create index if not exists bookings_created_idx on public.bookings (created_at desc);

-- v2 columns (idempotent: upgrades an existing v1 database in place)
alter table public.bookings add column if not exists country text not null default 'Zambia' check (char_length(country) between 2 and 60);
alter table public.bookings add column if not exists is_international boolean generated always as (lower(btrim(country)) <> 'zambia') stored;
alter table public.bookings add column if not exists payment_pref text not null default 'cash' check (payment_pref in ('cash','bank_transfer','online'));
alter table public.bookings add column if not exists cancel_requested_at timestamptz;
alter table public.bookings add column if not exists cancel_reason text check (char_length(cancel_reason) <= 300);
alter table public.bookings add column if not exists accepted_at timestamptz;
update public.bookings set accepted_at = coalesce(accepted_at, updated_at) where accepted_at is null and status in ('confirmed','checked_in','checked_out');
create index if not exists bookings_hold_idx on public.bookings (room_type_id, check_in, check_out) where status in ('confirmed','checked_in');

-- access-code hashes live in their own table so they are never selectable
-- by anyone (not even admins) and never appear in realtime payloads.
create table if not exists public.booking_secrets (
  booking_id  uuid primary key references public.bookings(id) on delete cascade,
  access_hash bytea not null
);

create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings(id) on delete restrict,
  amount       numeric(10,2) not null check (amount > 0),
  method       text not null check (method in ('cash','mobile_money','card','bank_transfer','online')),
  status       text not null default 'paid' check (status in ('paid','pending','failed','refunded')),
  provider     text,
  provider_ref text unique,
  note         text check (char_length(note) <= 300),
  recorded_by  uuid,
  created_at   timestamptz not null default now()
);

alter table public.payments add column if not exists receipt_no text;
update public.payments set receipt_no = 'RC-' || upper(substr(replace(id::text, '-', ''), 1, 8)) where receipt_no is null;
create unique index if not exists payments_receipt_idx on public.payments (receipt_no);

create table if not exists public.booking_events (
  id         bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  kind       text not null,
  actor      text not null check (actor in ('customer','admin','system')),
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists booking_events_idx on public.booking_events (booking_id, created_at);

create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  kind       text not null,
  title      text not null,
  body       text not null default '',
  booking_id uuid references public.bookings(id) on delete cascade,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_idx on public.notifications (is_read, created_at desc);

create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  actor      uuid,
  action     text not null,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.room_blocks (
  id           uuid primary key default gen_random_uuid(),
  room_type_id uuid not null references public.room_types(id) on delete cascade,
  date_from    date not null,
  date_to      date not null,                       -- first night that is free again (like check-out)
  rooms        int  not null check (rooms between 1 and 500),
  reason       text check (char_length(reason) <= 200),
  created_by   uuid,
  created_at   timestamptz not null default now(),
  constraint block_dates_ok check (date_to > date_from)
);
create index if not exists room_blocks_idx on public.room_blocks (room_type_id, date_from, date_to);

create table if not exists public.payment_intents (
  id              uuid primary key default gen_random_uuid(),
  reference       text unique not null,             -- the reference sent to Lenco (we create it, never the browser)
  booking_id      uuid not null references public.bookings(id) on delete cascade,
  amount          numeric(10,2) not null check (amount > 0),
  currency        text not null default 'ZMW',
  status          text not null default 'initiated'
                  check (status in ('initiated','pending','successful','failed','expired','needs_review')),
  lenco_reference text,
  channel         text,
  failure_reason  text,
  note            text,
  created_at      timestamptz not null default now(),
  last_checked_at timestamptz,
  completed_at    timestamptz
);
create index if not exists payment_intents_booking_idx on public.payment_intents (booking_id, created_at desc);

create table if not exists public.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         int not null default 0,
  primary key (key, window_start)
);

-- ---------- lock everything down (RLS on, no default grants) ---------
alter table public.room_types      enable row level security;
alter table public.bookings        enable row level security;
alter table public.booking_secrets enable row level security;
alter table public.payments        enable row level security;
alter table public.booking_events  enable row level security;
alter table public.notifications   enable row level security;
alter table public.audit_log       enable row level security;
alter table public.admins          enable row level security;
alter table public.rate_limits     enable row level security;
alter table public.room_blocks     enable row level security;
alter table public.payment_intents enable row level security;

revoke all on all tables    in schema public from anon, authenticated, public;
revoke all on all sequences in schema public from anon, authenticated, public;
revoke execute on all functions in schema public from public, anon, authenticated;

-- ---------- helpers (internal: nobody can call these directly) -------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

create or replace function public._today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Africa/Lusaka')::date;
$$;

create or replace function public._err(p_code text, p_msg text) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('ok', false, 'error', p_code, 'message', p_msg);
$$;

create or replace function public._hash(p_text text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(coalesce(p_text,''), 'UTF8')), 'hex');
$$;

create or replace function public._client_ip() returns text
language plpgsql stable set search_path = '' as $$
declare h json; v text;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then h := null;
  end;
  v := coalesce(h->>'cf-connecting-ip', h->>'x-real-ip', split_part(coalesce(h->>'x-forwarded-for',''), ',', 1), '');
  return coalesce(nullif(trim(v), ''), 'unknown');
end $$;

-- returns true while the caller is under the limit, false once over it.
-- (It never raises, so the counter still commits when a request is refused.)
create or replace function public._rl(p_key text, p_max int, p_secs int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_win timestamptz; v_hits int;
begin
  v_win := to_timestamp(floor(extract(epoch from now()) / p_secs) * p_secs);
  insert into public.rate_limits as r (key, window_start, hits) values (public._hash(p_key), v_win, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;
  return v_hits <= p_max;
end $$;

create or replace function public._rand_code(n int) returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   -- 32 chars, no I/O/0/1
  u1 bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  u2 bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  b  bytea;
  s  text := '';
begin
  -- skip the uuid version/variant bytes so every byte used is fully random
  b := substring(u1 from 1 for 6) || substring(u1 from 10 for 7) || substring(u2 from 1 for 6);
  for i in 0 .. n - 1 loop
    s := s || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return s;
end $$;

create or replace function public._norm_phone(p text) returns text
language sql immutable set search_path = '' as $$
  select case when length(d) >= 9 then right(d, 9) else d end
  from (select regexp_replace(coalesce(p,''), '[^0-9]', '', 'g') as d) x;
$$;

create or replace function public._clean(p text, p_max int) returns text
language sql immutable set search_path = '' as $$
  select left(btrim(regexp_replace(coalesce(p,''), '[\x00-\x1F\x7F<>]', '', 'g')), p_max);
$$;

-- rooms still free on EVERY night of [p_in, p_out) for a room type
-- rooms still free on EVERY night of [p_in, p_out) for a room type.
-- Only ACCEPTED (confirmed / checked-in) bookings and staff room blocks take rooms off.
create or replace function public._available(p_type uuid, p_in date, p_out date, p_exclude uuid default null)
returns int language plpgsql stable security definer set search_path = '' as $$
declare v_total int; v_peak int;
begin
  select total_rooms into v_total from public.room_types where id = p_type and active;
  if not found then return 0; end if;
  select coalesce(max(c), 0) into v_peak from (
    select (select coalesce(sum(b.rooms), 0) from public.bookings b
             where b.room_type_id = p_type
               and b.status in ('confirmed','checked_in')
               and b.check_in <= g.d::date and b.check_out > g.d::date
               and (p_exclude is null or b.id <> p_exclude))
         + (select coalesce(sum(k.rooms), 0) from public.room_blocks k
             where k.room_type_id = p_type
               and k.date_from <= g.d::date and k.date_to > g.d::date) as c
      from generate_series(p_in::timestamp, (p_out - 1)::timestamp, interval '1 day') g(d)
  ) s;
  return greatest(v_total - v_peak, 0);
end $$;

-- returns an error message, or null when the stay is acceptable
create or replace function public._check_stay(p_in date, p_out date, p_rooms int, p_guests int, p_max_guests int)
returns text language plpgsql stable set search_path = '' as $$
begin
  if p_in is null or p_out is null then return 'Please choose your check-in and check-out dates.'; end if;
  if p_in < public._today() then return 'Check-in cannot be in the past.'; end if;
  if p_out <= p_in then return 'Check-out must be after check-in.'; end if;
  if p_out - p_in > 30 then return 'Stays are limited to 30 nights online. Please contact us for longer stays.'; end if;
  if p_in > public._today() + 365 then return 'We can only take bookings up to a year ahead.'; end if;
  if p_rooms is null or p_rooms < 1 or p_rooms > 10 then return 'Please choose between 1 and 10 rooms.'; end if;
  if p_guests is null or p_guests < 1 then return 'Please enter the number of guests.'; end if;
  if p_guests > p_rooms * p_max_guests then
    return format('This room type sleeps up to %s guests per room. Please add rooms or choose another type.', p_max_guests);
  end if;
  return null;
end $$;

create or replace function public._notify(p_kind text, p_title text, p_body text, p_booking uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (kind, title, body, booking_id) values (p_kind, p_title, p_body, p_booking);
$$;

create or replace function public._event(p_booking uuid, p_kind text, p_actor text, p_details jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.booking_events (booking_id, kind, actor, details) values (p_booking, p_kind, p_actor, coalesce(p_details, '{}'::jsonb));
$$;

-- shared insert used by the public booking and the admin walk-in booking
drop function if exists public._insert_booking(uuid, date, date, int, int, text, text, text, text, text, text);
create or replace function public._insert_booking(
  p_type uuid, p_in date, p_out date, p_rooms int, p_guests int,
  p_name text, p_email text, p_phone text, p_country text, p_pref text, p_notes text, p_status text, p_source text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  rt public.room_types%rowtype;
  v_msg text; v_ref text; v_code text; v_id uuid; v_total numeric; v_nights int;
  v_name text := public._clean(p_name, 80);
  v_email text := lower(public._clean(p_email, 254));
  v_phone text := public._clean(p_phone, 30);
  v_digits text := public._norm_phone(p_phone);
  v_notes text := nullif(public._clean(p_notes, 500), '');
  v_country text := public._clean(p_country, 60);
  v_pref text := case when p_pref in ('cash','bank_transfer','online') then p_pref else 'cash' end;
begin
  if char_length(v_name) < 2 then return public._err('invalid_name', 'Please enter your full name.'); end if;
  if v_email !~ '^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$' then return public._err('invalid_email', 'Please enter a valid email address.'); end if;
  if char_length(v_digits) < 9 or char_length(regexp_replace(v_phone, '[^0-9]', '', 'g')) > 15 then
    return public._err('invalid_phone', 'Please enter a valid phone number.'); end if;
  if char_length(v_country) < 2 or v_country ~ '[0-9]' then return public._err('invalid_country', 'Please choose the country you are travelling from.'); end if;
  if lower(v_country) = 'zambia' then v_country := 'Zambia'; end if;

  -- serialise all bookings for this room type so two guests can never take the last room
  select * into rt from public.room_types where id = p_type and active for update;
  if not found then return public._err('invalid_room', 'That room type is not available.'); end if;

  v_msg := public._check_stay(p_in, p_out, p_rooms, p_guests, rt.max_guests);
  if v_msg is not null then return public._err('invalid_stay', v_msg); end if;

  if public._available(p_type, p_in, p_out) < p_rooms then
    return public._err('not_available', 'Sorry, that room type is fully booked for these dates. Please choose other dates or another room type.');
  end if;

  v_nights := p_out - p_in;
  v_total  := v_nights * p_rooms * rt.price_per_night;     -- price ALWAYS comes from the database
  v_code   := public._rand_code(8);

  loop
    v_ref := 'CL-' || public._rand_code(6);
    begin
      insert into public.bookings (reference, room_type_id, check_in, check_out, rooms, guests, guest_name, email, phone,
                                   phone_digits, notes, status, total_amount, source, country, payment_pref, accepted_at)
      values (v_ref, p_type, p_in, p_out, p_rooms, p_guests, v_name, v_email, v_phone, v_digits, v_notes, p_status, v_total, p_source,
              v_country, v_pref, case when p_status = 'confirmed' then now() end)
      returning id into v_id;
      exit;
    exception when unique_violation then null;
    end;
  end loop;

  insert into public.booking_secrets (booking_id, access_hash)
  values (v_id, sha256(convert_to(v_ref || ':' || v_code, 'UTF8')));

  return jsonb_build_object('ok', true, 'id', v_id, 'reference', v_ref, 'access_code', v_code,
                            'total', v_total, 'nights', v_nights, 'status', p_status, 'room', rt.name,
                            'country', v_country, 'is_international', lower(v_country) <> 'zambia', 'payment_pref', v_pref);
end $$;


-- =====================================================================
--  PUBLIC FUNCTIONS (callable from the website with the anon key)
-- =====================================================================
create or replace function public.get_availability(p_in date, p_out date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_msg text; v_rows jsonb; v_n int;
begin
  if not public._rl('avail:' || public._client_ip(), 300, 600) then
    return public._err('rate_limited', 'Too many requests. Please wait a minute and try again.');
  end if;
  v_msg := public._check_stay(p_in, p_out, 1, 1, 1);
  if v_msg is not null then return public._err('invalid_stay', v_msg); end if;
  v_n := p_out - p_in;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'slug', r.slug, 'name', r.name, 'description', r.description,
           'price_per_night', r.price_per_night, 'max_guests', r.max_guests,
           'available', public._available(r.id, p_in, p_out),
           'stay_total_per_room', r.price_per_night * v_n) order by r.sort_order, r.price_per_night), '[]'::jsonb)
    into v_rows from public.room_types r where r.active;
  return jsonb_build_object('ok', true, 'nights', v_n, 'rooms', v_rows);
end $$;

-- remove version 1 functions that changed shape (so old copies cannot linger)
drop function if exists public.create_booking(uuid, date, date, int, int, text, text, text, text, text);
drop function if exists public.cancel_booking(text, text);
drop function if exists public.record_online_payment(text, numeric, text, text);
drop function if exists public.admin_modify_booking(uuid, uuid, date, date, int, int, text, text, text, text);
drop function if exists public.admin_create_booking(uuid, date, date, int, int, text, text, text, text, text);

create or replace function public.create_booking(
  p_room_type uuid, p_in date, p_out date, p_rooms int, p_guests int,
  p_name text, p_email text, p_phone text, p_country text, p_pref text,
  p_notes text default null, p_hp text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_res jsonb; v_open int; v_digits text := public._norm_phone(p_phone); v_mail text := lower(public._clean(p_email, 254));
begin
  if coalesce(p_hp, '') <> '' then                       -- honeypot: real people never fill this in
    return public._err('rejected', 'Sorry, we could not process this request.');
  end if;
  if not public._rl('book:ip:' || public._client_ip(), 10, 3600)
     or not public._rl('book:mail:' || v_mail, 6, 86400)
     or not public._rl('book:tel:' || v_digits, 6, 86400) then
    return public._err('rate_limited', 'Too many booking attempts. Please try again later or call us.');
  end if;

  select count(*) into v_open from public.bookings
   where status in ('pending','confirmed') and check_out > public._today()
     and (lower(email) = v_mail or phone_digits = v_digits);
  if v_open >= 5 then
    return public._err('too_many_open', 'You already have several open bookings. Please manage them first or contact us.');
  end if;

  v_res := public._insert_booking(p_room_type, p_in, p_out, p_rooms, p_guests, p_name, p_email, p_phone, p_country, p_pref, p_notes, 'pending', 'web');
  if (v_res->>'ok')::boolean then
    perform public._event((v_res->>'id')::uuid, 'created', 'customer',
      jsonb_build_object('check_in', p_in, 'check_out', p_out, 'rooms', p_rooms, 'guests', p_guests, 'total', v_res->'total',
                         'country', v_res->'country', 'payment_pref', v_res->'payment_pref'));
    perform public._notify('new_booking', 'New booking request ' || (v_res->>'reference'),
      format('%s from %s asked for %s x %s, %s to %s (K%s). Payment preference: %s. Waiting for your acceptance.',
             public._clean(p_name, 80), v_res->>'country', p_rooms, v_res->>'room', p_in, p_out, v_res->>'total',
             replace(v_res->>'payment_pref', '_', ' ')),
      (v_res->>'id')::uuid);
    v_res := v_res - 'id';
  end if;
  return v_res;
end $$;

create or replace function public.lookup_bookings(p_contact text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_c text := btrim(coalesce(p_contact, '')); v_mail text; v_digits text; v_rows jsonb;
begin
  if char_length(v_c) < 5 or char_length(v_c) > 254 then
    return public._err('invalid_contact', 'Please enter the email address or phone number you booked with.');
  end if;
  if position('@' in v_c) > 0 then v_mail := lower(v_c); else v_digits := public._norm_phone(v_c); end if;
  if v_mail is null and char_length(v_digits) < 9 then
    return public._err('invalid_contact', 'Please enter the full phone number you booked with.');
  end if;
  if not public._rl('look:ip:' || public._client_ip(), 40, 600)
     or not public._rl('look:target:' || coalesce(v_mail, v_digits), 15, 600) then
    return public._err('rate_limited', 'Too many searches. Please wait a few minutes and try again.');
  end if;

  select coalesce(jsonb_agg(x order by x.check_in desc, x.created_at desc), '[]'::jsonb) into v_rows from (
    select b.reference, rt.name as room_type, b.check_in, b.check_out, (b.check_out - b.check_in) as nights,
           b.rooms, b.guests, b.status, b.total_amount, b.paid_amount,
           greatest(b.total_amount - b.paid_amount, 0) as balance,
           b.payment_pref, (b.cancel_requested_at is not null) as cancel_requested,
           b.created_at, b.modified_at,
           (b.status in ('pending','confirmed') and b.check_in >= public._today() and b.cancel_requested_at is null) as can_modify,
           (b.status in ('pending','confirmed','checked_in') and b.total_amount > b.paid_amount and b.cancel_requested_at is null) as can_pay,
           (b.status in ('pending','confirmed') and b.check_in >= public._today()) as can_request_cancel
      from public.bookings b join public.room_types rt on rt.id = b.room_type_id
     where (v_mail is not null and lower(b.email) = v_mail) or (v_digits is not null and b.phone_digits = v_digits)
     order by b.check_in desc, b.created_at desc limit 25
  ) x;
  -- NOTE: names, emails, phone numbers and notes are deliberately never returned here
  return jsonb_build_object('ok', true, 'bookings', v_rows);
end $$;

-- full booking details (for the confirmation / receipt image). Needs reference + access code.
create or replace function public.get_booking_details(p_reference text, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype; v_ref text := upper(btrim(coalesce(p_reference,''))); v_pay jsonb; v_room text;
begin
  if not public._rl('det:ip:' || public._client_ip(), 40, 3600) or not public._rl('det:ref:' || v_ref, 15, 3600) then
    return public._err('rate_limited', 'Too many attempts. Please wait an hour or contact us.');
  end if;
  select bk.* into b from public.bookings bk join public.booking_secrets s on s.booking_id = bk.id
   where bk.reference = v_ref
     and s.access_hash = sha256(convert_to(v_ref || ':' || upper(btrim(coalesce(p_code,''))), 'UTF8'));
  if not found then return public._err('invalid_credentials', 'We could not match that reference and access code.'); end if;
  select name into v_room from public.room_types where id = b.room_type_id;
  select coalesce(jsonb_agg(jsonb_build_object('receipt_no', p.receipt_no, 'amount', p.amount, 'method', p.method,
           'provider', p.provider, 'paid_at', p.created_at) order by p.created_at), '[]'::jsonb)
    into v_pay from public.payments p where p.booking_id = b.id and p.status = 'paid';
  return jsonb_build_object('ok', true, 'booking', jsonb_build_object(
    'reference', b.reference, 'guest_name', b.guest_name, 'email', b.email, 'phone', b.phone, 'country', b.country,
    'room_type', v_room, 'rooms', b.rooms, 'guests', b.guests, 'check_in', b.check_in, 'check_out', b.check_out,
    'nights', b.check_out - b.check_in, 'status', b.status, 'total', b.total_amount, 'paid', b.paid_amount,
    'balance', greatest(b.total_amount - b.paid_amount, 0), 'payment_pref', b.payment_pref, 'notes', b.notes,
    'created_at', b.created_at, 'cancel_requested', b.cancel_requested_at is not null), 'payments', v_pay);
end $$;

create or replace function public.modify_booking(
  p_reference text, p_code text, p_room_type uuid, p_in date, p_out date, p_rooms int, p_guests int
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings%rowtype; rt public.room_types%rowtype; v_ref text := upper(btrim(coalesce(p_reference,'')));
  v_msg text; v_total numeric; v_new_status text; v_old jsonb;
begin
  if not public._rl('mod:ip:' || public._client_ip(), 25, 3600)
     or not public._rl('mod:ref:' || v_ref, 8, 3600) then
    return public._err('rate_limited', 'Too many attempts. Please wait an hour or contact us.');
  end if;

  select bk.* into b from public.bookings bk join public.booking_secrets s on s.booking_id = bk.id
   where bk.reference = v_ref
     and s.access_hash = sha256(convert_to(v_ref || ':' || upper(btrim(coalesce(p_code,''))), 'UTF8'));
  if not found then return public._err('invalid_credentials', 'We could not match that reference and access code.'); end if;

  if b.status not in ('pending','confirmed') or b.check_in < public._today() or b.cancel_requested_at is not null then
    return public._err('not_modifiable', 'This booking can no longer be changed online. Please contact the lodge.');
  end if;

  select * into rt from public.room_types where id = p_room_type and active for update;
  if not found then return public._err('invalid_room', 'That room type is not available.'); end if;
  v_msg := public._check_stay(p_in, p_out, p_rooms, p_guests, rt.max_guests);
  if v_msg is not null then return public._err('invalid_stay', v_msg); end if;
  if public._available(p_room_type, p_in, p_out, b.id) < p_rooms then
    return public._err('not_available', 'Those dates are not available for that room type. Please try other dates or another room type.');
  end if;

  v_total := (p_out - p_in) * p_rooms * rt.price_per_night;
  -- An accepted booking that has money paid keeps its rooms. Otherwise a change goes back to
  -- "pending" so staff can accept the new dates/room (the old rooms are released meanwhile).
  v_new_status := case when b.status = 'confirmed' and b.paid_amount > 0 then 'confirmed' else 'pending' end;
  v_old := jsonb_build_object('room_type_id', b.room_type_id, 'check_in', b.check_in, 'check_out', b.check_out,
                              'rooms', b.rooms, 'guests', b.guests, 'total', b.total_amount, 'status', b.status);

  update public.bookings set room_type_id = p_room_type, check_in = p_in, check_out = p_out, rooms = p_rooms, guests = p_guests,
         total_amount = v_total, status = v_new_status, modified_count = modified_count + 1, modified_at = now(), updated_at = now(),
         accepted_at = case when v_new_status = 'confirmed' then accepted_at else null end
   where id = b.id;

  perform public._event(b.id, 'modified', 'customer', jsonb_build_object('before', v_old,
    'after', jsonb_build_object('room_type_id', p_room_type, 'check_in', p_in, 'check_out', p_out, 'rooms', p_rooms,
                                'guests', p_guests, 'total', v_total, 'status', v_new_status)));
  perform public._notify('booking_modified', 'Booking ' || b.reference || ' was modified',
    format('%s changed to %s x %s, %s to %s (K%s, was K%s). %s', b.guest_name, p_rooms, rt.name, p_in, p_out, v_total, b.total_amount,
           case when v_new_status = 'pending' then 'Back to pending: accept it again to hold the rooms.' else 'Rooms stay held because it is already paid.' end), b.id);

  return jsonb_build_object('ok', true, 'reference', b.reference, 'status', v_new_status, 'total', v_total,
                            'previous_total', b.total_amount, 'paid', b.paid_amount, 'nights', p_out - p_in, 'room', rt.name);
end $$;

-- a guest can only ASK to cancel; staff confirm it
create or replace function public.request_cancellation(p_reference text, p_code text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype; v_ref text := upper(btrim(coalesce(p_reference,'')));
begin
  if not public._rl('can:ip:' || public._client_ip(), 25, 3600) or not public._rl('can:ref:' || v_ref, 8, 3600) then
    return public._err('rate_limited', 'Too many attempts. Please wait an hour or contact us.');
  end if;
  select bk.* into b from public.bookings bk join public.booking_secrets s on s.booking_id = bk.id
   where bk.reference = v_ref
     and s.access_hash = sha256(convert_to(v_ref || ':' || upper(btrim(coalesce(p_code,''))), 'UTF8'));
  if not found then return public._err('invalid_credentials', 'We could not match that reference and access code.'); end if;
  if b.status not in ('pending','confirmed') or b.check_in < public._today() then
    return public._err('not_modifiable', 'This booking can no longer be cancelled online. Please contact the lodge.');
  end if;
  if b.cancel_requested_at is null then
    update public.bookings set cancel_requested_at = now(), cancel_reason = nullif(public._clean(p_reason, 300), ''), updated_at = now() where id = b.id;
    perform public._event(b.id, 'cancel_requested', 'customer', jsonb_build_object('reason', nullif(public._clean(p_reason, 300), '')));
    perform public._notify('cancellation_requested', 'Cancellation requested for ' || b.reference,
      format('%s asked to cancel %s to %s. Paid so far: K%s.%s', b.guest_name, b.check_in, b.check_out, b.paid_amount,
             coalesce(' Reason: ' || nullif(public._clean(p_reason, 300), ''), '')), b.id);
  end if;
  return jsonb_build_object('ok', true, 'reference', b.reference, 'cancel_requested', true, 'paid', b.paid_amount);
end $$;

create or replace function public.withdraw_cancellation(p_reference text, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype; v_ref text := upper(btrim(coalesce(p_reference,'')));
begin
  if not public._rl('can:ip:' || public._client_ip(), 25, 3600) or not public._rl('can:ref:' || v_ref, 8, 3600) then
    return public._err('rate_limited', 'Too many attempts. Please wait an hour or contact us.');
  end if;
  select bk.* into b from public.bookings bk join public.booking_secrets s on s.booking_id = bk.id
   where bk.reference = v_ref
     and s.access_hash = sha256(convert_to(v_ref || ':' || upper(btrim(coalesce(p_code,''))), 'UTF8'));
  if not found then return public._err('invalid_credentials', 'We could not match that reference and access code.'); end if;
  update public.bookings set cancel_requested_at = null, cancel_reason = null, updated_at = now() where id = b.id and cancel_requested_at is not null;
  perform public._event(b.id, 'cancel_withdrawn', 'customer', '{}'::jsonb);
  return jsonb_build_object('ok', true, 'reference', b.reference);
end $$;

-- start an online payment: the amount and the Lenco reference are created HERE, never by the browser
create or replace function public.start_payment(p_reference text, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype; v_ref text := upper(btrim(coalesce(p_reference,''))); v_bal numeric; v_int text; v_first text;
begin
  if not public._rl('pay:ip:' || public._client_ip(), 25, 3600) or not public._rl('pay:ref:' || v_ref, 12, 3600) then
    return public._err('rate_limited', 'Too many attempts. Please wait an hour or contact us.');
  end if;
  select bk.* into b from public.bookings bk join public.booking_secrets s on s.booking_id = bk.id
   where bk.reference = v_ref
     and s.access_hash = sha256(convert_to(v_ref || ':' || upper(btrim(coalesce(p_code,''))), 'UTF8'))
   for update of bk;
  if not found then return public._err('invalid_credentials', 'We could not match that reference and access code.'); end if;
  if b.status not in ('pending','confirmed','checked_in') or b.cancel_requested_at is not null then
    return public._err('not_payable', 'This booking cannot be paid online right now. Please contact the lodge.'); end if;
  v_bal := b.total_amount - b.paid_amount;
  if v_bal <= 0 then return public._err('nothing_due', 'This booking is already fully paid.'); end if;

  if b.status = 'pending' then
    -- paying takes the rooms, so make sure they are still free before any money moves
    perform 1 from public.room_types where id = b.room_type_id for update;
    if public._available(b.room_type_id, b.check_in, b.check_out, b.id) < b.rooms then
      return public._err('not_available', 'Those rooms are no longer available for these dates. Please change your booking before paying.'); end if;
  end if;

  update public.payment_intents set status = 'expired' where booking_id = b.id and status = 'initiated' and created_at < now() - interval '30 minutes';
  if (select count(*) from public.payment_intents where booking_id = b.id and status = 'initiated') >= 3 then
    return public._err('too_many', 'You already have payments in progress. Please wait a few minutes or contact us.'); end if;

  v_int := 'CLP-' || public._rand_code(10);
  insert into public.payment_intents (reference, booking_id, amount) values (v_int, b.id, v_bal);
  v_first := split_part(b.guest_name, ' ', 1);
  return jsonb_build_object('ok', true, 'reference', v_int, 'amount', v_bal, 'currency', 'ZMW', 'email', b.email,
    'first_name', v_first, 'last_name', nullif(btrim(substr(b.guest_name, char_length(v_first) + 1)), ''),
    'phone', b.phone, 'booking_reference', b.reference);
end $$;

-- =====================================================================
--  PAYMENT RESULT (server only: called by the Supabase Edge Function after it
--  has asked Lenco for the real status. The browser can never call this.)
-- =====================================================================
create or replace function public.edge_rate_limit(p_key text, p_max int, p_secs int)
returns boolean language sql security definer set search_path = '' as $$
  select public._rl(p_key, p_max, p_secs);
$$;

create or replace function public.apply_lenco_result(
  p_reference text, p_lenco_status text, p_amount numeric, p_currency text,
  p_lenco_reference text, p_channel text, p_failure text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  i public.payment_intents%rowtype; b public.bookings%rowtype; v_pay uuid; v_receipt text; v_room text;
  v_taken boolean := false; v_note text; v_paid_at timestamptz;
begin
  select * into i from public.payment_intents where reference = p_reference for update;
  if not found then return public._err('unknown_reference', 'Unknown payment reference.'); end if;
  select * into b from public.bookings where id = i.booking_id for update;
  select name into v_room from public.room_types where id = b.room_type_id;

  -- already processed: behave the same every time (Lenco and browsers may retry)
  if i.status = 'successful' then
    select p.receipt_no, p.created_at into v_receipt, v_paid_at from public.payments p where p.provider_ref = i.reference;
    return jsonb_build_object('ok', true, 'state', 'successful', 'newly_paid', false, 'booking', public._pay_booking(b, v_room),
      'payment', jsonb_build_object('amount', i.amount, 'receipt_no', v_receipt, 'channel', i.channel, 'lenco_reference', i.lenco_reference, 'paid_at', v_paid_at));
  end if;
  if i.status = 'needs_review' then
    return jsonb_build_object('ok', true, 'state', 'needs_review', 'newly_paid', false, 'booking', public._pay_booking(b, v_room));
  end if;

  update public.payment_intents set last_checked_at = now(), lenco_reference = coalesce(p_lenco_reference, lenco_reference),
         channel = coalesce(p_channel, channel) where id = i.id;

  if p_lenco_status in ('pending', 'pay-offline', '3ds-auth-required') then
    update public.payment_intents set status = 'pending' where id = i.id and status in ('initiated', 'expired', 'pending');
    return jsonb_build_object('ok', true, 'state', 'pending', 'newly_paid', false, 'booking', public._pay_booking(b, v_room));
  end if;
  if p_lenco_status <> 'successful' then
    update public.payment_intents set status = 'failed', failure_reason = left(coalesce(p_failure, p_lenco_status), 200), completed_at = now()
     where id = i.id and status <> 'successful';
    return jsonb_build_object('ok', true, 'state', 'failed', 'newly_paid', false, 'message', coalesce(p_failure, 'The payment did not go through.'),
                              'booking', public._pay_booking(b, v_room));
  end if;

  -- ---- Lenco says SUCCESSFUL: check it is really the payment we asked for -----------------
  if p_currency is distinct from i.currency or p_amount is distinct from i.amount then
    v_note := format('Amount/currency mismatch: expected %s %s, Lenco reports %s %s.', i.amount, i.currency, p_amount, p_currency);
  elsif b.status in ('cancelled','declined','no_show','checked_out') then
    v_note := 'Payment received for a booking that is already ' || b.status || '.';
  elsif b.paid_amount + i.amount > b.total_amount then
    v_note := 'Payment would take the booking above its total (already paid K' || b.paid_amount || ').';
  end if;
  if v_note is not null then
    update public.payment_intents set status = 'needs_review', note = v_note, completed_at = now() where id = i.id;
    perform public._event(b.id, 'payment_review', 'system', jsonb_build_object('reference', i.reference, 'note', v_note));
    perform public._notify('payment_review', 'URGENT: check payment for ' || b.reference,
      'Money was received through Lenco but needs your decision (refund or adjust). ' || v_note || ' Payment reference ' || i.reference || '.', b.id);
    return jsonb_build_object('ok', true, 'state', 'needs_review', 'newly_paid', false, 'booking', public._pay_booking(b, v_room));
  end if;

  v_receipt := 'RC-' || public._rand_code(8);
  insert into public.payments (booking_id, amount, method, status, provider, provider_ref, note, receipt_no)
  values (b.id, i.amount, 'online', 'paid', 'lenco', i.reference,
          left('Lenco ' || coalesce(p_lenco_reference, '') || ' ' || coalesce(p_channel, ''), 300), v_receipt)
  returning id, created_at into v_pay, v_paid_at;

  -- paying takes the rooms (if they are still free)
  if b.status = 'pending' then
    perform 1 from public.room_types where id = b.room_type_id for update;
    if public._available(b.room_type_id, b.check_in, b.check_out, b.id) >= b.rooms then
      update public.bookings set status = 'confirmed', accepted_at = now(), updated_at = now() where id = b.id;
      perform public._event(b.id, 'status', 'system', jsonb_build_object('from', 'pending', 'to', 'confirmed', 'why', 'online payment verified'));
      v_taken := true;
    else
      perform public._notify('payment_review', 'URGENT: paid but rooms taken for ' || b.reference,
        'The guest paid online but the rooms are no longer free for these dates. Refund them or move the booking.', b.id);
    end if;
  end if;

  update public.payment_intents set status = 'successful', completed_at = now() where id = i.id;
  perform public._event(b.id, 'payment', 'system', jsonb_build_object('amount', i.amount, 'method', 'online', 'provider', 'lenco',
                        'receipt_no', v_receipt, 'rooms_taken', v_taken));
  perform public._notify('payment_received', 'Online payment received for ' || b.reference,
    format('K%s paid by %s via Lenco (%s). Receipt %s.%s', i.amount, b.guest_name, coalesce(p_channel, 'online'), v_receipt,
           case when v_taken then ' Rooms are now held.' else '' end), b.id);

  select * into b from public.bookings where id = b.id;
  return jsonb_build_object('ok', true, 'state', 'successful', 'newly_paid', true, 'booking', public._pay_booking(b, v_room),
    'payment', jsonb_build_object('amount', i.amount, 'receipt_no', v_receipt, 'channel', p_channel, 'lenco_reference', p_lenco_reference, 'paid_at', v_paid_at));
end $$;

create or replace function public._pay_booking(b public.bookings, p_room text)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('reference', b.reference, 'guest_name', b.guest_name, 'email', b.email, 'phone', b.phone, 'country', b.country,
    'room_type', p_room, 'rooms', b.rooms, 'guests', b.guests, 'check_in', b.check_in, 'check_out', b.check_out,
    'nights', b.check_out - b.check_in, 'status', b.status, 'total', b.total_amount, 'paid', b.paid_amount,
    'balance', greatest(b.total_amount - b.paid_amount, 0), 'payment_pref', b.payment_pref);
$$;

-- =====================================================================
--  ADMIN FUNCTIONS (signed-in admins only)
-- =====================================================================

create or replace function public._require_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
end $$;

create or replace function public.admin_set_status(p_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype; ok boolean; v_room text;
begin
  perform public._require_admin();
  select * into b from public.bookings where id = p_id for update;
  if not found then return public._err('not_found', 'Booking not found.'); end if;
  ok := case b.status
    when 'pending'     then p_status in ('confirmed','declined','cancelled')
    when 'confirmed'   then p_status in ('checked_in','cancelled','no_show','pending')
    when 'checked_in'  then p_status in ('checked_out')
    else false end;
  if not ok then return public._err('bad_transition', format('A %s booking cannot be changed to %s.', b.status, p_status)); end if;

  if p_status = 'confirmed' then          -- ACCEPT: this is the moment the rooms are taken
    select name into v_room from public.room_types where id = b.room_type_id for update;
    if public._available(b.room_type_id, b.check_in, b.check_out, b.id) < b.rooms then
      return public._err('not_available', format('Not enough %s are free for %s to %s. Free up rooms or remove a block before accepting.', v_room, b.check_in, b.check_out));
    end if;
  end if;

  update public.bookings set status = p_status, updated_at = now(),
         accepted_at = case when p_status = 'confirmed' then now() when p_status = 'pending' then null else accepted_at end,
         cancel_requested_at = case when p_status in ('cancelled','declined','no_show') then null else cancel_requested_at end,
         cancel_reason = case when p_status in ('cancelled','declined','no_show') then null else cancel_reason end
   where id = p_id;
  perform public._event(p_id, 'status', 'admin', jsonb_build_object('from', b.status, 'to', p_status, 'by', auth.uid()));
  return jsonb_build_object('ok', true, 'status', p_status);
end $$;

create or replace function public.admin_resolve_cancellation(p_id uuid, p_approve boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype;
begin
  perform public._require_admin();
  select * into b from public.bookings where id = p_id for update;
  if not found then return public._err('not_found', 'Booking not found.'); end if;
  if b.cancel_requested_at is null then return public._err('no_request', 'There is no cancellation request on this booking.'); end if;
  if p_approve then
    if b.status not in ('pending','confirmed') then return public._err('bad_transition', 'This booking can no longer be cancelled here.'); end if;
    update public.bookings set status = 'cancelled', cancel_requested_at = null, cancel_reason = null, updated_at = now() where id = p_id;
    perform public._event(p_id, 'status', 'admin', jsonb_build_object('from', b.status, 'to', 'cancelled', 'why', 'cancellation approved', 'by', auth.uid(), 'paid', b.paid_amount));
  else
    update public.bookings set cancel_requested_at = null, cancel_reason = null, updated_at = now() where id = p_id;
    perform public._event(p_id, 'cancel_rejected', 'admin', jsonb_build_object('by', auth.uid()));
  end if;
  return jsonb_build_object('ok', true, 'approved', p_approve, 'paid', b.paid_amount);
end $$;

create or replace function public.admin_modify_booking(
  p_id uuid, p_room_type uuid, p_in date, p_out date, p_rooms int, p_guests int,
  p_name text, p_email text, p_phone text, p_country text, p_pref text, p_notes text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings%rowtype; rt public.room_types%rowtype; v_msg text; v_total numeric;
  v_name text := public._clean(p_name, 80); v_email text := lower(public._clean(p_email, 254));
  v_phone text := public._clean(p_phone, 30); v_digits text := public._norm_phone(p_phone);
  v_country text := public._clean(p_country, 60);
  v_pref text := case when p_pref in ('cash','bank_transfer','online') then p_pref else 'cash' end;
begin
  perform public._require_admin();
  select * into b from public.bookings where id = p_id for update;
  if not found then return public._err('not_found', 'Booking not found.'); end if;
  if b.status in ('cancelled','declined','no_show','checked_out') then
    return public._err('closed', 'Closed bookings cannot be edited.'); end if;
  if char_length(v_name) < 2 then return public._err('invalid_name', 'Please enter the guest name.'); end if;
  if v_email !~ '^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$' then return public._err('invalid_email', 'Please enter a valid email.'); end if;
  if char_length(v_digits) < 9 then return public._err('invalid_phone', 'Please enter a valid phone number.'); end if;
  if char_length(v_country) < 2 or v_country ~ '[0-9]' then return public._err('invalid_country', 'Please enter the guest country.'); end if;
  if lower(v_country) = 'zambia' then v_country := 'Zambia'; end if;
  select * into rt from public.room_types where id = p_room_type for update;
  if not found then return public._err('invalid_room', 'Unknown room type.'); end if;
  if not (b.status = 'checked_in' and p_in = b.check_in) then
    v_msg := public._check_stay(p_in, p_out, p_rooms, p_guests, rt.max_guests);
  elsif p_out <= p_in then v_msg := 'Check-out must be after check-in.';
  end if;
  if v_msg is not null then return public._err('invalid_stay', v_msg); end if;
  if b.status in ('confirmed','checked_in') and public._available(p_room_type, p_in, p_out, b.id) < p_rooms then
    return public._err('not_available', 'Not enough rooms are free for those dates.'); end if;
  v_total := (p_out - p_in) * p_rooms * rt.price_per_night;
  update public.bookings set room_type_id = p_room_type, check_in = p_in, check_out = p_out, rooms = p_rooms, guests = p_guests,
         guest_name = v_name, email = v_email, phone = v_phone, phone_digits = v_digits, country = v_country, payment_pref = v_pref,
         notes = nullif(public._clean(p_notes, 500), ''), total_amount = v_total, updated_at = now() where id = p_id;
  perform public._event(p_id, 'admin_edit', 'admin', jsonb_build_object('by', auth.uid(), 'room', rt.name, 'check_in', p_in,
                        'check_out', p_out, 'rooms', p_rooms, 'guests', p_guests, 'total', v_total, 'previous_total', b.total_amount));
  return jsonb_build_object('ok', true, 'total', v_total);
end $$;

create or replace function public.admin_create_booking(
  p_room_type uuid, p_in date, p_out date, p_rooms int, p_guests int,
  p_name text, p_email text, p_phone text, p_country text, p_pref text, p_notes text default null, p_status text default 'confirmed'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_res jsonb;
begin
  perform public._require_admin();
  if p_status not in ('pending','confirmed') then return public._err('bad_status', 'New bookings can be pending or confirmed.'); end if;
  v_res := public._insert_booking(p_room_type, p_in, p_out, p_rooms, p_guests, p_name, p_email, p_phone, p_country, p_pref, p_notes, p_status, 'admin');
  if (v_res->>'ok')::boolean then
    perform public._event((v_res->>'id')::uuid, 'created', 'admin', jsonb_build_object('by', auth.uid(), 'total', v_res->'total'));
  end if;
  return v_res - 'id';
end $$;

create or replace function public.admin_record_payment(p_id uuid, p_amount numeric, p_method text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype; v_receipt text := 'RC-' || public._rand_code(8);
begin
  perform public._require_admin();
  select * into b from public.bookings where id = p_id for update;
  if not found then return public._err('not_found', 'Booking not found.'); end if;
  if p_method not in ('cash','mobile_money','card','bank_transfer','online') then return public._err('bad_method', 'Unknown payment method.'); end if;
  if p_amount is null or p_amount <= 0 then return public._err('bad_amount', 'Enter an amount above zero.'); end if;
  if b.paid_amount + p_amount > b.total_amount then
    return public._err('overpay', format('That would exceed the booking total (K%s, already paid K%s).', b.total_amount, b.paid_amount)); end if;
  insert into public.payments (booking_id, amount, method, status, note, recorded_by, receipt_no)
  values (p_id, round(p_amount, 2), p_method, 'paid', nullif(public._clean(p_note, 300), ''), auth.uid(), v_receipt);
  perform public._event(p_id, 'payment', 'admin', jsonb_build_object('amount', p_amount, 'method', p_method, 'by', auth.uid(), 'receipt_no', v_receipt));
  return jsonb_build_object('ok', true, 'receipt_no', v_receipt);
end $$;

create or replace function public.admin_reset_code(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype; v_code text := public._rand_code(8);
begin
  perform public._require_admin();
  select * into b from public.bookings where id = p_id;
  if not found then return public._err('not_found', 'Booking not found.'); end if;
  update public.booking_secrets set access_hash = sha256(convert_to(b.reference || ':' || v_code, 'UTF8')) where booking_id = p_id;
  perform public._event(p_id, 'code_reset', 'admin', jsonb_build_object('by', auth.uid()));
  return jsonb_build_object('ok', true, 'reference', b.reference, 'access_code', v_code);
end $$;

-- permanent delete: only closed bookings that never received money; always logged
create or replace function public.admin_delete_booking(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype;
begin
  perform public._require_admin();
  select * into b from public.bookings where id = p_id for update;
  if not found then return public._err('not_found', 'Booking not found.'); end if;
  if b.status not in ('cancelled','declined','no_show') then
    return public._err('not_closed', 'Only cancelled, declined or no-show bookings can be deleted. Cancel it first.'); end if;
  if exists (select 1 from public.payments where booking_id = b.id) then
    return public._err('has_payments', 'This booking has payments on record, so it is kept for your accounts.'); end if;
  insert into public.audit_log (actor, action, details)
  values (auth.uid(), 'booking_deleted', jsonb_build_object('reference', b.reference, 'guest', b.guest_name, 'check_in', b.check_in, 'check_out', b.check_out, 'total', b.total_amount));
  delete from public.bookings where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_create_block(p_type uuid, p_from date, p_to date, p_rooms int, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare rt public.room_types%rowtype; v_free int; v_id uuid;
begin
  perform public._require_admin();
  if p_from is null or p_to is null or p_to <= p_from then return public._err('bad_dates', 'The end date must be after the start date.'); end if;
  if p_from < public._today() then return public._err('bad_dates', 'A block cannot start in the past.'); end if;
  if p_to - p_from > 366 then return public._err('bad_dates', 'A block can last up to one year.'); end if;
  if p_rooms is null or p_rooms < 1 or p_rooms > 500 then return public._err('bad_rooms', 'Enter how many rooms to block.'); end if;
  select * into rt from public.room_types where id = p_type for update;
  if not found then return public._err('invalid_room', 'Unknown room type.'); end if;
  v_free := public._available(p_type, p_from, p_to);
  if v_free < p_rooms then
    return public._err('not_available', format('Only %s %s free for the whole period. Accepted bookings already hold the rest.', v_free, rt.name)); end if;
  insert into public.room_blocks (room_type_id, date_from, date_to, rooms, reason, created_by)
  values (p_type, p_from, p_to, p_rooms, nullif(public._clean(p_reason, 200), ''), auth.uid()) returning id into v_id;
  insert into public.audit_log (actor, action, details)
  values (auth.uid(), 'room_block_created', jsonb_build_object('room', rt.name, 'from', p_from, 'to', p_to, 'rooms', p_rooms, 'reason', nullif(public._clean(p_reason, 200), '')));
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.admin_remove_block(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare k public.room_blocks%rowtype; v_room text;
begin
  perform public._require_admin();
  select * into k from public.room_blocks where id = p_id;
  if not found then return public._err('not_found', 'Block not found.'); end if;
  select name into v_room from public.room_types where id = k.room_type_id;
  delete from public.room_blocks where id = p_id;
  insert into public.audit_log (actor, action, details)
  values (auth.uid(), 'room_block_removed', jsonb_build_object('room', v_room, 'from', k.date_from, 'to', k.date_to, 'rooms', k.rooms));
  return jsonb_build_object('ok', true);
end $$;


create or replace function public.admin_update_room_type(p_id uuid, p_price numeric, p_total int, p_max_guests int, p_active boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare old public.room_types%rowtype;
begin
  perform public._require_admin();
  if p_price is null or p_price <= 0 or p_price > 100000 then return public._err('bad_price', 'Enter a valid price.'); end if;
  if p_total is null or p_total < 0 or p_total > 500 then return public._err('bad_total', 'Enter a valid number of rooms.'); end if;
  if p_max_guests is null or p_max_guests < 1 or p_max_guests > 12 then return public._err('bad_guests', 'Enter guests per room (1-12).'); end if;
  select * into old from public.room_types where id = p_id for update;
  if not found then return public._err('not_found', 'Room type not found.'); end if;
  update public.room_types set price_per_night = round(p_price, 2), total_rooms = p_total, max_guests = p_max_guests,
         active = coalesce(p_active, active), updated_at = now() where id = p_id;
  insert into public.audit_log (actor, action, details)
  values (auth.uid(), 'room_type_updated', jsonb_build_object('room', old.name,
          'before', jsonb_build_object('price', old.price_per_night, 'total', old.total_rooms, 'max_guests', old.max_guests, 'active', old.active),
          'after',  jsonb_build_object('price', p_price, 'total', p_total, 'max_guests', p_max_guests, 'active', p_active)));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_availability(p_from date, p_days int default 14)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_days jsonb; v_rows jsonb; n int := least(greatest(coalesce(p_days, 14), 1), 31);
begin
  perform public._require_admin();
  select jsonb_agg(d::date order by d) into v_days from generate_series(p_from::timestamp, (p_from + n - 1)::timestamp, interval '1 day') g(d);
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'total', r.total_rooms,
           'free', (select jsonb_agg(public._available(r.id, (p_from + i), (p_from + i + 1)) order by i) from generate_series(0, n - 1) i))
           order by r.sort_order), '[]'::jsonb)
    into v_rows from public.room_types r where r.active;
  return jsonb_build_object('ok', true, 'days', v_days, 'rows', v_rows);
end $$;

create or replace function public.admin_mark_notifications(p_ids bigint[] default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public._require_admin();
  update public.notifications set is_read = true where not is_read and (p_ids is null or id = any(p_ids));
  return jsonb_build_object('ok', true);
end $$;


-- ---------- triggers --------------------------------------------------
create or replace function public._recalc_paid() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := coalesce(new.booking_id, old.booking_id);
begin
  update public.bookings set paid_amount = coalesce((select sum(amount) from public.payments where booking_id = v_id and status = 'paid'), 0),
         updated_at = now() where id = v_id;
  return null;
end $$;
drop trigger if exists payments_recalc on public.payments;
create trigger payments_recalc after insert or update or delete on public.payments
  for each row execute function public._recalc_paid();

-- ---------- row level security policies (admins only) ----------------
do $$
declare t text;
begin
  foreach t in array array['room_types','bookings','payments','booking_events','notifications','audit_log','room_blocks','payment_intents'] loop
    execute format('drop policy if exists "admin read" on public.%I', t);
    execute format('create policy "admin read" on public.%I for select to authenticated using (public.is_admin())', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;
drop policy if exists "own admin row" on public.admins;
create policy "own admin row" on public.admins for select to authenticated using (user_id = auth.uid());
grant select on public.admins to authenticated;
grant usage on schema public to anon, authenticated;

-- ---------- which functions the outside world may call ---------------
-- Postgres gives every NEW function to everyone by default, so lock them all
-- down again now that they all exist, then open only the ones listed below.
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- website visitors (anon key)
grant execute on function public.get_availability(date, date)                                                         to anon, authenticated;
grant execute on function public.create_booking(uuid, date, date, int, int, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.lookup_bookings(text)                                                                to anon, authenticated;
grant execute on function public.get_booking_details(text, text)                                                      to anon, authenticated;
grant execute on function public.modify_booking(text, text, uuid, date, date, int, int)                               to anon, authenticated;
grant execute on function public.request_cancellation(text, text, text)                                               to anon, authenticated;
grant execute on function public.withdraw_cancellation(text, text)                                                    to anon, authenticated;
grant execute on function public.start_payment(text, text)                                                            to anon, authenticated;

-- signed-in staff
grant execute on function public.is_admin()                                                                           to authenticated;
grant execute on function public.admin_set_status(uuid, text)                                                         to authenticated;
grant execute on function public.admin_resolve_cancellation(uuid, boolean)                                            to authenticated;
grant execute on function public.admin_modify_booking(uuid, uuid, date, date, int, int, text, text, text, text, text, text) to authenticated;
grant execute on function public.admin_create_booking(uuid, date, date, int, int, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.admin_record_payment(uuid, numeric, text, text)                                      to authenticated;
grant execute on function public.admin_reset_code(uuid)                                                               to authenticated;
grant execute on function public.admin_delete_booking(uuid)                                                           to authenticated;
grant execute on function public.admin_create_block(uuid, date, date, int, text)                                      to authenticated;
grant execute on function public.admin_remove_block(uuid)                                                             to authenticated;
grant execute on function public.admin_update_room_type(uuid, numeric, int, int, boolean)                             to authenticated;
grant execute on function public.admin_availability(date, int)                                                        to authenticated;
grant execute on function public.admin_mark_notifications(bigint[])                                                   to authenticated;

-- the payment Edge Function only (service_role key, kept secret inside Supabase)
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.apply_lenco_result(text, text, numeric, text, text, text, text) to service_role;
    grant execute on function public.edge_rate_limit(text, int, int)                                  to service_role;
  end if;
end $$;

-- ---------- realtime for the admin dashboard -------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.bookings;      exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
  end if;
end $$;

-- ---------- starting room inventory ----------------------------------
insert into public.room_types (slug, name, description, price_per_night, total_rooms, max_guests, sort_order) values
  ('standard', 'Standard Room', 'Comfortable and relaxing room for your stay.',  600, 48, 2, 1),
  ('deluxe',   'Deluxe Room',   'A step up in space and comfort.',               700, 18, 2, 2),
  ('twin',     'Twin Room',     'Two beds, ideal for friends and colleagues.',    800,  2, 2, 3),
  ('royal',    'Royal Room',    'Our top-tier room for a special stay.',          900,  2, 2, 4)
on conflict (slug) do nothing;

-- ---------- make yourself an admin (run AFTER creating your user) ----
-- 1. Supabase > Authentication > Users > Add user (email + strong password, tick "Auto confirm").
-- 2. Then run, with YOUR email:
--      insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';
