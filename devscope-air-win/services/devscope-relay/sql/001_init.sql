create table if not exists relay_users (
    id text primary key,
    created_at timestamptz not null default now()
);

create table if not exists relay_devices (
    id text primary key,
    owner_id text not null references relay_users(id) on delete cascade,
    label text not null,
    platform text not null,
    public_key text not null,
    fingerprint text not null,
    linked_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    revoked_at timestamptz null
);

create index if not exists idx_relay_devices_owner_active
    on relay_devices(owner_id, last_seen_at desc)
    where revoked_at is null;

create table if not exists relay_pairings (
    id text primary key,
    owner_id text not null references relay_users(id) on delete cascade,
    desktop_device_id text not null,
    desktop_public_key text not null,
    mobile_device_id text null,
    mobile_public_key text null,
    confirmation_code text not null,
    one_time_token text not null,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null,
    claimed_at timestamptz null,
    approved_at timestamptz null,
    denied_at timestamptz null
);

create index if not exists idx_relay_pairings_owner_created
    on relay_pairings(owner_id, created_at desc);
