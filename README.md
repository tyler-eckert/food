# 🍑 Eckert Haus Kitchen — food.eckerthaus.com

A mobile-first family recipe box. It's static HTML/JS on **GitHub Pages**, with **Supabase** handling the database, sign-in, photo storage, and link import.

**Features:** pin recipes · 1–5 heart ratings rolled up by family · link import (schema.org Recipe data) · paste-the-whole-recipe text import · free-typed ingredient parsing (qty / unit / name / note, sections) · serving scaler (½× – 3×) · collapsible faceted filters (course, cuisine, protein, difficulty, time, tags, family favorites) · cook mode (keeps the screen awake) · photo upload · Add to Home Screen.

With `config.js` left as-is, the app runs in **demo mode** with sample recipes, so you can try it before setting anything up.

```
index.html              UI and styles
js/app.js               app logic (views, filters, editor, routing)
js/store.js             data layer (Supabase + in-memory demo)
js/parse.js             ingredient/step/text parsers + quantity scaling
config.js               ← your Supabase URL + anon key
supabase/schema.sql     tables, RLS, save_recipe(), storage bucket
supabase/seed_recipes.sql  migration 002 + the family recipe book
seed/                   recipe source (recipes.mjs) → build.mjs → SQL + demo JSON
supabase/functions/import-recipe/   edge function for link import
CNAME                   food.eckerthaus.com
```

---

## 1 · Supabase (about 10 minutes)

1. Create a project at [supabase.com](https://supabase.com). The free tier is plenty.
2. **SQL Editor → New query**: paste all of `supabase/schema.sql`. First edit the **EDIT ME** block at the bottom with every email that should have access and your family names. Then run it.
   To add someone later: `insert into allowed_emails values ('grandma@example.com');`
3. **Authentication → URL Configuration**
   - Site URL: `https://food.eckerthaus.com`
   - Redirect URLs: add `https://food.eckerthaus.com` and `http://localhost:8000` (for local testing)
4. **Create the household login** (one shared account = one profile, shared pins and hearts):
   - **Authentication → Users → Add user → Create new user**: enter the email and password, and tick **Auto Confirm User**.
   - Make sure that email is in `allowed_emails`: `insert into allowed_emails values ('you@example.com') on conflict do nothing;`
   - Recommended: **Authentication → Sign In / Providers → Email**, turn off **Allow new users to sign up**, since accounts are only created from the dashboard.
   - Forgot the password? Use **Forgot password?** on the sign-in screen. The reset email links back to the Site URL above.
5. **Project Settings → API**: copy the Project URL and the `anon` public key into `config.js`.

> The anon key is meant to be public. Security comes from Row Level Security: only emails in `allowed_emails` can read or write anything. Anyone else who signs in sees an empty app and a "not on the family list" message.

### Load the family recipe book (83 recipes)

In **SQL Editor → New query**, paste all of `supabase/seed_recipes.sql` and click **Run**. It:

1. adds a `credit` column ("From Jen Sorrels", "Grandma Great"…) and updates `save_recipe()` to save it
2. inserts every recipe with sectioned ingredients (Crust / Filling, Sauce, For serving…) and one step per line

It's safe to re-run: any recipe whose title already exists is skipped. To edit the source list, change `seed/recipes.mjs` and run `node seed/build.mjs` to regenerate the SQL.

### Link-import function

This needs the [Supabase CLI](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase` or `npm i -g supabase`):

```bash
supabase login
supabase link --project-ref <your-project-ref>     # ref is the xxxx in https://xxxx.supabase.co
supabase functions deploy import-recipe
```

The function fetches the page server-side (browsers block this due to CORS), reads its schema.org `Recipe` JSON-LD, and returns the title, photo, times, servings, ingredients, steps, cuisine, course, and keywords. Nearly every major recipe site and WordPress recipe plugin publishes that data. If a site blocks it, the app falls back to "Paste recipe text".

## 2 · GitHub Pages

```bash
cd eckerthaus-food
git init && git add . && git commit -m "Eckert Haus Kitchen"
git branch -M main
git remote add origin https://github.com/<you>/eckerthaus-food.git
git push -u origin main
```

Then go to **Settings → Pages** → Source: *Deploy from a branch* → `main` / `(root)`. The custom domain comes from `CNAME` automatically. Tick **Enforce HTTPS** once the certificate is issued (up to about 15 minutes).

## 3 · DNS for eckerthaus.com

At your DNS host, add:

| Type  | Name | Value               |
|-------|------|---------------------|
| CNAME | food | `<you>.github.io`   |

## 4 · Try it locally

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

(A server is needed because ES modules don't load from `file://`.)

---

### Data model

- **recipes**: the header table and filterable metadata (course, cuisine, protein, difficulty, prep/cook/total min, servings, tags[], source_url, image_url, notes). `ingredient_names` is kept in sync for search.
- **ingredients**: position, section, quantity, unit, name, note, raw line
- **steps**: position, section, body
- **pins**: per person · **ratings**: per person, 1–5
- **profiles**: display name and family · **families**: name and color
- **allowed_emails**: access list

`save_recipe(jsonb)` writes the header, ingredients, and steps in one transaction.

To add a new filterable field (for example "Season"): add a column in SQL, add it to `save_recipe()` and `LIST_COLS` in `store.js`, add an input in the editor, and add one line to `GROUPS` in `app.js`.
