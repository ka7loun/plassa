-- Plassa schema. Plain PostgreSQL + standard contrib extensions only,
-- so it runs on Neon, Supabase, RDS, a CI container or embedded Postgres.

create extension if not exists pgcrypto;      -- gen_random_uuid()
create extension if not exists btree_gist;    -- "=" inside a GiST exclusion constraint
create extension if not exists cube;
create extension if not exists earthdistance; -- indexed radius search on lat/lng

create table if not exists cities (
  id          text primary key,             -- 'sousse', 'monastir'
  name_fr     text not null,
  name_ar     text not null,
  name_en     text not null,
  center_lat  double precision not null,
  center_lng  double precision not null,
  default_zoom real not null default 14,
  currency    text not null default 'TND'
);

create table if not exists zones (
  id          text primary key,             -- 'sousse-medina'
  city_id     text not null references cities(id),
  name_fr     text not null,
  name_ar     text not null,
  name_en     text not null,
  center_lat  double precision not null,
  center_lng  double precision not null
);

create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  role        text not null check (role in ('driver', 'host', 'admin')),
  name        text not null,
  phone       text,
  created_at  timestamptz not null default now()
);

create table if not exists spots (
  id               uuid primary key default gen_random_uuid(),
  host_id          uuid not null references users(id),
  city_id          text not null references cities(id),
  zone_id          text references zones(id),
  title            text not null,
  description      text not null default '',
  address          text not null default '',
  lat              double precision not null check (lat between -90 and 90),
  lng              double precision not null check (lng between -180 and 180),
  spot_type        text not null default 'garage'
                   check (spot_type in ('garage', 'courtyard', 'driveway', 'lot', 'basement')),
  covered          boolean not null default false,
  private_attested boolean not null default true,  -- host attests it is private land (no fourriere)
  gardien_name     text,
  gardien_phone    text,
  photo_url        text,
  -- price per hour in millimes (1 TND = 1000 millimes)
  price_millimes   integer not null check (price_millimes between 100 and 100000),
  -- optional peak pricing window (Tunis local hours, [start, end)) and months (1-12)
  peak_multiplier  numeric(3,2) not null default 1.00 check (peak_multiplier between 1 and 2),
  peak_start_hour  smallint check (peak_start_hour between 0 and 23),
  peak_end_hour    smallint check (peak_end_hour between 1 and 24),
  peak_months      smallint[] not null default '{}',
  -- weekly availability: days 0=Sun..6=Sat, daily window in minutes from 00:00 local
  avail_days       smallint[] not null default '{0,1,2,3,4,5,6}',
  avail_start_min  smallint not null default 0 check (avail_start_min between 0 and 1439),
  avail_end_min    smallint not null default 1440 check (avail_end_min between 1 and 1440),
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  check (avail_end_min > avail_start_min)
);

-- Radius search: earth_box(...) @> ll_to_earth(lat,lng) uses this GiST index.
create index if not exists spots_earth_gist on spots using gist (ll_to_earth(lat, lng));
create index if not exists spots_host_idx on spots (host_id);
create index if not exists spots_city_idx on spots (city_id) where active;

create table if not exists bookings (
  id                  uuid primary key default gen_random_uuid(),
  spot_id             uuid not null references spots(id),
  driver_id           uuid not null references users(id),
  start_at            timestamptz not null,
  end_at              timestamptz not null,
  status              text not null
                      check (status in ('pending_payment', 'confirmed', 'checked_in', 'cancelled', 'expired')),
  amount_millimes     integer not null check (amount_millimes >= 0),
  commission_millimes integer not null check (commission_millimes >= 0),
  payment_method      text not null check (payment_method in ('cash', 'd17', 'flouci', 'card')),
  payment_ref         text,
  checkin_code        char(4) not null,
  plate               text,
  created_at          timestamptz not null default now(),
  cancelled_at        timestamptz,
  check (end_at > start_at),
  -- The core guarantee: two live bookings of the same spot can never overlap,
  -- even under concurrent requests. Enforced by Postgres, not by app code.
  constraint bookings_no_overlap exclude using gist (
    spot_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  ) where (status in ('pending_payment', 'confirmed', 'checked_in'))
);

create index if not exists bookings_driver_idx on bookings (driver_id, start_at desc);
create index if not exists bookings_spot_idx on bookings (spot_id, start_at);

-- Anonymous demand signal (where drivers search), for the city view.
create table if not exists search_events (
  id          bigserial primary key,
  city_id     text not null,
  zone_id     text,
  lat         double precision not null,
  lng         double precision not null,
  results     integer not null,
  available   integer not null,
  created_at  timestamptz not null default now()
);
create index if not exists search_events_city_time on search_events (city_id, created_at desc);

create table if not exists schema_migrations (
  name        text primary key,
  applied_at  timestamptz not null default now()
);
