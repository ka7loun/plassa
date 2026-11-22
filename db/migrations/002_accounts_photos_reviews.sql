-- 002: real accounts (phone + password), one account can both book and rent
-- out spots, spot photos, host-chosen payment methods, reviews and ranking.

-- Roles: everyone is a 'user' (books and/or rents out); 'admin' is the city view.
alter table users drop constraint if exists users_role_check;
update users set role = 'user' where role in ('driver', 'host');
alter table users add constraint users_role_check check (role in ('user', 'admin'));
alter table users alter column role set default 'user';
alter table users add column if not exists password_hash text;
create unique index if not exists users_phone_key on users (phone) where phone is not null;

-- Photos: URLs (seeded stock photos under /spots/*.jpg, or /api/photos/<id> for uploads).
alter table spots add column if not exists photos text[] not null default '{}';
alter table spots add constraint spots_photos_max check (cardinality(photos) <= 6);

-- The host decides which payment methods drivers see for this spot.
alter table spots add column if not exists payment_methods text[] not null default '{cash,d17,flouci,card}';
alter table spots add constraint spots_payment_methods_check
  check (cardinality(payment_methods) >= 1 and payment_methods <@ array['cash', 'd17', 'flouci', 'card']::text[]);

-- Denormalised rating, updated in the same transaction as each review.
alter table spots add column if not exists rating_sum integer not null default 0;
alter table spots add column if not exists rating_count integer not null default 0;

-- Uploaded photos, resized in the browser before upload (about 100-300 KB each).
create table if not exists photos (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references users(id),
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  data         bytea not null check (octet_length(data) <= 1500000),
  created_at   timestamptz not null default now()
);
create index if not exists photos_owner_idx on photos (owner_id, created_at desc);

-- One review per booking, only by the driver, only after the stay.
create table if not exists reviews (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null unique references bookings(id),
  spot_id     uuid not null references spots(id),
  driver_id   uuid not null references users(id),
  rating      smallint not null check (rating between 1 and 5),
  comment     text not null default '' check (length(comment) <= 300),
  created_at  timestamptz not null default now()
);
create index if not exists reviews_spot_idx on reviews (spot_id, created_at desc);
create index if not exists reviews_driver_idx on reviews (driver_id);

-- Small key/value table; holds the demo seed version so deploys know when to reseed.
create table if not exists app_meta (
  key   text primary key,
  value text not null
);
