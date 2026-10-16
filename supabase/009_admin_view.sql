-- ============================================================================
--  Eckert Haus Kitchen — migration 009: admins can "view as" another family
--  Paste into Supabase → SQL Editor → Run. Safe to re-run.
--  Needs 004 (my_family_id) and 007 (is_admin) first. Run 008 (bar) first too
--  if you want the wine vault covered by read-only mode.
--
--  How it works: every family-scoped RLS policy already calls my_family_id().
--  We keep the original as my_home_family_id(), and make my_family_id() return
--  the family an admin is currently viewing (if any). Read-only mode adds
--  RESTRICTIVE policies that block every insert/update/delete while viewing.
-- ============================================================================

do $$
begin
  if to_regprocedure('public.my_family_id()') is null then
    raise exception 'Run the family-isolation migration (004) first — my_family_id() is missing';
  end if;
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'Run the admin migration (007) first — is_admin() is missing';
  end if;
  -- is_admin() must not depend on my_family_id(), or the override would loop.
  if pg_get_functiondef('public.is_admin()'::regprocedure) ilike '%my_family_id%' then
    raise exception 'is_admin() references my_family_id() — send this error to Claude so the override can be adjusted';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Which family an admin is looking at (one row per admin, only while viewing)
-- ---------------------------------------------------------------------------
create table if not exists public.admin_view (
  user_id     uuid primary key references auth.users on delete cascade default auth.uid(),
  family_id   uuid not null references public.families on delete cascade,
  can_edit    boolean not null default false,
  started_at  timestamptz not null default now()
);
alter table public.admin_view enable row level security;
drop policy if exists "own row read" on public.admin_view;
create policy "own row read" on public.admin_view for select to authenticated using (user_id = auth.uid());
-- (writes only through admin_view_start / admin_view_stop below)

-- ---------------------------------------------------------------------------
-- 2. Keep the original my_family_id() as my_home_family_id() (copied verbatim,
--    once), then make my_family_id() honor the admin override.
-- ---------------------------------------------------------------------------
do $$
declare def text;
begin
  if to_regprocedure('public.my_home_family_id()') is null then
    def := pg_get_functiondef('public.my_family_id()'::regprocedure);
    if position('public.my_family_id()' in def) = 0 then
      raise exception 'Unexpected my_family_id() definition — send this error to Claude';
    end if;
    execute replace(def, 'public.my_family_id()', 'public.my_home_family_id()');
  end if;
end $$;
grant execute on function public.my_home_family_id() to authenticated;

create or replace function public.my_family_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select v.family_id from public.admin_view v where v.user_id = auth.uid() and public.is_admin()),
    public.my_home_family_id()
  );
$$;
grant execute on function public.my_family_id() to authenticated;

-- True while an admin is viewing another family read-only.
create or replace function public.admin_readonly()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_view v where v.user_id = auth.uid() and not v.can_edit);
$$;
grant execute on function public.admin_readonly() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Read-only enforcement: RESTRICTIVE policies are AND-ed with the normal ones,
--    so while admin_readonly() is true nothing can be written — even via RPCs
--    like save_recipe() and drink_wine() that run as the caller.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['recipes', 'ingredients', 'steps', 'pins', 'ratings', 'grocery_items',
                           'wines', 'wine_log', 'wine_pairings'] loop
    continue when to_regclass('public.' || t) is null;   -- e.g. 008 not run yet
    execute format('drop policy if exists "admin read-only insert" on public.%I', t);
    execute format('drop policy if exists "admin read-only update" on public.%I', t);
    execute format('drop policy if exists "admin read-only delete" on public.%I', t);
    execute format('create policy "admin read-only insert" on public.%I as restrictive for insert to authenticated with check (not public.admin_readonly())', t);
    execute format('create policy "admin read-only update" on public.%I as restrictive for update to authenticated using (not public.admin_readonly())', t);
    execute format('create policy "admin read-only delete" on public.%I as restrictive for delete to authenticated using (not public.admin_readonly())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Start / stop / status
-- ---------------------------------------------------------------------------
create or replace function public.admin_view_start(p_family uuid, p_edit boolean default false)
returns json
language plpgsql security definer
set search_path = public
as $$
declare f record;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  select id, name, color into f from public.families where id = p_family;
  if not found then raise exception 'Family not found'; end if;

  if p_family = public.my_home_family_id() then          -- "viewing" your own family = stop
    delete from public.admin_view where user_id = auth.uid();
    return null;
  end if;

  insert into public.admin_view (user_id, family_id, can_edit, started_at)
  values (auth.uid(), p_family, coalesce(p_edit, false), now())
  on conflict (user_id) do update set family_id = excluded.family_id, can_edit = excluded.can_edit, started_at = now();
  return json_build_object('family_id', f.id, 'name', f.name, 'color', f.color, 'can_edit', coalesce(p_edit, false));
end;
$$;
grant execute on function public.admin_view_start(uuid, boolean) to authenticated;

create or replace function public.admin_view_stop()
returns void
language sql security definer
set search_path = public
as $$
  delete from public.admin_view where user_id = auth.uid();
$$;
grant execute on function public.admin_view_stop() to authenticated;

create or replace function public.admin_view_status()
returns json
language sql stable security definer
set search_path = public
as $$
  select json_build_object('family_id', f.id, 'name', f.name, 'color', f.color, 'can_edit', v.can_edit, 'started_at', v.started_at)
  from public.admin_view v join public.families f on f.id = v.family_id
  where v.user_id = auth.uid() and public.is_admin();
$$;
grant execute on function public.admin_view_status() to authenticated;

select 'Admin view-as ready 👀' as status;
