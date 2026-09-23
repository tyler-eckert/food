-- ============================================================================
--  Eckert Haus Kitchen — migration 003: live sync between devices
--  Paste into Supabase → SQL Editor → Run. Safe to re-run.
--  Turns on Supabase Realtime for the app's tables so a recipe added on one
--  device shows up on the others within a second or two. Row Level Security
--  still applies: only allow-listed members receive changes.
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array['recipes','ingredients','steps','pins','ratings','profiles','families'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1;
