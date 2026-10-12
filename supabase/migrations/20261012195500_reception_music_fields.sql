alter table public.reception_entries
  add column performer text not null default '',
  add column accompaniment text;

alter table public.reception_entries
  add constraint reception_entries_accompaniment_check
  check (accompaniment is null or accompaniment in ('band', 'youtube'));
