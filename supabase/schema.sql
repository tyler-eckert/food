-- ============================================================================
--  Eckert Haus Kitchen  ·  food.eckerthaus.com
--  Supabase schema: run once in the Supabase SQL Editor (Dashboard → SQL).
--  Safe to re-run: everything is "if not exists" / "create or replace".
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Allowlist — only emails listed here can read or write anything.
--    Magic-link sign-in is open, but data access is gated by is_member().
-- ---------------------------------------------------------------------------
create table if not exists public.allowed_emails (
  email     text primary key check (email = lower(email)),
  added_at  timestamptz not null default now()
);
alter table public.allowed_emails enable row level security;   -- no policies: dashboard/SQL only

create or replace function public.is_member()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.allowed_emails
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.is_member() to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 2. Families & profiles
-- ---------------------------------------------------------------------------
create table if not exists public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  color       text not null default '#FFB997',
  created_at  timestamptz not null default now()
);

create table if not exists public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  display_name  text,
  family_id     uuid references public.families on delete set null,
  created_at    timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, initcap(split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. Recipes (header table + tracked metadata), ingredients, steps
-- ---------------------------------------------------------------------------
create table if not exists public.recipes (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  source_url   text,
  image_url    text,
  course       text,            -- Breakfast, Dinner, Dessert …
  cuisine      text,            -- Italian, Mexican …
  protein      text,            -- Chicken, Beef, Vegetarian …
  difficulty   text check (difficulty in ('Easy', 'Medium', 'Hard')),
  prep_min     int  check (prep_min  >= 0),
  cook_min     int  check (cook_min  >= 0),
  total_min    int  check (total_min >= 0),
  servings     text,
  tags         text[] not null default '{}',
  notes        text,
  created_by   uuid references auth.users on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.recipes add column if not exists ingredient_names text;  -- kept in sync by save_recipe() for search
alter table public.recipes add column if not exists credit text;            -- who shared it ("Grandma Great")
create index if not exists recipes_created_at_idx on public.recipes (created_at desc);
create index if not exists recipes_tags_idx       on public.recipes using gin (tags);

create table if not exists public.ingredients (
  id         uuid primary key default gen_random_uuid(),
  recipe_id  uuid not null references public.recipes on delete cascade,
  position   int  not null default 0,
  section    text,              -- "For the sauce"
  quantity   text,              -- "1 1/2"
  unit       text,              -- "cup"
  name       text not null,     -- "all-purpose flour"
  note       text,              -- "sifted"
  raw        text               -- original line as typed/pasted
);
create index if not exists ingredients_recipe_idx on public.ingredients (recipe_id, position);

create table if not exists public.steps (
  id         uuid primary key default gen_random_uuid(),
  recipe_id  uuid not null references public.recipes on delete cascade,
  position   int  not null default 0,
  section    text,
  body       text not null
);
create index if not exists steps_recipe_idx on public.steps (recipe_id, position);

-- ---------------------------------------------------------------------------
-- 4. Pins (per person) and ratings (1–5 hearts per person)
-- ---------------------------------------------------------------------------
create table if not exists public.pins (
  user_id     uuid not null references auth.users on delete cascade default auth.uid(),
  recipe_id   uuid not null references public.recipes on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

create table if not exists public.ratings (
  user_id     uuid not null references auth.users on delete cascade default auth.uid(),
  recipe_id   uuid not null references public.recipes on delete cascade,
  score       smallint not null check (score between 1 and 5),
  updated_at  timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.families    enable row level security;
alter table public.profiles    enable row level security;
alter table public.recipes     enable row level security;
alter table public.ingredients enable row level security;
alter table public.steps       enable row level security;
alter table public.pins        enable row level security;
alter table public.ratings     enable row level security;

do $$
declare t text;
begin
  -- Shared tables: any allow-listed member can read & edit
  foreach t in array array['families', 'recipes', 'ingredients', 'steps'] loop
    execute format('drop policy if exists "members full access" on public.%I', t);
    execute format(
      'create policy "members full access" on public.%I for all to authenticated
         using (public.is_member()) with check (public.is_member())', t);
  end loop;

  -- Personal tables: everyone can see, only you can change your own rows
  foreach t in array array['pins', 'ratings'] loop
    execute format('drop policy if exists "members read" on public.%I', t);
    execute format('drop policy if exists "own rows write" on public.%I', t);
    execute format(
      'create policy "members read" on public.%I for select to authenticated
         using (public.is_member())', t);
    execute format(
      'create policy "own rows write" on public.%I for all to authenticated
         using (public.is_member() and user_id = auth.uid())
         with check (public.is_member() and user_id = auth.uid())', t);
  end loop;
end $$;

drop policy if exists "members read"      on public.profiles;
drop policy if exists "own profile write" on public.profiles;
create policy "members read" on public.profiles
  for select to authenticated using (public.is_member());
create policy "own profile write" on public.profiles
  for update to authenticated
  using (public.is_member() and id = auth.uid())
  with check (public.is_member() and id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6. save_recipe(payload) — saves header + ingredients + steps atomically
-- ---------------------------------------------------------------------------
create or replace function public.save_recipe(p jsonb)
returns uuid
language plpgsql security invoker
set search_path = public
as $$
declare
  rid  uuid := nullif(p ->> 'id', '')::uuid;
  tgs  text[] := coalesce(
          (select array_agg(distinct lower(trim(v))) from jsonb_array_elements_text(coalesce(p -> 'tags', '[]'::jsonb)) v
            where trim(v) <> ''), '{}');
begin
  if not public.is_member() then
    raise exception 'Not an allowed member' using errcode = '42501';
  end if;
  if coalesce(trim(p ->> 'title'), '') = '' then
    raise exception 'Title is required';
  end if;

  if rid is null then
    insert into recipes (title, description, source_url, image_url, course, cuisine, protein,
                         difficulty, prep_min, cook_min, total_min, servings, tags, notes, credit)
    values (trim(p ->> 'title'), nullif(p ->> 'description', ''), nullif(p ->> 'source_url', ''),
            nullif(p ->> 'image_url', ''), nullif(p ->> 'course', ''), nullif(p ->> 'cuisine', ''),
            nullif(p ->> 'protein', ''), nullif(p ->> 'difficulty', ''),
            nullif(p ->> 'prep_min', '')::int, nullif(p ->> 'cook_min', '')::int,
            nullif(p ->> 'total_min', '')::int, nullif(p ->> 'servings', ''), tgs,
            nullif(p ->> 'notes', ''), nullif(p ->> 'credit', ''))
    returning id into rid;
  else
    update recipes set
      title = trim(p ->> 'title'),            description = nullif(p ->> 'description', ''),
      source_url = nullif(p ->> 'source_url', ''), image_url = nullif(p ->> 'image_url', ''),
      course = nullif(p ->> 'course', ''),    cuisine = nullif(p ->> 'cuisine', ''),
      protein = nullif(p ->> 'protein', ''),  difficulty = nullif(p ->> 'difficulty', ''),
      prep_min = nullif(p ->> 'prep_min', '')::int, cook_min = nullif(p ->> 'cook_min', '')::int,
      total_min = nullif(p ->> 'total_min', '')::int, servings = nullif(p ->> 'servings', ''),
      tags = tgs, notes = nullif(p ->> 'notes', ''), credit = nullif(p ->> 'credit', ''), updated_at = now()
    where id = rid;
    if not found then raise exception 'Recipe % not found', rid; end if;
  end if;

  delete from ingredients where recipe_id = rid;
  insert into ingredients (recipe_id, position, section, quantity, unit, name, note, raw)
  select rid, (t.ord - 1)::int, nullif(t.x ->> 'section', ''), nullif(t.x ->> 'quantity', ''),
         nullif(t.x ->> 'unit', ''), t.x ->> 'name', nullif(t.x ->> 'note', ''), nullif(t.x ->> 'raw', '')
  from jsonb_array_elements(coalesce(p -> 'ingredients', '[]'::jsonb)) with ordinality as t(x, ord)
  where coalesce(trim(t.x ->> 'name'), '') <> '';

  update recipes set ingredient_names =
    (select string_agg(lower(name), ' · ' order by position) from ingredients where recipe_id = rid)
  where id = rid;

  delete from steps where recipe_id = rid;
  insert into steps (recipe_id, position, section, body)
  select rid, (t.ord - 1)::int, nullif(t.x ->> 'section', ''), t.x ->> 'body'
  from jsonb_array_elements(coalesce(p -> 'steps', '[]'::jsonb)) with ordinality as t(x, ord)
  where coalesce(trim(t.x ->> 'body'), '') <> '';

  return rid;
end;
$$;
grant execute on function public.save_recipe(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Photo storage (public read, members write)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

drop policy if exists "members upload recipe images" on storage.objects;
drop policy if exists "members update recipe images" on storage.objects;
drop policy if exists "members delete recipe images" on storage.objects;
create policy "members upload recipe images" on storage.objects
  for insert to authenticated with check (bucket_id = 'recipe-images' and public.is_member());
create policy "members update recipe images" on storage.objects
  for update to authenticated using (bucket_id = 'recipe-images' and public.is_member());
create policy "members delete recipe images" on storage.objects
  for delete to authenticated using (bucket_id = 'recipe-images' and public.is_member());

-- ============================================================================
--  EDIT ME — add your family, then run just this part (or the whole file).
-- ============================================================================
insert into public.allowed_emails (email) values
  ('teckert@novoog.com')          -- ← replace / add everyone who should have access
on conflict do nothing;

insert into public.families (name, color) values
  ('Eckert', '#FFB997')           -- ← add more families, e.g. ('Grandma & Grandpa', '#9ED9C3')
on conflict (name) do nothing;
