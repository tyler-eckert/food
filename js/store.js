// Data layer. Same interface for Supabase and an in-memory demo (used when config.js isn't filled in).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";

const LIST_COLS = "id,title,description,image_url,source_url,course,cuisine,protein,difficulty,prep_min,cook_min,total_min,servings,tags,ingredient_names,notes,credit,created_by,created_at,updated_at";
const DRINK_COLS = ",spirit,method,glass,garnish"; // added by 008_bar.sql
const WINE_COLS = ["name", "producer", "vintage", "wine_type", "varietal", "region", "country", "size", "quantity", "location", "zone", "slot",
  "drink_from", "drink_by", "price", "value", "purchased_from", "purchased_on", "pairing_notes", "notes", "image_url"];
/** Editor object → clean DB row (blank strings → null, numbers parsed). */
export function wineRow(w) {
  const out = {};
  for (const k of WINE_COLS) {
    let v = w[k];
    if (typeof v === "string") v = v.trim();
    if (v === "" || v === undefined) v = null;
    if (v != null && ["vintage", "quantity", "drink_from", "drink_by"].includes(k)) v = parseInt(v, 10);
    if (v != null && ["price", "value"].includes(k)) v = Math.round(parseFloat(String(v).replace(/[$,]/g, "")) * 100) / 100;
    if (typeof v === "number" && Number.isNaN(v)) v = null;
    out[k] = v;
  }
  out.quantity = Math.max(0, out.quantity ?? 0);
  out.name = out.name || "";
  return out;
}
export const isDemo = !SUPABASE_URL || SUPABASE_URL.includes("YOUR-") || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes("YOUR-");

