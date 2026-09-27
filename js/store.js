// Data layer. Same interface for Supabase and an in-memory demo (used when config.js isn't filled in).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";

const LIST_COLS = "id,title,description,image_url,source_url,course,cuisine,protein,difficulty,prep_min,cook_min,total_min,servings,tags,ingredient_names,notes,credit,created_by,created_at,updated_at";
export const isDemo = !SUPABASE_URL || SUPABASE_URL.includes("YOUR-") || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes("YOUR-");

// ---------------------------------------------------------------- Supabase
async function supabaseStore() {
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, detectSessionInUrl: true } });
  const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  let user = null;

  return {
    mode: "supabase",
    async session() {
      const { data } = await sb.auth.getSession();
      user = data.session?.user ?? null;
      return data.session;
    },
    onAuth(cb) { sb.auth.onAuthStateChange((event, s) => { user = s?.user ?? null; cb(s, event); }); },
    async signIn(email, password) { ok(await sb.auth.signInWithPassword({ email, password })); },
    async resetPassword(email) { ok(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })); },
    async updatePassword(password) { ok(await sb.auth.updateUser({ password })); },
    async signOut() { await sb.auth.signOut(); },
    async isMember() { return ok(await sb.rpc("is_member")) === true; },
    async me() {
      const p = ok(await sb.from("profiles").select("*").eq("id", user.id).maybeSingle());
      return { id: user.id, email: user.email, display_name: p?.display_name ?? "", family_id: p?.family_id ?? null };
    },
    async loadAll() {
      // Paged fetch so we get everything even past the 1,000-row API cap.
      const all = async (table, cols, order) => {
        const out = [];
        for (let from = 0; ; from += 1000) {
          const rows = ok(await sb.from(table).select(cols).order(order).range(from, from + 999));
          out.push(...rows);
          if (rows.length < 1000) return out;
        }
      };
      const [recipes, ingredients, steps, pins, ratings, profiles, families, grocery] = await Promise.all([
        all("recipes", LIST_COLS, "created_at"),
        all("ingredients", "recipe_id,position,section,quantity,unit,name,note,raw", "position"),
        all("steps", "recipe_id,position,section,body", "position"),
        sb.from("pins").select("recipe_id,created_at").eq("user_id", user.id).then(ok),
        all("ratings", "user_id,recipe_id,score", "recipe_id"),
        sb.from("profiles").select("id,display_name,family_id").then(ok),
        sb.from("families").select("*").order("name").then(ok),
        all("grocery_items", "id,name,quantity,unit,note,recipe_id,recipe_title,source,checked,position,created_at", "created_at"),
      ]);
      return { recipes, ingredients, steps, pins: new Map(pins.map((p) => [p.recipe_id, p.created_at])), ratings, profiles, families, grocery };
    },
    async getRecipe(id) {
      const [r, ing, st] = await Promise.all([
        sb.from("recipes").select("*").eq("id", id).single().then(ok),
        sb.from("ingredients").select("*").eq("recipe_id", id).order("position").then(ok),
        sb.from("steps").select("*").eq("recipe_id", id).order("position").then(ok),
      ]);
      return { ...r, ingredients: ing, steps: st };
    },
    async saveRecipe(payload) { return ok(await sb.rpc("save_recipe", { p: payload })); },
    async deleteRecipe(id) { ok(await sb.from("recipes").delete().eq("id", id)); },
    async setPin(id, on) {
      if (on) ok(await sb.from("pins").upsert({ recipe_id: id, user_id: user.id }));
      else ok(await sb.from("pins").delete().eq("recipe_id", id).eq("user_id", user.id));
    },
    async setRating(id, score) {
      if (score) ok(await sb.from("ratings").upsert({ recipe_id: id, user_id: user.id, score, updated_at: new Date().toISOString() }));
      else ok(await sb.from("ratings").delete().eq("recipe_id", id).eq("user_id", user.id));
    },
    async updateProfile(patch) { ok(await sb.from("profiles").update(patch).eq("id", user.id)); },
    async addGroceryItems(items) {
      if (!items.length) return;
      ok(await sb.from("grocery_items").insert(items.map((it) => ({
        name: it.name, quantity: it.quantity || null, unit: it.unit || null, note: it.note || null,
        recipe_id: it.recipe_id || null, recipe_title: it.recipe_title || null,
        source: it.source || "recipe", position: it.position || 0,
      }))));
    },
    async addGroceryItem(name) { ok(await sb.from("grocery_items").insert({ name, source: "manual" })); },
    async setGroceryChecked(id, checked) { ok(await sb.from("grocery_items").update({ checked }).eq("id", id)); },
    async deleteGroceryItem(id) { ok(await sb.from("grocery_items").delete().eq("id", id)); },
    async deleteGroceryItems(ids) { if (ids.length) ok(await sb.from("grocery_items").delete().in("id", ids)); },
    async uploadImage(file) {
      const blob = await shrinkImage(file);
      const path = `${user.id}/${Date.now()}.jpg`;
      ok(await sb.storage.from("recipe-images").upload(path, blob, { contentType: "image/jpeg", upsert: false }));
      return sb.storage.from("recipe-images").getPublicUrl(path).data.publicUrl;
    },
    /** Live updates: calls onChange whenever any shared table changes (needs Realtime enabled — see 003_realtime.sql). */
    subscribe(onChange) {
      const ch = sb.channel("kitchen-sync");
      for (const table of ["recipes", "ingredients", "steps", "pins", "ratings", "profiles", "families", "grocery_items"])
        ch.on("postgres_changes", { event: "*", schema: "public", table }, () => onChange(table));
      ch.subscribe();
      return () => sb.removeChannel(ch);
    },
    async importUrl(url) {
      const { data, error } = await sb.functions.invoke("import-recipe", { body: { url } });
      if (error) {
        let msg = error.message;
        if (error.name === "FunctionsFetchError" || /failed to send/i.test(msg)) msg = "Link import isn't reachable — the import-recipe function may not be deployed yet. Use “Paste recipe text” for now.";
        else if (error.context?.status === 404) msg = "Link import isn't set up yet (import-recipe function not found).";
        else try { msg = (await error.context.json()).error || msg; } catch { /* keep generic */ }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      return data.recipe;
    },
    async importPhoto(file) {
      const blob = await shrinkImage(file, 1200);
      const image = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result).split(",")[1]);
        fr.onerror = () => rej(new Error("Couldn't read that photo"));
        fr.readAsDataURL(blob);
      });
      const { data, error } = await sb.functions.invoke("import-recipe-photo", { body: { image, media_type: "image/jpeg" } });
      if (error) {
        let msg = error.message;
        if (error.name === "FunctionsFetchError" || /failed to send/i.test(msg)) msg = "Photo import isn't reachable — the import-recipe-photo function may not be deployed yet.";
        else if (error.context?.status === 404) msg = "Photo import isn't set up yet (import-recipe-photo function not found).";
        else try { msg = (await error.context.json()).error || msg; } catch { /* keep generic */ }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      return data.recipe;
    },
  };
}

