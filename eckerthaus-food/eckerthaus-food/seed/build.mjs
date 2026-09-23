// node seed/build.mjs → supabase/seed_recipes.sql (migration + idempotent seed of the family recipe book)
import { readFileSync, writeFileSync } from "node:fs";
import { RECIPES } from "./recipes.mjs";
import { parseIngredientBlock, parseStepBlock } from "../js/parse.js";

export function toRow(r) {
  const prep = r.prep ?? null, cook = r.cook ?? null;
  return {
    title: r.title, course: r.course || "", cuisine: r.cuisine || "", protein: r.protein || "", difficulty: r.difficulty || "",
    prep_min: prep, cook_min: cook, total_min: r.total ?? (prep || cook ? (prep || 0) + (cook || 0) : null),
    servings: r.servings || "", tags: [...new Set(r.tags || [])], notes: r.notes || "", credit: r.credit || "",
    ingredients: parseIngredientBlock(r.ingredients), steps: parseStepBlock(r.steps),
  };
}

if (process.argv[1].endsWith("build.mjs")) {
  const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  const saveFn = schema.match(/create or replace function public\.save_recipe[\s\S]*?\n\$\$;\n/)[0];
  const rows = RECIPES.map(toRow);
  const body = rows.map((r, i) => {
    const j = JSON.stringify({ ...r, order: i });
    if (j.includes("$r$")) throw new Error("bad quote in " + r.title);
    return `select pg_temp.seed_recipe($r$${j}$r$::jsonb);`;
  }).join("\n");

  const sql = `-- ============================================================================
--  Eckert Haus Kitchen — migration 002 + family recipe book (${rows.length} recipes)
--  Paste into Supabase → SQL Editor → Run. Safe to re-run: recipes whose title
--  already exists are skipped.
-- ============================================================================

-- 1) New column: who shared the recipe ("Jen Sorrels", "Grandma Great"…)
alter table public.recipes add column if not exists credit text;

-- 2) save_recipe() now also saves credit
${saveFn}
-- 3) Seed helper (temporary — disappears when this session ends)
create or replace function pg_temp.seed_recipe(p jsonb)
returns void language plpgsql as $$
declare
  rid uuid;
  owner uuid := (select id from auth.users where email = 'teckert@novoog.com' limit 1);
begin
  if exists (select 1 from public.recipes where lower(title) = lower(p ->> 'title')) then
    raise notice 'skip (exists): %', p ->> 'title';
    return;
  end if;

  insert into public.recipes (title, course, cuisine, protein, difficulty, prep_min, cook_min, total_min,
                              servings, tags, notes, credit, created_by, created_at, updated_at)
  values (p ->> 'title', nullif(p ->> 'course', ''), nullif(p ->> 'cuisine', ''), nullif(p ->> 'protein', ''),
          nullif(p ->> 'difficulty', ''), (p ->> 'prep_min')::int, (p ->> 'cook_min')::int, (p ->> 'total_min')::int,
          nullif(p ->> 'servings', ''),
          coalesce((select array_agg(v) from jsonb_array_elements_text(p -> 'tags') v), '{}'),
          nullif(p ->> 'notes', ''), nullif(p ->> 'credit', ''), owner,
          now() - make_interval(mins => (p ->> 'order')::int), now())
  returning id into rid;

  insert into public.ingredients (recipe_id, position, section, quantity, unit, name, note, raw)
  select rid, (t.ord - 1)::int, nullif(t.x ->> 'section', ''), nullif(t.x ->> 'quantity', ''),
         nullif(t.x ->> 'unit', ''), t.x ->> 'name', nullif(t.x ->> 'note', ''), t.x ->> 'raw'
  from jsonb_array_elements(p -> 'ingredients') with ordinality t(x, ord);

  insert into public.steps (recipe_id, position, section, body)
  select rid, (t.ord - 1)::int, nullif(t.x ->> 'section', ''), t.x ->> 'body'
  from jsonb_array_elements(p -> 'steps') with ordinality t(x, ord);

  update public.recipes set ingredient_names =
    (select string_agg(lower(name), ' · ' order by position) from public.ingredients where recipe_id = rid)
  where id = rid;
end;
$$;

-- 4) The recipes
${body}

select count(*) as recipes_in_database from public.recipes;
`;
  writeFileSync(new URL("../supabase/seed_recipes.sql", import.meta.url), sql);
  writeFileSync(new URL("./recipes.json", import.meta.url), JSON.stringify(rows));
  console.log(`wrote ${rows.length} recipes, ${rows.reduce((a, r) => a + r.ingredients.length, 0)} ingredients, ${rows.reduce((a, r) => a + r.steps.length, 0)} steps`);
}