// ---------------------------------------------------------------- Supabase
async function supabaseStore() {
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, detectSessionInUrl: true } });
  const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  let user = null, barReady = false;
  const adminCall = async (body) => {
    const { data, error } = await sb.functions.invoke("admin-users", { body });
    if (error) {
      let msg = error.message;
      if (error.name === "FunctionsFetchError" || /failed to send/i.test(msg)) msg = "The admin-users function isn't reachable — has it been deployed yet?";
      else if (error.context?.status === 404) msg = "The admin-users function isn't deployed yet (see the setup guide).";
      else try { msg = (await error.context.json()).error || msg; } catch { /* keep generic */ }
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };

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
      // Bar tables come from 008_bar.sql — if it hasn't been run yet, the rest of the app still loads.
      const recipesQ = all("recipes", LIST_COLS + DRINK_COLS, "created_at").then((r) => { barReady = true; return r; },
        () => { barReady = false; return all("recipes", LIST_COLS, "created_at"); });
      const opt = (p) => p.catch(() => null);
      const [recipes, ingredients, steps, pins, ratings, profiles, families, grocery, wines, wineLog, pairings] = await Promise.all([
        recipesQ,
        all("ingredients", "recipe_id,position,section,quantity,unit,name,note,raw", "position"),
        all("steps", "recipe_id,position,section,body", "position"),
        sb.from("pins").select("recipe_id,created_at").eq("user_id", user.id).then(ok),
        all("ratings", "user_id,recipe_id,score", "recipe_id"),
        sb.from("profiles").select("id,display_name,family_id").then(ok),
        sb.from("families").select("*").order("name").then(ok),
        all("grocery_items", "id,name,quantity,unit,note,recipe_id,recipe_title,source,checked,position,created_at", "created_at"),
        opt(all("wines", "*", "created_at")),
        opt(all("wine_log", "id,wine_id,bottles,occasion,note,user_id,created_at", "created_at")),
        opt(all("wine_pairings", "wine_id,recipe_id", "created_at")),
      ]);
      const bar = barReady && wines !== null;
      return { recipes, ingredients, steps, pins: new Map(pins.map((p) => [p.recipe_id, p.created_at])), ratings, profiles, families, grocery,
        barReady: bar, wines: wines || [], wineLog: wineLog || [], pairings: pairings || [] };
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
    async saveDrinkFields(id, f) {
      ok(await sb.from("recipes").update({ spirit: f.spirit || null, method: f.method || null, glass: f.glass || null, garnish: f.garnish || null }).eq("id", id));
    },
    async saveWine(w, recipeIds) {
      const row = { ...wineRow(w), updated_at: new Date().toISOString() };
      const id = w.id
        ? (ok(await sb.from("wines").update(row).eq("id", w.id)), w.id)
        : ok(await sb.from("wines").insert(row).select("id").single()).id;
      if (recipeIds) {
        ok(await sb.from("wine_pairings").delete().eq("wine_id", id));
        if (recipeIds.length) ok(await sb.from("wine_pairings").insert(recipeIds.map((rid) => ({ wine_id: id, recipe_id: rid }))));
      }
      return id;
    },
    async setWineQty(id, quantity) { ok(await sb.from("wines").update({ quantity, updated_at: new Date().toISOString() }).eq("id", id)); },
    async deleteWine(id) { ok(await sb.from("wines").delete().eq("id", id)); },
    async drinkWine(id, count, occasion, note) { return ok(await sb.rpc("drink_wine", { p_wine: id, p_count: count, p_occasion: occasion, p_note: note })); },
    async deleteWineLog(id) { ok(await sb.from("wine_log").delete().eq("id", id)); },
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
    async isAdmin() { try { return ok(await sb.rpc("is_admin")) === true; } catch { return false; } },
    async adminList() { return (await adminCall({ action: "list" })).families; },
    // "View as family" (009_admin_view.sql) — returns { family_id, name, color, can_edit } or null
    async viewStatus() { try { return ok(await sb.rpc("admin_view_status")) || null; } catch { return null; } },
    async viewStart(familyId, edit) { return ok(await sb.rpc("admin_view_start", { p_family: familyId, p_edit: !!edit })) || null; },
    async viewStop() { ok(await sb.rpc("admin_view_stop")); },
    async adminCreateUser(payload) { return adminCall({ action: "create", ...payload }); },
    async shareTargets() { return ok(await sb.rpc("share_targets")) || []; },
    async shareRecipe(id, familyId) { return ok(await sb.rpc("share_recipe", { p_recipe: id, p_family: familyId })); },
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
      // Separate channel so a missing 008 table can't break recipe sync.
      const bar = sb.channel("bar-sync");
      for (const table of ["wines", "wine_log", "wine_pairings"])
        bar.on("postgres_changes", { event: "*", schema: "public", table }, () => onChange(table));
      bar.subscribe();
      return () => { sb.removeChannel(ch); sb.removeChannel(bar); };
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
const DEMO_COCKTAILS = [
  { title: "Old Fashioned", course: "Cocktail", spirit: "Bourbon", method: "Stirred", glass: "Rocks", garnish: "Orange peel & Luxardo cherry", servings: "1", tags: ["classic"],
    ingredients: [["2", "oz", "bourbon"], ["1/4", "oz", "simple syrup"], ["2", "dash", "Angostura bitters"]], steps: ["Stir everything with ice until well chilled.", "Strain over a large cube.", "Express the orange peel over the top and garnish."] },
  { title: "Margarita", course: "Cocktail", spirit: "Tequila", method: "Shaken", glass: "Coupe", garnish: "Lime wheel, salted rim", servings: "1", tags: ["classic", "summer"],
    ingredients: [["2", "oz", "blanco tequila"], ["1", "oz", "fresh lime juice"], ["3/4", "oz", "Cointreau"], ["1/4", "oz", "agave syrup"]], steps: ["Salt half the rim of the glass.", "Shake everything hard with ice.", "Strain into the glass and garnish."] },
  { title: "Espresso Martini", course: "Cocktail", spirit: "Vodka", method: "Shaken", glass: "Coupe", garnish: "3 coffee beans", servings: "1", tags: ["after dinner"],
    ingredients: [["2", "oz", "vodka"], ["1", "oz", "fresh espresso, cooled"], ["1/2", "oz", "coffee liqueur"], ["1/4", "oz", "simple syrup"]], steps: ["Shake very hard with ice for a good foam.", "Double-strain into a chilled coupe.", "Float the coffee beans on top."] },
  { title: "Sparkling Cranberry Mule", course: "Mocktail", spirit: "None (mocktail)", method: "Built", glass: "Copper mug", garnish: "Rosemary sprig & cranberries", servings: "1", tags: ["kid friendly", "holiday"],
    ingredients: [["4", "oz", "ginger beer"], ["2", "oz", "cranberry juice"], ["1/2", "oz", "lime juice"]], steps: ["Fill the mug with ice.", "Add the juices, then top with ginger beer.", "Garnish and serve."] },
].map((c) => ({ ...c, cuisine: "", protein: "", difficulty: "Easy", prep_min: 5, cook_min: null, total_min: 5, notes: "", credit: "",
  ingredients: c.ingredients.map(([quantity, unit, name]) => ({ quantity, unit, name, note: "", section: "", raw: `${quantity} ${unit} ${name}` })),
  steps: c.steps.map((body) => ({ body, section: "" })) }));

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
    const rows = [...await (await fetch(new URL("../seed/recipes.json", import.meta.url))).json(), ...DEMO_COCKTAILS];
    const now = Date.now();
    recipes = rows.map((r, i) => ({ ...r, id: "r" + i, created_by: "me", created_at: new Date(now - i * 6e4).toISOString(),
      ingredients: r.ingredients.map((x, j) => ({ ...x, position: j })), steps: r.steps.map((x, j) => ({ ...x, position: j })) }));
    const id = (t) => recipes.find((r) => r.title === t)?.id;
    for (const [t, d] of [["Korean Beef Bowls", 1], ["White Bean Chicken Chili", 2], ["Pumpkin Bread", 3]]) if (id(t)) pins.set(id(t), new Date(now - d * 864e5).toISOString());
    for (const [u, t, s] of [["me", "Crockpot French Dip Sandwiches", 5], ["u2", "Crockpot French Dip Sandwiches", 5], ["u3", "Crockpot French Dip Sandwiches", 4],
      ["me", "Korean Beef Bowls", 5], ["u2", "Korean Beef Bowls", 4], ["u3", "Ooey Gooey Butter Cake", 5], ["u4", "Ooey Gooey Butter Cake", 5], ["me", "Ooey Gooey Butter Cake", 5],
      ["u2", "Taco Soup", 5], ["u4", "Taco Soup", 4], ["me", "Chicken Pot Pie", 4], ["u3", "Pumpkin Bread", 5], ["me", "Peanut Butter Pie", 5], ["u2", "Egg Roll in a Bowl", 3]])
      if (id(t)) ratings.push({ user_id: u, recipe_id: id(t), score: s });
    const y = new Date().getFullYear();
    const W = (o) => ({ id: uid(), size: "750 ml", quantity: 1, created_at: new Date(now - wines.length * 864e5).toISOString(), ...o });
    wines.push(
      W({ name: "Napa Valley Cabernet Sauvignon", producer: "Caymus", vintage: y - 4, wine_type: "Red", varietal: "Cabernet Sauvignon", region: "Napa Valley", country: "USA", quantity: 3, location: "Basement cellar", zone: "Rack A", slot: "Row 2", drink_from: y - 1, drink_by: y + 8, price: 95, value: 110, purchased_from: "Total Wine", pairing_notes: "Steak, braised short ribs, aged cheddar" }),
      W({ name: "Brut Champagne", producer: "Veuve Clicquot", wine_type: "Sparkling", varietal: "Champagne blend", region: "Champagne", country: "France", quantity: 2, location: "Kitchen wine fridge", zone: "Top shelf", price: 62, pairing_notes: "Celebrations, fried chicken, popcorn" }),
      W({ name: "Sancerre", producer: "Domaine Vacheron", vintage: y - 2, wine_type: "White", varietal: "Sauvignon Blanc", region: "Loire Valley", country: "France", quantity: 4, location: "Kitchen wine fridge", zone: "Middle shelf", drink_from: y - 2, drink_by: y + 1, price: 38, pairing_notes: "Goat cheese, salads, white fish" }),
      W({ name: "Barolo", producer: "G.D. Vajra", vintage: y - 7, wine_type: "Red", varietal: "Nebbiolo", region: "Piedmont", country: "Italy", quantity: 2, location: "Basement cellar", zone: "Rack B", slot: "Row 1", drink_from: y + 2, drink_by: y + 15, price: 58, value: 75 }),
      W({ name: "Whispering Angel", producer: "Château d'Esclans", vintage: y - 1, wine_type: "Rosé", varietal: "Grenache blend", region: "Provence", country: "France", quantity: 1, location: "Kitchen wine fridge", zone: "Bottom shelf", drink_by: y, price: 24 }),
      W({ name: "Ruby Port", producer: "Graham's", wine_type: "Fortified", varietal: "Port", region: "Douro", country: "Portugal", quantity: 0, location: "Dining room cabinet", price: 22, pairing_notes: "Chocolate desserts, blue cheese" }),
    );
    for (const [t, w] of [["Crockpot French Dip Sandwiches", 0], ["Korean Beef Bowls", 0], ["Ooey Gooey Butter Cake", 5]]) if (id(t)) pairings.push({ wine_id: wines[w].id, recipe_id: id(t) });
    wineLog.push({ id: uid(), wine_id: wines[0].id, bottles: 1, occasion: "Anniversary dinner", note: "", user_id: "me", created_at: new Date(now - 20 * 864e5).toISOString() },
      { id: uid(), wine_id: wines[5].id, bottles: 1, occasion: "Christmas", note: "Finished it with the pecan pie", user_id: "u2", created_at: new Date(now - 60 * 864e5).toISOString() });
  }
  const wines = [], wineLog = [], pairings = [];
  const pins = new Map();
  const ratings = [];
  let demoView = null;
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
        recipes: recipes.map(listRow).sort((a, b) => b.created_at.localeCompare(a.created_at)), pins: new Map(pins), ratings: ratings.map((r) => ({ ...r })), profiles: people.map((p) => ({ ...p })), families: fam.map((f) => ({ ...f })), grocery: grocery.map((g) => ({ ...g })),
        barReady: true, wines: structuredClone(wines), wineLog: structuredClone(wineLog), pairings: pairings.map((p) => ({ ...p })) };
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
    async saveDrinkFields(id, f) { const r = recipes.find((x) => x.id === id); if (r) Object.assign(r, { spirit: f.spirit || null, method: f.method || null, glass: f.glass || null, garnish: f.garnish || null }); },
    async saveWine(w, recipeIds) {
      await wait();
      const row = wineRow(w);
      let id = w.id;
      if (id) Object.assign(wines.find((x) => x.id === id), row, { updated_at: new Date().toISOString() });
      else { id = uid(); wines.push({ ...row, id, created_at: new Date().toISOString() }); }
      if (recipeIds) { for (let i = pairings.length - 1; i >= 0; i--) if (pairings[i].wine_id === id) pairings.splice(i, 1); pairings.push(...recipeIds.map((rid) => ({ wine_id: id, recipe_id: rid }))); }
      return id;
    },
    async setWineQty(id, q) { const w = wines.find((x) => x.id === id); if (w) w.quantity = q; },
    async deleteWine(id) { const i = wines.findIndex((x) => x.id === id); if (i >= 0) wines.splice(i, 1); },
    async drinkWine(id, count, occasion, note) {
      await wait();
      const w = wines.find((x) => x.id === id);
      if (!w || w.quantity < count) throw new Error("Not enough bottles left in the vault");
      w.quantity -= count;
      wineLog.push({ id: uid(), wine_id: id, bottles: count, occasion: occasion || null, note: note || null, user_id: "me", created_at: new Date().toISOString() });
      return w.quantity;
    },
    async deleteWineLog(id) { const i = wineLog.findIndex((x) => x.id === id); if (i >= 0) wineLog.splice(i, 1); },
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
    // Demo: add ?demo-admin to the URL to try the admin tools (no real accounts are touched).
    async isAdmin() { return /demo-admin/.test(location.search); },
    async adminList() {
      return fam.map((f) => ({ ...f, recipes: f.id === "f1" ? (recipes?.length || 0) : 0,
        members: people.filter((p) => p.family_id === f.id).map((p) => ({ email: `${p.display_name.toLowerCase()}@example.com`, is_admin: p.id === "me" })) }));
    },
    async viewStatus() { return demoView; },
    async viewStart(familyId, edit) { const f = fam.find((x) => x.id === familyId); demoView = f && familyId !== "f1" ? { family_id: f.id, name: f.name, color: f.color, can_edit: !!edit } : null; return demoView; },
    async viewStop() { demoView = null; },
    async adminCreateUser() { throw new Error("Creating logins needs Supabase — connect config.js first."); },
    async shareTargets() { return [{ id: "demo-2", name: "Demo Cousins", color: "#9ED9C3" }]; },
    async shareRecipe() { await wait(300); return uid(); },
    async setGroceryChecked(id, checked) { const it = grocery.find((g) => g.id === id); if (it) it.checked = checked; },
    async deleteGroceryItem(id) { grocery = grocery.filter((g) => g.id !== id); },
    async deleteGroceryItems(ids) { grocery = grocery.filter((g) => !ids.includes(g.id)); },
    async uploadImage(file) { return new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(file); }); },
    async importUrl() {
      await wait(500);
      throw new Error("Link import runs through Supabase — connect config.js to turn it on. Meanwhile, paste the recipe text below.");
    },
  };
}

export async function createStore() { return isDemo ? demoStore() : supabaseStore(); }
