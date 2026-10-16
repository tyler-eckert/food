-- ============================================================================
--  Eckert Haus Kitchen — migration 008: the Bar (cocktails + wine vault)
--  Paste into Supabase → SQL Editor → Run. Safe to re-run.
--  Needs 004 (family isolation / my_family_id()) to have been run first.
-- ============================================================================

do $$
begin
  if to_regprocedure('public.my_family_id()') is null then
    raise exception 'Run the family-isolation migration (004) before 008_bar.sql — my_family_id() is missing';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Cocktails reuse the recipes table — just a few drink-only columns.
--    (The app saves these right after save_recipe(), so save_recipe is untouched.)
-- ---------------------------------------------------------------------------
alter table public.recipes
  add column if not exists spirit  text,   -- Bourbon, Gin, Tequila, None (mocktail)…
  add column if not exists method  text,   -- Shaken, Stirred, Built, Blended
  add column if not exists glass   text,   -- Coupe, Rocks, Highball…
  add column if not exists garnish text;   -- Orange peel, Luxardo cherry…

-- ---------------------------------------------------------------------------
-- 2. Wine vault — one row per wine (producer + vintage + size), with a bottle count.
-- ---------------------------------------------------------------------------
create table if not exists public.wines (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null default public.my_family_id() references public.families on delete cascade,
  name            text not null,                 -- "Napa Valley Cabernet Sauvignon"
  producer        text,                          -- "Caymus"
  vintage         int  check (vintage between 1800 and 2200),   -- null = NV
  wine_type       text,                          -- Red, White, Rosé, Sparkling, Dessert, Fortified, Orange
  varietal        text,                          -- Cabernet Sauvignon, Red blend…
  region          text,                          -- Napa Valley
  country         text,                          -- USA
  size            text default '750 ml',
  quantity        int  not null default 1 check (quantity >= 0),
  location        text,                          -- Basement cellar, Kitchen fridge…
  zone            text,                          -- Rack B
  slot            text,                          -- Row 3, bin 4
  drink_from      int  check (drink_from between 1800 and 2300),
  drink_by        int  check (drink_by   between 1800 and 2300),
  price           numeric(10,2) check (price >= 0),   -- paid per bottle
  value           numeric(10,2) check (value >= 0),   -- current value per bottle (optional)
  purchased_from  text,
  purchased_on    date,
  pairing_notes   text,
  notes           text,                          -- tasting notes
  image_url       text,
  created_by      uuid references auth.users on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists wines_family_idx on public.wines (family_id);

-- Every bottle opened: when, how many, the occasion.
create table if not exists public.wine_log (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null default public.my_family_id() references public.families on delete cascade,
  wine_id     uuid not null references public.wines on delete cascade,
  bottles     int  not null default 1 check (bottles > 0),
  occasion    text,
  note        text,
  user_id     uuid references auth.users on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists wine_log_wine_idx on public.wine_log (wine_id, created_at desc);

-- Wine ↔ recipe pairings (shows on both the wine and the recipe).
create table if not exists public.wine_pairings (
  family_id   uuid not null default public.my_family_id() references public.families on delete cascade,
  wine_id     uuid not null references public.wines on delete cascade,
  recipe_id   uuid not null references public.recipes on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (wine_id, recipe_id)
);
create index if not exists wine_pairings_recipe_idx on public.wine_pairings (recipe_id);

-- ---------------------------------------------------------------------------
-- 3. Row Level Security — each family sees only its own vault.
-- ---------------------------------------------------------------------------
alter table public.wines         enable row level security;
alter table public.wine_log      enable row level security;
alter table public.wine_pairings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['wines', 'wine_log'] loop
    execute format('drop policy if exists "family access" on public.%I', t);
    execute format(
      'create policy "family access" on public.%I for all to authenticated
         using (public.is_member() and family_id = public.my_family_id())
         with check (public.is_member() and family_id = public.my_family_id())', t);
  end loop;
end $$;

-- Pairings: same family rule, and the recipe must be one this family can see.
drop policy if exists "family access" on public.wine_pairings;
create policy "family access" on public.wine_pairings for all to authenticated
  using (public.is_member() and family_id = public.my_family_id())
  with check (public.is_member() and family_id = public.my_family_id()
              and exists (select 1 from public.recipes r where r.id = recipe_id)
              and exists (select 1 from public.wines w where w.id = wine_id));

-- ---------------------------------------------------------------------------
-- 4. drink_wine() — take bottle(s) out of the vault and log it, atomically.
-- ---------------------------------------------------------------------------
create or replace function public.drink_wine(p_wine uuid, p_count int default 1,
                                             p_occasion text default null, p_note text default null)
returns int
language plpgsql security invoker
set search_path = public
as $$
declare v_left int;
begin
  if not public.is_member() then
    raise exception 'Not an allowed member' using errcode = '42501';
  end if;
  if coalesce(p_count, 0) < 1 then
    raise exception 'Pick at least one bottle';
  end if;

  update wines set quantity = quantity - p_count, updated_at = now()
   where id = p_wine and quantity >= p_count
  returning quantity into v_left;
  if not found then
    raise exception 'Not enough bottles left in the vault';
  end if;

  insert into wine_log (wine_id, bottles, occasion, note)
  values (p_wine, p_count, nullif(trim(p_occasion), ''), nullif(trim(p_note), ''));
  return v_left;
end;
$$;
grant execute on function public.drink_wine(uuid, int, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Live sync across devices
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['wines', 'wine_log', 'wine_pairings'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

select 'Bar ready 🍷' as status;
