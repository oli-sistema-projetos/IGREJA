create table public.services (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  scheduled_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.reception_entries (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  category text not null check (category in ('Louvor', 'Testemunho', 'Pregação', 'Aviso', 'Visitante', 'Outro')),
  name text not null,
  detail text not null default '',
  youtube_url text not null default '',
  created_at timestamptz not null default now()
);

create table public.service_items (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  category text not null check (category in ('Louvor', 'Testemunho', 'Pregação', 'Aviso', 'Visitante', 'Outro')),
  title text not null,
  detail text not null default '',
  youtube_url text not null default '',
  position integer not null default 0,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index services_scheduled_at_idx on public.services (scheduled_at desc);
create index reception_entries_service_id_created_at_idx on public.reception_entries (service_id, created_at desc);
create index service_items_service_id_position_idx on public.service_items (service_id, position);

alter table public.services enable row level security;
alter table public.reception_entries enable row level security;
alter table public.service_items enable row level security;

create policy "Public access for services"
  on public.services for all to anon, authenticated
  using (true) with check (true);

create policy "Public access for reception entries"
  on public.reception_entries for all to anon, authenticated
  using (true) with check (true);

create policy "Public access for service items"
  on public.service_items for all to anon, authenticated
  using (true) with check (true);

grant select, insert, update, delete on public.services to anon, authenticated;
grant select, insert, update, delete on public.reception_entries to anon, authenticated;
grant select, insert, update, delete on public.service_items to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'services'
  ) then
    alter publication supabase_realtime add table public.services;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reception_entries'
  ) then
    alter publication supabase_realtime add table public.reception_entries;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'service_items'
  ) then
    alter publication supabase_realtime add table public.service_items;
  end if;
end
$$;