// Resize photos client-side so uploads are fast on mobile data.
async function shrinkImage(file, max = 1600) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob(res, "image/jpeg", 0.85));
}

// ---------------------------------------------------------------- Demo
function demoStore() {
  const uid = () => crypto.randomUUID?.() ?? String(Math.random()).slice(2);
  const fam = [
    { id: "f1", name: "Eckert", color: "#FFB997" },
    { id: "f2", name: "Grandma & Grandpa", color: "#9ED9C3" },
  ];
  const people = [
    { id: "me", display_name: "Tyler", family_id: "f1" },
    { id: "u2", display_name: "Sarah", family_id: "f1" },
    { id: "u3", display_name: "Nana", family_id: "f2" },
    { id: "u4", display_name: "Pop", family_id: "f2" },
  ];
  let recipes = null;
  async function ensure() {
    if (recipes) return;
    const rows = await (await fetch(new URL("../seed/recipes.json", import.meta.url))).json();
    const now = Date.now();
    recipes = rows.map((r, i) => ({ ...r, id: "r" + i, created_by: "me", created_at: new Date(now - i * 6e4).toISOString(),
      ingredients: r.ingredients.map((x, j) => ({ ...x, position: j })), steps: r.steps.map((x, j) => ({ ...x, position: j })) }));
    const id = (t) => recipes.find((r) => r.title === t)?.id;
    for (const [t, d] of [["Korean Beef Bowls", 1], ["White Bean Chicken Chili", 2], ["Pumpkin Bread", 3]]) if (id(t)) pins.set(id(t), new Date(now - d * 864e5).toISOString());
    for (const [u, t, s] of [["me", "Crockpot French Dip Sandwiches", 5], ["u2", "Crockpot French Dip Sandwiches", 5], ["u3", "Crockpot French Dip Sandwiches", 4],
      ["me", "Korean Beef Bowls", 5], ["u2", "Korean Beef Bowls", 4], ["u3", "Ooey Gooey Butter Cake", 5], ["u4", "Ooey Gooey Butter Cake", 5], ["me", "Ooey Gooey Butter Cake", 5],
      ["u2", "Taco Soup", 5], ["u4", "Taco Soup", 4], ["me", "Chicken Pot Pie", 4], ["u3", "Pumpkin Bread", 5], ["me", "Peanut Butter Pie", 5], ["u2", "Egg Roll in a Bowl", 3]])
      if (id(t)) ratings.push({ user_id: u, recipe_id: id(t), score: s });
  }
  const pins = new Map();
  const ratings = [];
  let grocery = [];
  const listRow = ({ ingredients, steps, ...r }) => ({ ...r, ingredient_names: ingredients.map((i) => i.name.toLowerCase()).join(" · ") });
  const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));

  return {
    mode: "demo",
    subscribe() { return () => {}; },
    async session() { return { user: { id: "me" } }; },
    onAuth() {},
    async signIn() {}, async resetPassword() {}, async updatePassword() {}, async signOut() { location.reload(); },
    async isMember() { return true; },
    async me() { const p = people[0]; return { id: "me", email: "demo@eckerthaus.com", ...p }; },
    async loadAll() {
      await ensure();
      return { ingredients: recipes.flatMap((r) => r.ingredients.map((i) => ({ ...i, recipe_id: r.id }))),
        steps: recipes.flatMap((r) => r.steps.map((x) => ({ ...x, recipe_id: r.id }))),
        recipes: recipes.map(listRow).sort((a, b) => b.created_at.localeCompare(a.created_at)), pins: new Map(pins), ratings: ratings.map((r) => ({ ...r })), profiles: people.map((p) => ({ ...p })), families: fam.map((f) => ({ ...f })), grocery: grocery.map((g) => ({ ...g })) };
    },
    async getRecipe(id) { await ensure(); return structuredClone(recipes.find((r) => r.id === id)); },
    async saveRecipe(p) {
      await wait();
      const tags = [...new Set((p.tags || []).map((t) => t.toLowerCase().trim()).filter(Boolean))];
      const clean = { ...p, tags, ingredients: p.ingredients.map((x, i) => ({ ...x, position: i })), steps: p.steps.map((x, i) => ({ ...x, position: i })) };
      for (const k of ["prep_min", "cook_min", "total_min"]) clean[k] = clean[k] === "" || clean[k] == null ? null : +clean[k];
      const i = recipes.findIndex((r) => r.id === p.id);
      if (i >= 0) { recipes[i] = { ...recipes[i], ...clean, updated_at: new Date().toISOString() }; return p.id; }
      const id = uid(); recipes.push({ ...clean, id, created_by: "me", created_at: new Date().toISOString() }); return id;
    },
    async deleteRecipe(id) { const i = recipes.findIndex((r) => r.id === id); if (i >= 0) recipes.splice(i, 1); },
    async setPin(id, on) { on ? pins.set(id, new Date().toISOString()) : pins.delete(id); },
    async setRating(id, score) {
      const i = ratings.findIndex((r) => r.user_id === "me" && r.recipe_id === id);
      if (i >= 0) ratings.splice(i, 1);
      if (score) ratings.push({ user_id: "me", recipe_id: id, score });
    },
    async updateProfile(patch) { Object.assign(people[0], patch); },
    async addGroceryItems(items) {
      await wait(60);
      const now = Date.now();
      grocery.push(...items.map((it, i) => ({ id: uid(), name: it.name, quantity: it.quantity || null, unit: it.unit || null, note: it.note || null,
        recipe_id: it.recipe_id || null, recipe_title: it.recipe_title || null, source: it.source || "recipe", position: it.position || 0,
        checked: false, created_at: new Date(now + i).toISOString() })));
    },
    async addGroceryItem(name) {
      await wait(60);
      grocery.push({ id: uid(), name, quantity: null, unit: null, note: null, recipe_id: null, recipe_title: null, source: "manual", position: 0, checked: false, created_at: new Date().toISOString() });
    },
    async setGroceryChecked(id, checked) { const it = grocery.find((g) => g.id === id); if (it) it.checked = checked; },
    async deleteGroceryItem(id) { grocery = grocery.filter((g) => g.id !== id); },
    async deleteGroceryItems(ids) { grocery = grocery.filter((g) => !ids.includes(g.id)); },
    async uploadImage(file) { return new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(file); }); },
    async importUrl() {
      await wait(500);
      throw new Error("Link import runs through Supabase — connect config.js to turn it on. Meanwhile, paste the recipe text below.");
    },
    async importPhoto() {
      await wait(500);
      throw new Error("Photo import runs through Supabase — connect config.js to turn it on. Meanwhile, type in what you can read from the photo.");
    },
  };
}

export async function createStore() { return isDemo ? demoStore() : supabaseStore(); }
