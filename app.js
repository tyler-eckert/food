import { createStore, isDemo } from "./store.js";
import { parseIngredientBlock, parseStepBlock, ingredientsToText, stepsToText, scaleQty, qtyToNumber, splitRecipeText } from "./parse.js";

// ------------------------------------------------------------------ helpers
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const icon = (n, cls = "") => `<svg class="i ${cls}"><use href="#i-${n}"/></svg>`;
const fmtMin = (m) => (m == null || m === "" ? "" : m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ""}`);
const totalOf = (r) => r.total_min ?? ((r.prep_min || 0) + (r.cook_min || 0) || null);
const initials = (n) => (n || "?").trim().charAt(0).toUpperCase();
const debounce = (fn, ms = 180) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const COURSES = ["Entree", "Side", "Appetizer", "Dessert", "Drink", "Cocktail", "Mocktail", "Breakfast", "Brunch", "Lunch", "Dinner", "Soup", "Salad", "Snack", "Sauce", "Bread"];
const COURSE_LABEL = { Entree: "Entrées", Side: "Sides", Appetizer: "Appetizers", Dessert: "Desserts", Drink: "Drinks", Cocktail: "Cocktails", Mocktail: "Mocktails", Soup: "Soups", Salad: "Salads", Snack: "Snacks", Sauce: "Sauces", Bread: "Breads" };
const COURSE_COLOR = { Entree: "var(--peach)", Side: "var(--mint)", Appetizer: "var(--blush)", Dessert: "var(--lav)", Drink: "var(--butter)" };
const CUISINES = ["American", "Southern", "Cajun", "Tex-Mex", "Mexican", "Italian", "German", "Spanish", "Argentinian", "Korean", "French", "Greek", "Mediterranean", "Asian", "Chinese", "Japanese", "Thai", "Indian", "BBQ"];
const PROTEINS = ["Chicken", "Beef", "Pork", "Turkey", "Seafood", "Eggs", "Beans", "Vegetarian", "Vegan"];
const TAG_IDEAS = ["kid friendly", "weeknight", "freezer friendly", "holiday", "one pan", "healthy", "crockpot", "make ahead", "grill"];
const EMOJI = { Breakfast: "🥞", Brunch: "🍳", Lunch: "🥪", Side: "🥔", Appetizer: "🧀", Soup: "🍲", Salad: "🥗", Dessert: "🧁", Snack: "🍿", Drink: "🍹", Cocktail: "🍸", Mocktail: "🍹", Sauce: "🫙", Bread: "🥖" };
const PROTEIN_EMOJI = { Chicken: "🍗", Beef: "🥩", Pork: "🥓", Turkey: "🦃", Seafood: "🐟", Eggs: "🍳", Vegetarian: "🥕", Vegan: "🥑", Beans: "🫘" };
// Bar: cocktails are recipes whose course is one of these; they live on the Bar tab instead of Recipes.
const DRINK_COURSES = ["Cocktail", "Mocktail", "Drink"];
const isDrink = (r) => DRINK_COURSES.includes(String(r?.course || "").trim().replace(/^./, (c) => c.toUpperCase()));
const SPIRITS = ["Bourbon", "Rye", "Scotch", "Irish whiskey", "Gin", "Vodka", "Tequila", "Mezcal", "Rum", "Brandy", "Cognac", "Liqueur", "Wine", "Beer", "None (mocktail)"];
const METHODS = ["Shaken", "Stirred", "Built", "Blended"];
const GLASSES = ["Rocks", "Coupe", "Martini", "Highball", "Collins", "Nick & Nora", "Copper mug", "Wine glass", "Flute", "Hurricane", "Pint"];
const ART = [["#FFE6D8", "#FDE9EE"], ["#E0F5EC", "#FFF5DA"], ["#EFEBFC", "#FDE9EE"], ["#FFF5DA", "#FFE6D8"], ["#E0F5EC", "#EFEBFC"]];

function art(r, big = false) {
  const n = [...(r.title || "")].reduce((a, c) => a + c.charCodeAt(0), 0);
  const [a, b] = ART[n % ART.length];
  const e = EMOJI[r.course] || PROTEIN_EMOJI[r.protein] || "🍽️";
  return `<div class="art" style="background:linear-gradient(145deg,${a},${b});${big ? "font-size:96px" : ""}">${e}</div>`;
}
function thumb(r, big = false) {
  return r.image_url
    ? `<img src="${h(r.image_url)}" alt="" loading="lazy" data-art="${h(JSON.stringify({ title: r.title, course: r.course, protein: r.protein }))}">`
    : art(r, big);
}
// Broken image → pastel art
document.addEventListener("error", (e) => {
  const img = e.target;
  if (img.tagName === "IMG" && img.dataset.art) {
    const d = document.createElement("div");
    d.innerHTML = art(JSON.parse(img.dataset.art));
    img.replaceWith(d.firstChild);
  }
}, true);

let toastT;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2600);
}

// ------------------------------------------------------------------ state
let store;
const S = {
  me: null, recipes: [], pins: new Map(), ratings: [], profiles: [], families: [], grocery: [], admin: false,
  tab: "recipes", q: "", filters: {}, filterOpen: false, openGroups: new Set(["course"]),
  famTab: "all", detail: null, scale: 1, checked: new Set(), wake: null,
  sort: "category", dir: 1, open: new Set(), sec: new Map(), ck: new Set(), details: new Map(),
  // bar
  barReady: true, wines: [], wineLog: [], pairings: [], bar: "cocktails", bq: "", spirit: new Set(), wtype: new Set(),
  wgroup: "location", wopen: new Set(), showEmpty: false,
  view: null, // admin "view as family": { family_id, name, color, can_edit }
};
const byId = (id) => S.recipes.find((r) => r.id === id);
const profile = (id) => S.profiles.find((p) => p.id === id);
const family = (id) => S.families.find((f) => f.id === id);

function scoresFor(recipeId, familyId = null) {
  const rs = S.ratings.filter((r) => r.recipe_id === recipeId && (!familyId || profile(r.user_id)?.family_id === familyId));
  if (!rs.length) return { avg: 0, n: 0, list: rs };
  return { avg: rs.reduce((a, r) => a + r.score, 0) / rs.length, n: rs.length, list: rs };
}
const myScore = (id) => S.ratings.find((r) => r.recipe_id === id && r.user_id === S.me.id)?.score || 0;

// ------------------------------------------------------------------ filters
const TIME_BUCKETS = [["Under 30 min", (m) => m != null && m < 30], ["30–60 min", (m) => m != null && m >= 30 && m <= 60], ["Over an hour", (m) => m != null && m > 60]];
const GROUPS = [
  { key: "course", label: "Course", icon: "bowl", tint: "peach", order: COURSES },
  { key: "cuisine", label: "Cuisine", icon: "globe", tint: "mint" },
  { key: "protein", label: "Protein", icon: "leaf", tint: "blush", order: PROTEINS },
  { key: "difficulty", label: "Difficulty", icon: "flame", tint: "butter", order: ["Easy", "Medium", "Hard"] },
  { key: "time", label: "Total time", icon: "clock", tint: "lav", order: TIME_BUCKETS.map((b) => b[0]) },
  { key: "tags", label: "Tags", icon: "tag", tint: "lav" },
  { key: "love", label: "Family favorites", icon: "heart", tint: "blush" },
  { key: "credit", label: "Shared by", icon: "users", tint: "butter" },
];
const TINT = { peach: ["var(--peach-soft)", "#B8583A"], mint: ["var(--mint-soft)", "var(--mint-deep)"], blush: ["var(--blush-soft)", "#B04766"], butter: ["var(--butter-soft)", "#96701A"], lav: ["var(--lav-soft)", "var(--lav-deep)"] };

function valuesOf(r, key) {
  switch (key) {
    case "tags": return r.tags || [];
    case "time": { const m = totalOf(r); return TIME_BUCKETS.filter(([, t]) => t(m)).map(([l]) => l); }
    case "love": {
      const v = [];
      if (S.pins.has(r.id)) v.push("📌 Pinned");
      const mine = myScore(r.id);
      if (mine === 5) v.push("My 5-heart picks");
      if (!mine) v.push("I haven't rated");
      for (const f of S.families) { const s = scoresFor(r.id, f.id); if (s.n && s.avg >= 4) v.push(`Loved by ${f.name}`); }
      return v;
    }
    default: return r[key] ? [r[key]] : [];
  }
}
const foodRecipes = () => S.recipes.filter((r) => !isDrink(r));
const activeCount = () => Object.values(S.filters).reduce((a, s) => a + s.size, 0);

function matches(r, skipKey = null) {
  if (S.q) {
    const hay = [r.title, r.description, r.course, r.cuisine, r.protein, (r.tags || []).join(" "), r.ingredient_names, r.credit].join(" ").toLowerCase();
    if (!S.q.toLowerCase().split(/\s+/).filter(Boolean).every((t) => hay.includes(t))) return false;
  }
  for (const [key, set] of Object.entries(S.filters)) {
    if (key === skipKey || !set.size) continue;
    const vals = valuesOf(r, key);
    if (![...set].some((v) => vals.includes(v))) return false; // OR within group, AND across groups
  }
  return true;
}

const detailsOf = (id) => S.details.get(id) || { ingredients: [], steps: [] };
const SORTS = {
  category: { label: "category", group: (r) => r.course || "Other", order: COURSES, cmp: (a, b) => a.title.localeCompare(b.title) },
  protein: { label: "protein", group: (r) => r.protein || "Other", order: PROTEINS, cmp: (a, b) => a.title.localeCompare(b.title) },
  cuisine: { label: "cuisine", group: (r) => r.cuisine || "Other", cmp: (a, b) => a.title.localeCompare(b.title) },
  az: { label: "name", cmp: (a, b) => a.title.localeCompare(b.title) },
  new: { label: "newest", cmp: (a, b) => (b.created_at || "").localeCompare(a.created_at || "") },
  top: { label: "family hearts", cmp: (a, b) => { const x = scoresFor(a.id), y = scoresFor(b.id); return y.avg - x.avg || y.n - x.n || a.title.localeCompare(b.title); } },
  mine: { label: "my rating", cmp: (a, b) => myScore(b.id) - myScore(a.id) || a.title.localeCompare(b.title) },
  quick: { label: "total time", cmp: (a, b) => (totalOf(a) ?? 1e9) - (totalOf(b) ?? 1e9) || a.title.localeCompare(b.title) },
  fewest: { label: "ingredient count", cmp: (a, b) => detailsOf(a.id).ingredients.length - detailsOf(b.id).ingredients.length || a.title.localeCompare(b.title) },
};
function sorted(list) {
  const cfg = SORTS[S.sort] || SORTS.category;
  const out = [...list].sort((a, b) => cfg.cmp(a, b) * S.dir);
  if (S.sort === "quick") return [...out.filter((r) => totalOf(r) != null), ...out.filter((r) => totalOf(r) == null)]; // no time → always last
  return out;
}
/** → [{ key, label, items }] */
function grouped(list) {
  const cfg = SORTS[S.sort] || SORTS.category;
  const items = sorted(list);
  if (!cfg.group) return [{ key: "all", label: "", items }];
  const map = new Map();
  for (const r of items) { const k = cfg.group(r); if (!map.has(k)) map.set(k, []); map.get(k).push(r); }
  const rank = (k) => { const i = (cfg.order || []).indexOf(k); return k === "Other" ? 998 : i < 0 ? 500 : i; };
  return [...map.entries()].sort(([a], [b]) => (a === "Other") - (b === "Other") || (rank(a) - rank(b) || a.localeCompare(b)) * S.dir)
    .map(([key, items]) => ({ key, label: COURSE_LABEL[key] || key, items }));
}

function renderFilters() {
  const panel = $("#filterPanel");
  let html = "";
  for (const g of GROUPS) {
    const counts = new Map();
    for (const r of foodRecipes()) if (matches(r, g.key)) for (const v of valuesOf(r, g.key)) counts.set(v, (counts.get(v) || 0) + 1);
    const sel = S.filters[g.key] || new Set();
    for (const v of sel) if (!counts.has(v)) counts.set(v, 0);
    if (!counts.size) continue;
    const keys = [...counts.keys()].sort((a, b) => {
      if (g.order) { const ia = g.order.indexOf(a), ib = g.order.indexOf(b); if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); }
      return g.key === "tags" ? counts.get(b) - counts.get(a) || a.localeCompare(b) : a.localeCompare(b);
    });
    const [bg, fg] = TINT[g.tint];
    html += `<details class="fgroup" data-group="${g.key}" ${S.openGroups.has(g.key) ? "open" : ""}>
      <summary><span class="ico" style="background:${bg};color:${fg}">${icon(g.icon, "sm")}</span>${g.label}
        <span class="count ${sel.size ? "on" : ""}">${sel.size ? `${sel.size} selected` : keys.length}</span>${icon("down", "sm chev")}</summary>
      <div class="chips">${keys.map((v) => `<button class="chip" data-f="${g.key}" data-v="${h(v)}" aria-pressed="${sel.has(v)}">${h(v)} <small>${counts.get(v)}</small></button>`).join("")}</div>
    </details>`;
  }
  const shown = foodRecipes().filter((r) => matches(r)).length;
  html += `<div class="filter-foot"><button class="link-btn" data-act="clear-filters" ${activeCount() ? "" : "hidden"}>Clear all</button><span style="color:var(--ink-3);font-size:14px;margin-left:auto">${shown} recipe${shown === 1 ? "" : "s"}</span></div>`;
  panel.innerHTML = html || `<div class="empty" style="padding:24px">Add a few recipes and their details will show up here as filters.</div>`;

  const n = activeCount();
  $("#filterCount").hidden = !n; $("#filterCount").textContent = n;
  $("#activeChips").innerHTML = Object.entries(S.filters).flatMap(([k, set]) =>
    [...set].map((v) => `<button class="chip" data-f="${k}" data-v="${h(v)}">${h(v)} ${icon("x", "sm")}</button>`)).join("");
}

// ------------------------------------------------------------------ list rows
const PLURAL = new Set(["cup", "clove", "can", "jar", "stick", "slice", "bunch", "sprig", "head", "handful", "box", "bag", "envelope", "stalk", "container", "block", "link", "wedge", "sleeve", "shot", "dollop", "slab", "pinch", "dash", "loaf"]);
function unitLabel(unit, amount) {
  if (!unit) return "";
  if (!amount || amount <= 1 || !PLURAL.has(unit)) return unit;
  return unit === "loaf" ? "loaves" : /(ch|sh|x)$/.test(unit) ? unit + "es" : unit + "s";
}
function ingHtml(i, scale = 1) {
  const qty = scaleQty(i.quantity, scale);
  const nums = qtyToNumber(i.quantity);
  const q = [qty, unitLabel(i.unit, nums ? Math.max(...nums) * scale : 0)].filter(Boolean).join(" ");
  return `${q ? `<span class="q">${h(q)}</span> ` : ""}${h(i.name)}${i.note ? `<span class="note">, ${h(i.note)}</span>` : ""}`;
}
function ingList(rows, keyFn, scale = 1) {
  let sec = "", out = `<ul class="ing">`;
  rows.forEach((i, idx) => {
    if ((i.section || "") !== sec) { sec = i.section || ""; if (sec) out += `</ul><div class="subhead">${h(sec)}</div><ul class="ing">`; }
    const k = keyFn("i", idx);
    out += `<li data-ck="${k}" class="${S.ck.has(k) ? "done" : ""}"><span class="box">${icon("check", "sm")}</span><span class="txt">${ingHtml(i, scale)}</span></li>`;
  });
  return out + "</ul>";
}
function stepList(rows, keyFn) {
  let sec = "", out = `<ol class="steps">`;
  rows.forEach((st, idx) => {
    if ((st.section || "") !== sec) { sec = st.section || ""; if (sec) out += `</ol><div class="subhead">${h(sec)}</div><ol class="steps" style="counter-reset:s ${idx}">`; }
    const k = keyFn("s", idx);
    out += `<li data-ck="${k}" class="${S.ck.has(k) ? "done" : ""}"><span>${h(st.body)}</span></li>`;
  });
  return out + "</ol>";
}

function metaLine(r) {
  const n = detailsOf(r.id).ingredients.length;
  if (isDrink(r)) return [r.spirit, r.method, r.glass, n ? `${n} ingredients` : ""].filter(Boolean).map(h).join(" · ") || "&nbsp;";
  return [fmtMin(totalOf(r)), r.protein, r.cuisine, n ? `${n} ingredients` : ""].filter(Boolean).map(h).join(" · ") || "&nbsp;";
}
function row(r) {
  const s = scoresFor(r.id), open = S.open.has(r.id);
  return `<article class="item ${open ? "open" : ""}" data-item="${r.id}">
    <button class="item-head" data-toggle="${r.id}" aria-expanded="${open}">
      <span class="tn">${thumb(r)}</span>
      <span class="mid"><h3>${h(r.title)}</h3><span class="meta">${metaLine(r)}</span></span>
      <span class="right">${S.pins.has(r.id) ? `<span class="pinned">${icon("pin", "sm fill")}</span>` : ""}
        ${s.n ? `<span class="avg">${icon("heart", "fill")}${s.avg.toFixed(1)}</span>` : ""}${icon("down", "sm chev")}</span>
    </button>
    ${open ? rowBody(r) : ""}
  </article>`;
}
function rowBody(r) {
  const d = detailsOf(r.id), mine = myScore(r.id), pinned = S.pins.has(r.id);
  const sec = S.sec.get(r.id) || { ing: true, steps: false };
  const key = (t, i) => `${r.id}:${t}${i}`;
  const drink = isDrink(r);
  const facts = (drink ? [["Glass", r.glass], ["Garnish", r.garnish], ["Serves", r.servings]]
    : [["Prep", fmtMin(r.prep_min)], ["Cook", fmtMin(r.cook_min)], ["Total", fmtMin(totalOf(r))], ["Serves", r.servings]]).filter(([, v]) => v);
  const pills = (drink ? [[r.spirit, "mint"], [r.method, "blush"], [r.difficulty, "butter"]]
    : [[r.course, "peach"], [r.cuisine, "mint"], [r.protein, "blush"], [r.difficulty, "butter"]]).filter(([v]) => v);
  return `<div class="item-body">
    ${r.description ? `<p class="desc">${h(r.description)}</p>` : ""}
    <div class="chips">${pills.map(([v, c]) => `<span class="chip static ${c}">${h(v)}</span>`).join("")}${(r.tags || []).map((t) => `<span class="chip static lav">#${h(t)}</span>`).join("")}
      ${r.credit ? `<span class="credit">${icon("users", "sm")} From ${h(r.credit)}</span>` : ""}</div>
    ${facts.length ? `<div class="facts">${facts.map(([k, v]) => `<span>${k} <b>${h(v)}</b></span>`).join("")}</div>` : ""}
    <div class="item-actions">
      <div class="hearts" role="radiogroup" aria-label="Your rating">${[1, 2, 3, 4, 5].map((n) => `<button role="radio" aria-checked="${mine === n}" aria-label="${n} heart${n > 1 ? "s" : ""}" data-rate="${n}" data-rid="${r.id}" class="${n <= mine ? "on" : ""}">${icon("heart", "fill")}</button>`).join("")}</div>
      <button class="mini-btn ${pinned ? "on" : ""}" data-pin="${r.id}">${icon("pin", "sm" + (pinned ? " fill" : ""))}${pinned ? "Pinned" : "Pin"}</button>
      <button class="mini-btn" data-open="${r.id}">${icon("expand", "sm")}Open</button>
      <button class="mini-btn" data-edit="${r.id}">${icon("edit", "sm")}Edit</button>
      <button class="mini-btn" data-groc="${r.id}">${icon("cart", "sm")}Add to list</button>
    </div>
    ${d.ingredients.length ? `<details class="sub" data-sec="ing" data-rid="${r.id}" ${sec.ing ? "open" : ""}>
      <summary><span class="ico" style="background:var(--mint-soft);color:var(--mint-deep)">${icon("list", "sm")}</span>Ingredients<span class="cnt">${d.ingredients.length}</span>${icon("down", "sm chev")}</summary>
      <div class="inner">${ingList(d.ingredients, key)}</div></details>` : ""}
    ${d.steps.length ? `<details class="sub" data-sec="steps" data-rid="${r.id}" ${sec.steps ? "open" : ""}>
      <summary><span class="ico" style="background:var(--peach-soft);color:#B8583A">${icon("book", "sm")}</span>Instructions<span class="cnt">${d.steps.length} step${d.steps.length === 1 ? "" : "s"}</span>${icon("down", "sm chev")}</summary>
      <div class="inner">${stepList(d.steps, key)}</div></details>` : ""}
    ${r.notes ? `<div class="item-notes">${h(r.notes)}</div>` : ""}
  </div>`;
}
const emptyState = (emoji, title, text, btn = "") =>
  `<div class="empty"><div class="logo">${emoji}</div><h3>${title}</h3><p>${text}</p>${btn}</div>`;

function pinnedList() {
  return S.recipes.filter((r) => S.pins.has(r.id)).sort((a, b) => S.pins.get(b.id).localeCompare(S.pins.get(a.id)));
}
function groupsHtml(groups) {
  return groups.map((g) => `<section class="lgroup">
    ${g.label ? `<div class="lgroup-head">${COURSE_COLOR[g.key] ? `<span class="swatch-dot" style="background:${COURSE_COLOR[g.key]}"></span>` : ""}<h2>${h(g.label)}</h2><span class="n">${g.items.length}</span></div>` : ""}
    <div class="list">${g.items.map(row).join("")}</div></section>`).join("");
}

let visibleIds = [];
function renderHome() {
  renderFilters();
  const food = foodRecipes();
  const list = food.filter((r) => matches(r));
  visibleIds = list.map((r) => r.id);
  const browsing = !S.q && !activeCount();
  const pins = pinnedList();
  const anyOpen = visibleIds.some((id) => S.open.has(id));
  const cfg = SORTS[S.sort] || SORTS.category;
  $("#dirBtn").dataset.dir = S.dir;
  $("#sortSel").value = S.sort;
  $("#list").innerHTML = !list.length
    ? (food.length
      ? emptyState("🔍", "No matches", "Try a different search or loosen a filter.", `<button class="btn soft" data-act="clear-filters">Clear filters</button>`)
      : emptyState("🍑", "Your recipe box is empty", "Paste a link from any recipe site, or type in Grandma's favorite.", `<button class="btn primary" data-act="new">${icon("plus")} Add a recipe</button>`))
    : `<div class="list-meta"><span>${list.length} recipe${list.length === 1 ? "" : "s"}${browsing ? "" : ` of ${food.length}`} · by ${cfg.label}</span>
        <button class="link-btn" data-act="${anyOpen ? "collapse-all" : "expand-all"}">${anyOpen ? "Collapse all" : "Expand all"}</button></div>
      ${browsing && pins.length ? groupsHtml([{ key: "pinned", label: "📌 Pinned", items: pins }]) : ""}
      ${groupsHtml(grouped(list))}`;
}

function renderPinned() {
  const pins = pinnedList();
  $("#pinnedList").innerHTML = pins.length ? `<div class="list">${pins.map(row).join("")}</div>`
    : emptyState("📌", "Nothing pinned yet", "Tap Pin on any recipe to keep it here — perfect for this week's meal plan.");
}

function renderFavorites() {
  $("#famSeg").innerHTML = [{ id: "all", name: "Everyone" }, ...S.families]
    .map((f) => `<button data-fam="${f.id}" aria-pressed="${S.famTab === f.id}">${h(f.name)}</button>`).join("");
  const famId = S.famTab === "all" ? null : S.famTab;
  const ranked = S.recipes.map((r) => ({ r, s: scoresFor(r.id, famId) })).filter((x) => x.s.n)
    .sort((a, b) => b.s.avg - a.s.avg || b.s.n - a.s.n || a.r.title.localeCompare(b.r.title));
  $("#rankList").innerHTML = ranked.length ? ranked.map(({ r, s }, i) => {
    const raters = s.list.map((x) => profile(x.user_id)).filter(Boolean);
    return `<button class="rank" data-open="${r.id}">
      <span class="no">${i + 1}</span>
      <span class="tn">${thumb(r)}</span>
      <span class="mid"><h4>${h(r.title)}</h4>
        <span class="sub">${miniHearts(s.avg)} ${s.n} vote${s.n === 1 ? "" : "s"}
          <span class="avatars">${raters.slice(0, 5).map((p) => `<span class="av" title="${h(p.display_name)}" style="background:${family(p.family_id)?.color || "var(--ink-3)"}">${h(initials(p.display_name))}</span>`).join("")}</span></span></span>
      <span class="big">${s.avg.toFixed(1)}${icon("heart", "fill")}</span></button>`;
  }).join("") : emptyState("💗", "No hearts yet", famId ? `Nobody in ${h(family(famId)?.name)} has rated a recipe yet.` : "Open any recipe and tap the hearts to start the family rankings.");
}
function miniHearts(avg) {
  const full = Math.round(avg);
  return `<span class="mini-hearts">${[1, 2, 3, 4, 5].map((i) => `<svg class="i fill ${i > full ? "off" : ""}"><use href="#i-heart"/></svg>`).join("")}</span>`;
}

function renderMe() {
  if (document.activeElement?.id === "mePw") return; // don't wipe a password mid-typing when a sync re-renders
  const me = S.me, fam = family(me.family_id);
  const mine = S.ratings.filter((r) => r.user_id === me.id).length;
  const added = S.recipes.filter((r) => r.created_by === me.id).length;
  $("#meBody").innerHTML = `
    <div class="profile"><div class="big-av">${h(initials(me.display_name || me.email))}</div>
      <div><h2>${h(me.display_name || "Hello!")}</h2><p>${h(me.email)}${fam ? ` · ${h(fam.name)} family` : ""}</p></div></div>
    <div class="tiles"><div class="tile"><b>${added}</b><span>Added</span></div><div class="tile"><b>${S.pins.size}</b><span>Pinned</span></div><div class="tile"><b>${mine}</b><span>Rated</span></div></div>
    <div class="group-title">Your name</div>
    <div class="group"><div class="row"><input id="meName" value="${h(me.display_name)}" placeholder="What the family calls you" autocomplete="nickname"></div></div>
    <p class="hint">${fam ? `You're signed in as part of the ${h(fam.name)} family's recipe box — everything here is separate from other families' books.` : ""}</p>
    <div class="group-title">Password</div>
    <div class="group"><div class="row"><input id="mePw" type="password" autocomplete="new-password" minlength="8" placeholder="New password (8+ characters)"><button class="btn soft sm" data-act="save-password">Save</button></div></div>
    ${S.admin ? `<div class="group-title">Admin</div>
    <div class="group"><button class="row" style="width:100%" data-act="open-admin">${icon("users", "sm")}<span style="flex:1;text-align:left;font-weight:600">Families &amp; logins</span><span style="color:var(--ink-3);font-size:14px">Add a login · View as</span></button>
      ${S.view ? `<button class="row" style="width:100%;color:var(--blush-deep);font-weight:600" data-act="view-stop">${icon("out", "sm")} Stop viewing the ${h(S.view.name)} family</button>` : ""}</div>` : ""}
    <div class="group-title">App</div>
    <div class="group">
      <div class="row" style="color:var(--ink-2);font-size:15px;padding:12px 16px;line-height:1.45">${icon("share", "sm")}<span>On iPhone: tap Share → <b>Add to Home Screen</b> for a full-screen app.</span></div>
      <button class="row" style="width:100%;color:var(--blush-deep);font-weight:600" data-act="signout">${icon("out", "sm")} Sign out</button>
    </div>
    ${isDemo ? `<div class="demo-note"><b>Demo mode.</b> You're seeing sample recipes stored only in this tab. Fill in <code>config.js</code> with your Supabase URL and anon key to go live.</div>` : ""}`;
}

function renderAll() { renderHome(); renderPinned(); renderFavorites(); renderGrocery(); renderBar(); renderMe(); }

// ------------------------------------------------------------------ grocery list
function groceryGroups() {
  const map = new Map();
  for (const it of S.grocery) {
    const k = it.recipe_id ? "r:" + it.recipe_id : "general";
    if (!map.has(k)) map.set(k, { label: it.recipe_id ? (it.recipe_title || "Recipe") : "General list", items: [] });
    map.get(k).items.push(it);
  }
  return [...map.values()];
}
function groceryLine(it) {
  return [it.quantity, it.unit, it.name].filter(Boolean).join(" ") + (it.note ? `, ${it.note}` : "");
}
function groceryRow(it) {
  return `<div class="item grocery-row ${it.checked ? "done" : ""}">
    <button class="g-check" data-gck="${it.id}" aria-label="${it.checked ? "Mark as still needed" : "Mark as already have it"}">${icon("check", "sm")}</button>
    <span class="g-txt">${h(groceryLine(it))}</span>
    <button class="g-del" data-gdel="${it.id}" aria-label="Remove">${icon("x", "sm")}</button>
  </div>`;
}
function renderGrocery() {
  const groups = groceryGroups();
  $("#groceryList").innerHTML = !S.grocery.length
    ? emptyState("🧺", "Grocery list is empty", "Tap “Add to list” on any recipe to send its ingredients here, or add something below.")
    : groups.map((g) => `<section class="lgroup"><div class="lgroup-head"><h2>${h(g.label)}</h2><span class="n">${g.items.length}</span></div>
        <div class="list">${g.items.map(groceryRow).join("")}</div></section>`).join("");
  const anyChecked = S.grocery.some((i) => i.checked);
  $("#groceryFoot").hidden = !S.grocery.length;
  $("#clearCheckedBtn").hidden = !anyChecked;
  const clearAllBtn = $("#clearAllBtn");
  if (clearAllBtn && !clearAllBtn.dataset.confirm) clearAllBtn.textContent = "Clear all";
}
async function pushRecipesToGrocery(ids, successMsg) {
  const rows = [];
  for (const id of ids) {
    const r = byId(id), d = detailsOf(id);
    d.ingredients.forEach((i, idx) => rows.push({ name: i.name, quantity: i.quantity, unit: i.unit, note: i.note, recipe_id: id, recipe_title: r?.title || "", source: "recipe", position: idx }));
  }
  if (!rows.length) return toast("No ingredients to add yet");
  try { await store.addGroceryItems(rows); await reload(); toast(successMsg); }
  catch (e) { toast(e.message); }
}
function addRecipeToGrocery(id) {
  const r = byId(id);
  return pushRecipesToGrocery([id], `Added ${r?.title || "that recipe"}'s ingredients to your grocery list 🧺`);
}
function addPinnedToGrocery() {
  const ids = pinnedList().map((r) => r.id);
  if (!ids.length) return toast("Nothing pinned yet");
  return pushRecipesToGrocery(ids, `Added ingredients from ${ids.length} pinned recipe${ids.length === 1 ? "" : "s"}`);
}
function addFavoritesToGrocery() {
  const famId = S.famTab === "all" ? null : S.famTab;
  const ids = S.recipes.filter((r) => { const s = scoresFor(r.id, famId); return s.n && s.avg >= 4; }).map((r) => r.id);
  if (!ids.length) return toast("No 4+ heart favorites yet");
  return pushRecipesToGrocery(ids, `Added ingredients from ${ids.length} favorite${ids.length === 1 ? "" : "s"}`);
}
async function addManualGroceryItem(name) {
  name = name.trim(); if (!name) return;
  try { await store.addGroceryItem(name); await reload(); }
  catch (e) { toast(e.message); }
}
async function toggleGroceryChecked(id) {
  const it = S.grocery.find((x) => x.id === id); if (!it) return;
  it.checked = !it.checked; renderGrocery();
  try { await store.setGroceryChecked(id, it.checked); } catch (e) { toast(e.message); }
}
async function deleteGroceryItem(id) {
  S.grocery = S.grocery.filter((x) => x.id !== id); renderGrocery();
  try { await store.deleteGroceryItem(id); } catch (e) { toast(e.message); }
}
async function clearCheckedGrocery() {
  const ids = S.grocery.filter((i) => i.checked).map((i) => i.id);
  if (!ids.length) return;
  S.grocery = S.grocery.filter((i) => !i.checked); renderGrocery();
  try { await store.deleteGroceryItems(ids); } catch (e) { toast(e.message); }
}
let clearAllTimer;
async function clearAllGrocery() {
  if (!S.grocery.length) return;
  const btn = $("#clearAllBtn");
  if (!btn.dataset.confirm) {
    btn.dataset.confirm = "1"; btn.textContent = "Tap again to clear everything";
    clearTimeout(clearAllTimer);
    clearAllTimer = setTimeout(() => { delete btn.dataset.confirm; btn.textContent = "Clear all"; }, 3000);
    return;
  }
  clearTimeout(clearAllTimer);
  delete btn.dataset.confirm; btn.textContent = "Clear all";
  const ids = S.grocery.map((i) => i.id);
  S.grocery = []; renderGrocery();
  try { await store.deleteGroceryItems(ids); toast("Grocery list cleared"); } catch (e) { toast(e.message); }
}
function groceryExportText() {
  return groceryGroups().map((g) => `${g.label}\n` + g.items.map((i) => `- [ ] ${groceryLine(i)}`).join("\n")).join("\n\n");
}
async function exportGrocery() {
  const text = groceryExportText();
  if (!text) return toast("Nothing to export yet");
  if (navigator.share) { try { await navigator.share({ title: "Grocery list", text }); } catch { /* cancelled */ } return; }
  try { await navigator.clipboard.writeText(text); toast("Copied — paste into Notes, then select the lines and tap the checklist button"); }
  catch { toast("Couldn't copy — try again"); }
}

// ------------------------------------------------------------------ tabs & routing
function showTab(tab) {
  if (!["recipes", "pinned", "favorites", "grocery", "bar", "me"].includes(tab)) tab = "recipes";
  if (S.tab !== tab) window.scrollTo({ top: 0 });
  S.tab = tab;
  for (const v of $$("[data-view]")) v.hidden = v.dataset.view !== tab;
  for (const b of $$(".tabbar [data-tab]")) b.toggleAttribute("aria-current", b.dataset.tab === tab), b.dataset.tab === tab && b.setAttribute("aria-current", "page");
}
let depth = 0;
function go(hash) { depth++; location.hash = hash; }
function back(fallback) { if (depth > 0) { depth--; history.back(); } else location.hash = fallback; }

async function route() {
  const [a, b] = location.hash.replace(/^#\/?/, "").split("/");
  if (isRO() && ["new", "new-drink", "edit", "wine"].includes(a)) { toast(RO_MSG); depth = Math.max(0, depth - 1); history.replaceState(null, "", "#/" + S.tab); return route(); }
  if (a === "r" && b) { closeSheet("editorSheet"); await openDetail(b); }
  else if (a === "new") await openEditor(null);
  else if (a === "new-drink") await openEditor(null, { course: "Cocktail" });
  else if (a === "edit" && b) await openEditor(b);
  else if (a === "wine" && b) { closeSheet("detailSheet"); await openWineEditor(b === "new" ? null : b); }
  else {
    for (const id of ["adminSheet", "shareSheet", "drinkSheet", "wineSheet", "editorSheet", "detailSheet"]) closeSheet(id);
    showTab(a || "recipes");
    if (S.scrollWine) { const id = S.scrollWine; S.scrollWine = null; requestAnimationFrame(() => $(`#barList [data-witem="${id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" })); }
  }
}
window.addEventListener("hashchange", route);

function openSheet(id) {
  $("#" + id).classList.add("open");
  $("#scrim").classList.add("show");
  document.documentElement.classList.add("lock");
}
function closeSheet(id) {
  const el = $("#" + id);
  if (!el.classList.contains("open")) return;
  el.classList.remove("open");
  if (id === "detailSheet") { releaseWake(); S.detail = null; }
  if (!$$(".sheet.open").length) { $("#scrim").classList.remove("show"); document.documentElement.classList.remove("lock"); }
}

// ------------------------------------------------------------------ detail
async function openDetail(id) {
  const sheet = $("#detailSheet");
  if (S.detail?.id !== id) {
    const base = byId(id);
    sheet.innerHTML = `<div class="hero">${base ? thumb(base, true) : ""}</div><div class="detail"><div class="detail-inner"><h1>${h(base?.title || "")}</h1><div class="skeleton" style="height:180px;border-radius:24px;margin-top:20px"></div></div></div>`;
    sheet.scrollTop = 0;
    openSheet("detailSheet");
    try { S.detail = byId(id) && S.details.has(id) ? { ...byId(id), ...structuredClone(detailsOf(id)) } : await store.getRecipe(id); } catch (e) { toast("Couldn't open that recipe."); return back("#/" + S.tab); }
    if (!S.detail) { toast("That recipe was deleted."); return back("#/" + S.tab); }
    S.scale = 1; S.checked = new Set();
  }
  renderDetail();
  openSheet("detailSheet");
}

function renderDetail() {
  const r = S.detail; if (!r) return;
  const pinned = S.pins.has(r.id), mine = myScore(r.id);
  const drink = isDrink(r);
  const stats = (drink ? [["Method", r.method], ["Glass", r.glass], ["Serves", r.servings]]
    : [["Prep", fmtMin(r.prep_min)], ["Cook", fmtMin(r.cook_min)], ["Total", fmtMin(totalOf(r))], ["Serves", r.servings]]).filter(([, v]) => v);
  const pills = (drink ? [[r.course, "peach"], [r.spirit, "mint"], [r.difficulty, "butter"]]
    : [[r.course, "peach"], [r.cuisine, "mint"], [r.protein, "blush"], [r.difficulty, "butter"]]).filter(([v]) => v);
  const paired = S.pairings.filter((p) => p.recipe_id === r.id).map((p) => S.wines.find((w) => w.id === p.wine_id)).filter(Boolean);
  const scalable = r.ingredients.some((i) => qtyToNumber(i.quantity));
  const famRows = S.families.map((f) => ({ f, s: scoresFor(r.id, f.id) })).filter((x) => x.s.n);
  const dkey = (t, i) => `d:${r.id}:${t}${i}`;
  $("#detailSheet").innerHTML = `
    <div class="hero">${thumb(r, true)}
      <div class="hero-actions"><button class="glass" data-act="close-detail" aria-label="Close">${icon("down")}</button>
        <div class="grp"><button class="glass ${pinned ? "on" : ""}" data-act="pin" aria-label="${pinned ? "Unpin" : "Pin"}">${icon("pin", pinned ? "fill" : "")}</button>
        <button class="glass" data-act="edit" aria-label="Edit">${icon("edit")}</button></div></div></div>
    <div class="detail"><div class="detail-inner">
      ${pills.length ? `<div class="chips" style="margin-bottom:12px">${pills.map(([v, c]) => `<span class="chip static ${c}">${h(v)}</span>`).join("")}</div>` : ""}
      <h1>${h(r.title)}</h1>
      ${r.description ? `<p class="desc">${h(r.description)}</p>` : ""}
      ${drink && r.garnish ? `<p class="garnish">🍒 <b>Garnish</b> ${h(r.garnish)}</p>` : ""}
      ${stats.length ? `<div class="stats" style="grid-template-columns:repeat(${stats.length},1fr)">${stats.map(([k, v]) => `<div class="stat"><b>${h(v).replace(/ min$/, "<small style='font-size:12px'> min</small>")}</b><span>${k}</span></div>`).join("")}</div>` : ""}
      <div class="action-row">
        <button class="action ${S.wake ? "on" : ""}" data-act="wake">${icon("flame")}${S.wake ? "Screen on" : "Cook mode"}</button>
        <button class="action" data-act="share">${icon("share")}Share</button>
        ${r.source_url ? `<a class="action" href="${h(r.source_url)}" target="_blank" rel="noopener">${icon("link")}Source</a>` : `<button class="action" data-act="pin">${icon("pin")}${pinned ? "Unpin" : "Pin"}</button>`}
        <button class="action" data-act="edit">${icon("edit")}Edit</button>
        <button class="action" data-act="add-groc">${icon("cart")}Add to list</button>
      </div>

      <div class="panel"><h3>Your rating <span style="font:600 13px var(--font);color:var(--ink-3)">${mine ? ["", "Meh", "It's ok", "Good", "Really good", "Family favorite!"][mine] : "Tap to rate"}</span></h3>
        <div class="hearts" role="radiogroup" aria-label="Your rating">${[1, 2, 3, 4, 5].map((n) => `<button role="radio" aria-checked="${mine === n}" aria-label="${n} heart${n > 1 ? "s" : ""}" data-rate="${n}" class="${n <= mine ? "on" : ""}">${icon("heart", "fill")}</button>`).join("")}</div>
        ${famRows.length ? `<div style="margin-top:12px">${famRows.map(({ f, s }) => `<div class="fam-row"><span class="dot" style="background:${f.color}"></span>
          <div><b style="font-weight:600">${h(f.name)}</b><div class="who">${s.list.map((x) => h(profile(x.user_id)?.display_name || "Someone") + " " + x.score + "♥").join(" · ")}</div></div>
          <span class="avg">${miniHearts(s.avg)} ${s.avg.toFixed(1)}</span></div>`).join("")}</div>` : ""}
      </div>

      ${r.ingredients.length ? `<div class="panel"><h3>Ingredients ${scalable ? `<span class="segmented" role="group" aria-label="Scale">${[[0.5, "½×"], [1, "1×"], [2, "2×"], [3, "3×"]].map(([v, l]) => `<button data-scale="${v}" aria-pressed="${S.scale === v}">${l}</button>`).join("")}</span>` : ""}</h3>
        ${ingList(r.ingredients, dkey, S.scale)}</div>` : ""}
      ${r.steps.length ? `<div class="panel"><h3>Instructions</h3>${stepList(r.steps, dkey)}</div>` : ""}
      ${paired.length ? `<div class="panel"><h3>Wine pairings <span style="font:600 13px var(--font);color:var(--ink-3)">from your vault</span></h3>
        ${paired.map((w) => wineLinkHtml(w)).join("")}</div>` : ""}
      ${r.notes ? `<div class="panel"><h3>Notes</h3><p style="margin:0;white-space:pre-wrap;color:var(--ink-2)">${h(r.notes)}</p></div>` : ""}
      ${r.credit ? `<p style="margin:16px 0 0"><span class="credit">${icon("users", "sm")} From ${h(r.credit)}</span></p>` : ""}
      ${r.tags?.length ? `<div class="chips" style="margin-top:18px">${r.tags.map((t) => `<span class="chip static lav">#${h(t)}</span>`).join("")}</div>` : ""}
    </div></div>`;
}

async function toggleWake() {
  if (S.wake) return releaseWake(), renderDetail();
  try { S.wake = await navigator.wakeLock.request("screen"); S.wake.addEventListener("release", () => { S.wake = null; }); toast("Screen will stay on while you cook"); }
  catch { toast("Cook mode isn't supported on this browser"); }
  renderDetail();
}
function releaseWake() { try { S.wake?.release(); } catch { /* */ } S.wake = null; }

async function togglePin(id) {
  const on = !S.pins.has(id);
  on ? S.pins.set(id, new Date().toISOString()) : S.pins.delete(id);
  if (S.detail?.id === id) renderDetail();
  renderHome(); renderPinned(); renderBarList();
  toast(on ? "Pinned 📌" : "Unpinned");
  try { await store.setPin(id, on); } catch (e) { toast(e.message); }
}
async function rate(id, n) {
  const cur = myScore(id);
  const score = cur === n ? 0 : n;
  S.ratings = S.ratings.filter((r) => !(r.recipe_id === id && r.user_id === S.me.id));
  if (score) S.ratings.push({ user_id: S.me.id, recipe_id: id, score });
  if (S.detail?.id === id) { renderDetail(); $(`#detailSheet [data-rate="${n}"]`)?.classList.add("pop"); }
  renderHome(); renderPinned(); renderFavorites(); renderBarList();
  $(`#list [data-item="${id}"] [data-rate="${n}"]`)?.classList.add("pop");
  $(`#barList [data-item="${id}"] [data-rate="${n}"]`)?.classList.add("pop");
  try { await store.setRating(id, score); } catch (e) { toast(e.message); }
}

// ------------------------------------------------------------------ editor
let E = null;
const blank = () => ({ id: null, title: "", description: "", image_url: "", source_url: "", course: "", cuisine: "", protein: "", difficulty: "",
  prep_min: "", cook_min: "", total_min: "", servings: "", tags: [], notes: "", credit: "", ingText: "", stepText: "",
  spirit: "", method: "", glass: "", garnish: "" });

async function openEditor(id, preset = null) {
  if (id) {
    const r = S.detail?.id === id ? S.detail : await store.getRecipe(id);
    E = { ...blank(), ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? ""])), tags: [...(r.tags || [])],
      ingText: ingredientsToText(r.ingredients), stepText: stepsToText(r.steps) };
  } else E = { ...blank(), ...(preset || {}) };
  E._drink = isDrink(E);
  renderEditor();
  $("#editorSheet").scrollTop = 0;
  openSheet("editorSheet");
  if (!id) setTimeout(() => $("#impUrl")?.focus({ preventScroll: true }), 450);
}

const dl = (id, list, extra) => `<datalist id="${id}">${[...new Set([...list, ...extra.filter(Boolean)])].map((v) => `<option value="${h(v)}">`).join("")}</datalist>`;
function renderEditor() {
  const known = (k) => S.recipes.map((r) => r[k]);
  const drink = isDrink(E), noun = drink ? "Cocktail" : "Recipe";
  $("#editorSheet").innerHTML = `
    <div class="sheet-bar"><button class="bar-btn l" data-act="cancel-edit">Cancel</button><h2>${E.id ? `Edit ${noun}` : `New ${noun}`}</h2>
      <button class="bar-btn strong r" data-act="save" id="saveBtn">Save</button></div>
    <div class="sheet-body">
      ${E.id ? "" : `<div class="import"><h3>${icon("wand")} Import from a link</h3><p>Paste a link from any ${drink ? "cocktail or " : ""}recipe site and we'll fill everything in.</p>
        <div class="line"><input class="field" id="impUrl" type="url" inputmode="url" placeholder="https://…" autocomplete="off" enterkeyhint="go">
          <button class="btn mint sm" style="height:46px" data-act="import" id="impBtn">Import</button></div>
        <div style="display:flex;gap:16px;margin-top:10px">
          <button class="link-btn" style="color:var(--mint-deep)" data-act="paste-clip">${icon("clip", "sm")} Paste from clipboard</button>
          <button class="link-btn" style="color:var(--mint-deep)" data-act="toggle-paste-text">Paste recipe text</button></div>
        <div id="pasteText" hidden><textarea class="field" id="pasteArea" style="height:140px;padding:12px 14px;margin-top:8px;font-size:16px" placeholder="Paste the whole recipe — title, ingredients and steps. We'll sort it out."></textarea>
          <button class="btn soft sm" style="margin-top:8px" data-act="sort-text">Sort it out</button></div>
      </div>`}

      <div class="photo ${E.image_url ? "has" : ""}" data-act="photo" role="button" aria-label="Add photo">
        ${E.image_url ? `<img src="${h(E.image_url)}" alt=""><span class="btn sm change">${icon("camera", "sm")} Change</span>` : `<span class="ph">${icon("camera")}Add a photo</span>`}
      </div>
      <div class="photo-links"><button class="link-btn" data-act="img-url">Use an image link</button>${E.image_url ? `<button class="link-btn" style="color:var(--ink-3)" data-act="img-clear">Remove photo</button>` : ""}</div>
      <div id="imgUrlRow" hidden class="group" style="margin-top:6px"><div class="row"><input data-k="image_url" type="url" placeholder="https://…/photo.jpg" value="${h(E.image_url)}"></div></div>

      <div class="group-title">${noun}</div>
      <div class="group">
        <div class="row"><input data-k="title" placeholder="${drink ? "Cocktail name" : "Recipe name"}" value="${h(E.title)}" style="font-weight:650;font-size:19px" autocapitalize="words"></div>
        <div class="row"><textarea data-k="description" rows="2" placeholder="A short description (optional)">${h(E.description)}</textarea></div>
      </div>

      <div class="group-title">Details</div>
      <div class="group">
        <div class="row"><label>Course</label><input data-k="course" list="dlCourse" placeholder="Dinner" value="${h(E.course)}" autocapitalize="words"></div>
        ${drink ? `<div class="row"><label>Spirit</label><input data-k="spirit" list="dlSpirit" placeholder="Bourbon" value="${h(E.spirit)}" autocapitalize="words"></div>
        <div class="row"><label>Glass</label><input data-k="glass" list="dlGlass" placeholder="Coupe" value="${h(E.glass)}" autocapitalize="words"></div>
        <div class="row"><label>Garnish</label><input data-k="garnish" placeholder="Orange peel, cherry…" value="${h(E.garnish)}"></div>
        <div class="seg-row"><div class="segmented" id="methSeg" role="group" aria-label="Method">${METHODS.map((m) => `<button data-meth="${m}" aria-pressed="${E.method === m}">${m}</button>`).join("")}</div></div>`
        : `<div class="row"><label>Cuisine</label><input data-k="cuisine" list="dlCuisine" placeholder="Italian" value="${h(E.cuisine)}" autocapitalize="words"></div>
        <div class="row"><label>Protein</label><input data-k="protein" list="dlProtein" placeholder="Chicken" value="${h(E.protein)}" autocapitalize="words"></div>`}
        <div class="row"><label>Serves</label><input data-k="servings" placeholder="4" value="${h(E.servings)}" inputmode="text"></div>
        <div class="seg-row"><div class="segmented" id="diffSeg" role="group" aria-label="Difficulty">${["Easy", "Medium", "Hard"].map((d) => `<button data-diff="${d}" aria-pressed="${E.difficulty === d}">${d}</button>`).join("")}</div></div>
      </div>
      ${dl("dlCourse", COURSES, known("course"))}${dl("dlCuisine", CUISINES, known("cuisine"))}${dl("dlProtein", PROTEINS, known("protein"))}${dl("dlCredit", [], known("credit"))}${dl("dlSpirit", SPIRITS, known("spirit"))}${dl("dlGlass", GLASSES, known("glass"))}
      ${drink && !S.barReady ? `<p class="hint" style="color:var(--blush-deep)">Spirit, glass, garnish and method save once <b>008_bar.sql</b> has been run in Supabase.</p>` : ""}

      <div ${drink ? "hidden" : ""}><div class="group-title">Time (minutes)</div>
      <div class="group"><div class="pair">
        <div class="row"><label>Prep</label><input data-k="prep_min" inputmode="numeric" placeholder="0" value="${h(E.prep_min)}"></div>
        <div class="row"><label>Cook</label><input data-k="cook_min" inputmode="numeric" placeholder="0" value="${h(E.cook_min)}"></div></div>
        <div class="row"><label>Total</label><input data-k="total_min" inputmode="numeric" id="totalIn" placeholder="auto" value="${h(E.total_min)}" style="text-align:right"></div>
      </div></div>

      <div class="group-title">Ingredients</div>
      <div class="group">
        <div class="row stack"><textarea data-k="ingText" id="ingText" rows="5" placeholder="${drink ? "2 oz bourbon&#10;1/4 oz simple syrup&#10;2 dashes Angostura bitters" : "2 cups flour&#10;1 tsp salt&#10;3 eggs, beaten&#10;&#10;Frosting:&#10;1 cup powdered sugar"}">${h(E.ingText)}</textarea></div>
        <button class="parsed-toggle" data-act="toggle-parsed" id="parsedToggle"></button>
        <ul class="parsed" id="parsed" hidden></ul>
      </div>
      <p class="hint">One per line — paste straight from a website or text. End a line with a colon to start a section (“Frosting:”).</p>

      <div class="group-title">Steps</div>
      <div class="group"><div class="row stack"><textarea data-k="stepText" id="stepText" rows="5" placeholder="${drink ? "Stir with ice until well chilled.&#10;Strain over a large cube.&#10;…" : "Preheat the oven to 350°F.&#10;Whisk the dry ingredients.&#10;…"}">${h(E.stepText)}</textarea></div></div>
      <p class="hint">One step per line. Numbers like “1.” are cleaned up for you.</p>

      <div class="group-title">Tags</div>
      <div class="group"><div class="tag-input" id="tagBox">${E.tags.map((t) => `<button class="chip" data-untag="${h(t)}">#${h(t)} ${icon("x", "sm")}</button>`).join("")}
        <input id="tagIn" placeholder="${E.tags.length ? "Add tag" : "kid friendly, weeknight…"}" enterkeyhint="done" autocapitalize="none"></div></div>
      <div class="suggest">${[...new Set([...S.recipes.flatMap((r) => r.tags || []), ...TAG_IDEAS])].filter((t) => !E.tags.includes(t)).slice(0, 10).map((t) => `<button class="chip" data-tag="${h(t)}">+ ${h(t)}</button>`).join("")}</div>

      <div class="group-title">Notes & source</div>
      <div class="group">
        <div class="row"><textarea data-k="notes" rows="3" placeholder="Swaps, tips, who loves it…">${h(E.notes)}</textarea></div>
        <div class="row"><label>From</label><input data-k="credit" list="dlCredit" placeholder="Who shared it (Grandma, a friend…)" value="${h(E.credit)}" autocapitalize="words"></div>
        <div class="row"><label>Source</label><input data-k="source_url" type="url" inputmode="url" placeholder="Website link" value="${h(E.source_url)}"></div>
      </div>

      <button class="btn primary block" style="margin-top:26px" data-act="save">Save ${noun.toLowerCase()}</button>
      ${E.id ? `<button class="btn danger block" style="margin-top:12px" data-act="delete">${icon("trash", "sm")} Delete ${noun.toLowerCase()}</button>` : ""}
    </div>`;
  updateParsed(); autoTotal();
  for (const ta of $$("#editorSheet textarea")) autosize(ta);
}

function autosize(ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight + 2, 520) + "px"; }
function autoTotal() {
  const t = $("#totalIn"); if (!t) return;
  const sum = (+E.prep_min || 0) + (+E.cook_min || 0);
  t.placeholder = sum ? `${sum} (auto)` : "auto";
}
function updateParsed() {
  const rows = parseIngredientBlock(E.ingText);
  const tg = $("#parsedToggle"), ul = $("#parsed"); if (!tg) return;
  tg.hidden = !rows.length;
  tg.innerHTML = `${icon("check", "sm")} ${rows.length} ingredient${rows.length === 1 ? "" : "s"} recognized · ${ul.hidden ? "Preview" : "Hide"}`;
  let sec = "";
  ul.innerHTML = rows.map((r) => {
    let pre = "";
    if (r.section !== sec) { sec = r.section; if (sec) pre = `<li class="sec">${h(sec)}</li>`; }
    return pre + `<li><span class="q">${h([r.quantity, r.unit].filter(Boolean).join(" ")) || "—"}</span><span>${h(r.name)}${r.note ? ` <span style="color:var(--ink-3)">· ${h(r.note)}</span>` : ""}</span></li>`;
  }).join("");
}
const updateParsedSoon = debounce(updateParsed, 200);

function addTag(t) {
  t = t.trim().toLowerCase().replace(/^#/, "");
  if (t && !E.tags.includes(t)) E.tags.push(t);
  rerenderKeepScroll();
}
function rerenderKeepScroll(focusSel) {
  const sh = $("#editorSheet"), y = sh.scrollTop;
  renderEditor(); sh.scrollTop = y;
  if (focusSel) $(focusSel)?.focus({ preventScroll: true });
}

function applyImport(r) {
  Object.assign(E, {
    title: r.title || E.title, description: r.description || E.description, image_url: r.image_url || E.image_url,
    source_url: r.source_url || E.source_url, servings: r.servings || E.servings, course: matchList(r.course, COURSES) || E.course,
    cuisine: matchList(r.cuisine, CUISINES) || E.cuisine, prep_min: r.prep_min ?? E.prep_min, cook_min: r.cook_min ?? E.cook_min,
    total_min: r.total_min ?? E.total_min, tags: [...new Set([...E.tags, ...(r.tags || [])])].slice(0, 10),
    notes: E.notes || r.notes || "",
  });
  if (r.ingredients?.length) E.ingText = r.ingredients.join("\n");
  if (r.steps?.length) E.stepText = stepsToText(r.steps);
  if (!E.protein) E.protein = guessProtein(E.ingText) || "";
  if (!E.difficulty && totalOf(E)) E.difficulty = (+E.total_min || (+E.prep_min || 0) + (+E.cook_min || 0)) <= 35 && r.ingredients?.length <= 10 ? "Easy" : "";
  rerenderKeepScroll();
}
function matchList(v, list) {
  if (!v) return "";
  const s = String(v).split(/[,/]/)[0].trim();
  return list.find((x) => x.toLowerCase() === s.toLowerCase()) || s.replace(/\b\w/g, (c) => c.toUpperCase());
}
function guessProtein(text) {
  const t = text.toLowerCase();
  const map = [["Chicken", /chicken/], ["Beef", /\bbeef|steak|chuck|brisket/], ["Pork", /pork|bacon|sausage|ham\b/], ["Turkey", /turkey/], ["Seafood", /salmon|shrimp|tuna|cod|fish|crab|scallop/]];
  return map.find(([, re]) => re.test(t))?.[0];
}

async function doImport(url) {
  url = (url || $("#impUrl")?.value || "").trim();
  if (!/^https?:\/\//i.test(url)) { if (url) url = "https://" + url; else return toast("Paste a recipe link first"); }
  const btn = $("#impBtn"); btn.disabled = true; btn.innerHTML = `<span class="spin"></span>`;
  try {
    const r = await store.importUrl(url);
    applyImport(r);
    toast(r.partial ? "Got the basics — add ingredients & steps below" : "Imported! Give it a quick look, then Save ✨");
  } catch (e) {
    toast(e.message);
    E.source_url = E.source_url || url;
    btn.disabled = false; btn.textContent = "Import";
  }
}

async function saveRecipe() {
  if (!E.title.trim()) { toast("Give your recipe a name"); $('[data-k="title"]')?.focus(); return; }
  const payload = {
    id: E.id || null, title: E.title.trim(), description: E.description, source_url: E.source_url, image_url: E.image_url,
    course: E.course.trim(), cuisine: E.cuisine.trim(), protein: E.protein.trim(), difficulty: E.difficulty,
    prep_min: toInt(E.prep_min), cook_min: toInt(E.cook_min),
    total_min: toInt(E.total_min) ?? ((toInt(E.prep_min) || 0) + (toInt(E.cook_min) || 0) || null),
    servings: String(E.servings || "").trim(), tags: E.tags, notes: E.notes, credit: String(E.credit || "").trim(),
    ingredients: parseIngredientBlock(E.ingText), steps: parseStepBlock(E.stepText),
    spirit: String(E.spirit || "").trim(), method: E.method || "", glass: String(E.glass || "").trim(), garnish: String(E.garnish || "").trim(),
  };
  const drink = isDrink(payload), hasDrinkFields = payload.spirit || payload.method || payload.glass || payload.garnish;
  for (const b of $$('[data-act="save"]')) b.disabled = true;
  try {
    const id = await store.saveRecipe(payload);
    let drinkErr = null;
    if (S.barReady && (drink || hasDrinkFields)) {
      try { await store.saveDrinkFields(id, drink ? payload : { spirit: "", method: "", glass: "", garnish: "" }); } catch (er) { drinkErr = er; }
    }
    await reload();
    S.detail = null;
    closeSheet("editorSheet");
    toast(drinkErr ? `Saved, but the cocktail details didn't: ${drinkErr.message}` : E.id ? "Saved" : drink ? "Added to the bar 🍸" : "Added to the recipe box 🍑");
    if (E.id) { depth = Math.max(0, depth - 1); history.replaceState(null, "", "#/r/" + id); route(); }
    else { history.replaceState(null, "", "#/r/" + id); route(); }
  } catch (e) {
    toast(e.message);
    for (const b of $$('[data-act="save"]')) b.disabled = false;
  }
}
const toInt = (v) => (v === "" || v == null || isNaN(parseInt(v, 10)) ? null : parseInt(v, 10));

async function deleteRecipe() {
  const btn = $('[data-act="delete"]');
  if (!btn.dataset.confirm) { btn.dataset.confirm = "1"; btn.innerHTML = `${icon("trash", "sm")} Tap again to delete forever`; return; }
  try {
    await store.deleteRecipe(E.id);
    await reload();
    S.detail = null; closeSheet("editorSheet"); closeSheet("detailSheet");
    depth = 0; history.replaceState(null, "", "#/" + S.tab); route();
    toast(isDrink(E) ? "Cocktail deleted" : "Recipe deleted");
  } catch (e) { toast(e.message); }
}

// ------------------------------------------------------------------ send a recipe to another family
let shareTargets = [];
const shareBar = () => `<div class="sheet-bar"><button class="bar-btn l" data-act="close-share">Cancel</button><h2>Send recipe</h2><span></span></div>`;
const shareErr = (m) => (/function|schema cache|share_/i.test(m) ? "Sending isn't set up yet — run 006_share_recipes.sql in Supabase" : m);

async function openShare() {
  if (!S.detail) return;
  const sheet = $("#shareSheet");
  sheet.innerHTML = `${shareBar()}<div class="sheet-body"><div class="skeleton" style="height:120px;border-radius:24px;margin-top:16px"></div></div>`;
  sheet.scrollTop = 0;
  openSheet("shareSheet");
  try { shareTargets = await store.shareTargets(); }
  catch (e) { shareTargets = []; toast(shareErr(e.message)); }
  renderShare();
}
function renderShare() {
  const r = S.detail; if (!r) return;
  $("#shareSheet").innerHTML = `${shareBar()}<div class="sheet-body">
    <p class="hint" style="margin:14px 4px 0">Sends a copy of <b>${h(r.title)}</b> — ingredients, steps and photo — straight into their recipe box. Your copy stays put, and edits on either side won't affect the other.</p>
    <div class="group-title">Send to</div>
    <div class="group">${shareTargets.length
      ? shareTargets.map((f) => `<button class="row" style="width:100%" data-sharefam="${f.id}"><span class="dot" style="background:${f.color}"></span><span style="flex:1;text-align:left">${h(f.name)} family</span>${icon("share", "sm")}</button>`).join("")
      : `<div class="row" style="color:var(--ink-3);padding:14px 16px;line-height:1.45">No other families yet. Once another family has a login (see the setup guide), they'll show up here.</div>`}</div>
    <div class="group-title">Someone not on the app?</div>
    <div class="group"><button class="row" style="width:100%" data-act="share-text"><span style="flex:1;text-align:left">Share as text…</span>${icon("share", "sm")}</button></div>
  </div>`;
}
async function doShare(famId) {
  const r = S.detail, f = shareTargets.find((x) => x.id === famId);
  if (!r || !f) return;
  const btn = $(`[data-sharefam="${famId}"]`); btn?.setAttribute("disabled", "");
  try {
    const id = await store.shareRecipe(r.id, famId);
    closeSheet("shareSheet");
    toast(id ? `Sent “${r.title}” to the ${f.name} family 📨` : `The ${f.name} family already has “${r.title}”`);
  } catch (e) { btn?.removeAttribute("disabled"); toast(shareErr(e.message)); }
}
function shareAsText() {
  const r = S.detail; if (!r) return;
  const meta = (isDrink(r) ? [r.spirit, r.method, r.glass && `${r.glass} glass`, r.garnish && `Garnish: ${r.garnish}`]
    : [r.servings && `Serves ${r.servings}`, totalOf(r) && `Total ${fmtMin(totalOf(r))}`]).filter(Boolean).join(" · ");
  const text = [r.title, r.description, meta].filter(Boolean).join("\n")
    + `\n\nINGREDIENTS\n${ingredientsToText(r.ingredients)}\n\nINSTRUCTIONS\n${stepsToText(r.steps)}`
    + (r.notes ? `\n\nNOTES\n${r.notes}` : "") + (r.credit ? `\n\nFrom ${r.credit}` : "");
  closeSheet("shareSheet");
  if (navigator.share) return navigator.share({ title: r.title, text }).catch(() => {});
  navigator.clipboard?.writeText(text).then(() => toast("Recipe copied"), () => toast("Couldn't copy — try again"));
}

// ------------------------------------------------------------------ meal roulette
const RL = { n: 1, slots: [], spinning: false };
const RL_H = 72; // keep in sync with .rl-reel / .rl-cell height in index.html
const rlPool = () => foodRecipes().filter((r) => matches(r));
const rlPicks = () => RL.slots.map((x) => x.id).filter((id) => id && byId(id));
const rlShuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function rlSlotHtml(sl, i) {
  const r = sl.id && byId(sl.id);
  if (!r) return `<div class="rl-slot empty"><span class="rl-q">?</span><span class="mid"><h3>Meal ${i + 1}</h3><span class="meta">Tap spin</span></span></div>`;
  return `<div class="rl-slot ${sl.locked ? "locked" : ""}">
    <button class="rl-main" data-open="${r.id}"><span class="tn">${thumb(r)}</span><span class="mid"><h3>${h(r.title)}</h3><span class="meta">${metaLine(r)}</span></span></button>
    <button class="circle-btn sm ${sl.locked ? "on" : ""}" data-rlock="${i}" aria-pressed="${!!sl.locked}" aria-label="${sl.locked ? "Unlock" : "Keep"} this meal">${icon("lock", "sm")}</button>
    <button class="circle-btn sm" data-rroll="${i}" aria-label="Re-roll this meal">${icon("dice", "sm")}</button>
  </div>`;
}
function openRoulette() {
  RL.slots = []; RL.spinning = false;
  renderRoulette();
  $("#rouletteSheet").scrollTop = 0;
  openSheet("rouletteSheet");
}
function renderRoulette() {
  const sheet = $("#rouletteSheet"), y = sheet.scrollTop;
  const pool = rlPool(), n = Math.min(RL.n, pool.length);
  if (RL.slots.length !== n) RL.slots = Array.from({ length: n }, () => ({ id: null, locked: false }));
  const picks = rlPicks();
  const sum = [S.q && `“${S.q}”`, ...Object.values(S.filters).flatMap((set) => [...set])].filter(Boolean);
  sheet.innerHTML = `
    <div class="sheet-bar"><button class="bar-btn l strong" data-act="close-roulette">Done</button><h2>Meal Roulette</h2><span></span></div>
    <div class="sheet-body">
      <p class="rl-pool"><b>${pool.length}</b> recipe${pool.length === 1 ? "" : "s"} in the mix${sum.length ? ` · ${sum.map(h).join(", ")}` : " · no filters set, so everything's fair game"}${pool.length && RL.n > pool.length ? ` · only ${pool.length} to pick from` : ""}</p>
      <div class="rl-tips">${S.filters.course?.size ? "" : `<button class="chip" data-act="rl-mains">${icon("bowl", "sm")} Entrées only</button>`}<button class="chip" data-act="rl-filters">${icon("sliders", "sm")} Edit filters</button></div>
      <div class="segmented rl-seg" role="group" aria-label="How many meals">${[[1, "Tonight"], [3, "3 meals"], [5, "5 meals"], [7, "7 meals"]].map(([v, l]) => `<button data-rln="${v}" aria-pressed="${RL.n === v}">${l}</button>`).join("")}</div>
      ${pool.length ? `<div id="rlSlots">${RL.slots.map(rlSlotHtml).join("")}</div>
        <button class="btn primary block rl-spin" data-act="rl-spin">${icon("dice")} ${picks.length ? "Spin again" : "Spin"}</button>
        ${picks.length ? `<div class="rl-actions"><button class="btn mint sm" data-act="rl-groc">${icon("cart", "sm")} Add all to grocery list</button><button class="btn soft sm" data-act="rl-pin">${icon("pin", "sm")} Pin all</button></div>
          <p class="hint" style="margin:12px 2px 0">Tap a meal to open it · the lock keeps it when you spin again · the dice re-rolls just that one.</p>` : ""}`
        : emptyState("🔍", "Nothing matches", "Loosen your filters and try again.")}
    </div>`;
  sheet.scrollTop = y;
}
function spinRoulette(only = null) {
  if (RL.spinning) return;
  const pool = rlPool();
  if (!pool.length) return toast("Nothing matches your filters yet");
  const n = Math.min(RL.n, pool.length);
  if (RL.slots.length !== n) RL.slots = Array.from({ length: n }, () => ({ id: null, locked: false }));

  const idxs = only != null ? [only] : RL.slots.map((_, i) => i).filter((i) => !RL.slots[i].locked);
  if (!idxs.length) return toast("Everything's locked — unlock one to spin");
  const held = new Set(RL.slots.filter((x, i) => x.id && !idxs.includes(i)).map((x) => x.id));
  const prev = new Set(idxs.map((i) => RL.slots[i].id).filter(Boolean));
  let avail = rlShuffle(pool.filter((r) => !held.has(r.id)));
  const fresh = avail.filter((r) => !prev.has(r.id)); // prefer something new when there's enough to choose from
  if (fresh.length >= idxs.length) avail = fresh;
  else if (only != null && fresh.length) avail = fresh;
  else if (only != null) return toast("That's the only match — loosen your filters for more options");
  const spun = idxs.slice(0, avail.length);
  const winners = avail.slice(0, spun.length);
  spun.forEach((si, k) => { RL.slots[si].id = winners[k].id; });

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  RL.spinning = true;
  const CELLS = 14;
  const reels = new Map(spun.map((si, k) => [si, {
    titles: [...Array.from({ length: CELLS - 1 }, () => pool[Math.floor(Math.random() * pool.length)].title), winners[k].title],
    dur: 1.1 + k * 0.3,
  }]));
  $("#rlSlots").innerHTML = RL.slots.map((x, i) => {
    const rv = reels.get(i);
    return rv ? `<div class="rl-reel" aria-hidden="true"><div class="rl-strip" style="transition-duration:${rv.dur}s">${rv.titles.map((t) => `<div class="rl-cell">${h(t)}</div>`).join("")}</div></div>` : rlSlotHtml(x, i);
  }).join("");
  $$("#rlSlots .rl-strip").forEach((el) => requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transform = `translateY(-${(CELLS - 1) * RL_H}px)`; })));
  const longest = Math.max(...[...reels.values()].map((v) => v.dur));
  setTimeout(() => { RL.spinning = false; renderRoulette(); navigator.vibrate?.(25); }, reduce ? 0 : longest * 1000 + 120);
}
async function pinPicks() {
  const ids = rlPicks().filter((id) => !S.pins.has(id));
  if (!ids.length) return toast("Those are already pinned");
  const now = new Date().toISOString();
  ids.forEach((id) => S.pins.set(id, now));
  renderHome(); renderPinned();
  toast(`Pinned ${ids.length} meal${ids.length === 1 ? "" : "s"} 📌`);
  try { await Promise.all(ids.map((id) => store.setPin(id, true))); } catch (e) { toast(e.message); }
}

// ------------------------------------------------------------------ change my own password
async function savePassword() {
  const el = $("#mePw"), pw = el.value;
  if (pw.length < 8) { toast("Use at least 8 characters"); return el.focus(); }
  try { await store.updatePassword(pw); el.value = ""; el.blur(); toast("Password saved 🔒"); }
  catch (e) { toast(friendly(e.message)); }
}

// ------------------------------------------------------------------ admin: families & logins
const AD = { families: [], result: null };
const adBar = () => `<div class="sheet-bar"><button class="bar-btn l strong" data-act="close-admin">Done</button><h2>Families &amp; logins</h2><span></span></div>`;
function genPassword() {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; // no look-alikes (0/O, 1/l/I)
  const buf = crypto.getRandomValues(new Uint32Array(12));
  return [...buf].map((n) => abc[n % abc.length]).join("");
}
async function openAdmin() {
  const sheet = $("#adminSheet");
  AD.result = null;
  sheet.innerHTML = `${adBar()}<div class="sheet-body"><div class="skeleton" style="height:160px;border-radius:24px;margin-top:16px"></div></div>`;
  sheet.scrollTop = 0;
  openSheet("adminSheet");
  try { AD.families = await store.adminList(); renderAdmin(); }
  catch (e) { sheet.innerHTML = `${adBar()}<div class="sheet-body">${emptyState("🔌", "Couldn't load", h(e.message))}</div>`; }
}
function renderAdmin() {
  const mine = family(S.me.family_id);
  const famList = AD.families.map((f) => `<div class="ad-fam"><h3><span class="dot" style="background:${h(f.color)}"></span>${h(f.name)}<small>${f.recipes} recipe${f.recipes === 1 ? "" : "s"}</small></h3>
    ${f.members.length ? f.members.map((m) => `<div class="ad-mem">${h(m.email)}${m.is_admin ? `<span class="ad-tag">Admin</span>` : ""}</div>`).join("") : `<div class="ad-mem" style="color:var(--ink-3)">No logins yet</div>`}
    ${viewButtons(f)}</div>`).join("");
  const r = AD.result;
  const body = r ? `<div class="ad-result"><h3>Login created ✅</h3>
      <div>${h(r.family.name)} family${r.created ? " (new)" : ""}${r.copied ? ` · copied ${r.copied} recipe${r.copied === 1 ? "" : "s"}` : ""}</div>
      <code>${h(r.email)}</code><code>${h(r.password)}</code>
      ${r.copy_error ? `<p class="hint" style="margin:0 0 8px;color:var(--blush-deep)">The login was created, but copying recipes failed: ${h(r.copy_error)}</p>` : ""}
      <p class="hint" style="margin:0 0 12px">This is the only time the password is shown. They can change it under Me → Password, or use “Forgot password?” on the sign-in screen.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn mint sm" data-act="admin-copy-invite">${icon("share", "sm")} Copy invite message</button><button class="btn soft sm" data-act="admin-again">Add another</button></div></div>`
    : `<div class="group-title">Add a login</div>
      <div class="group">
        <div class="row"><label for="adFam">Family</label><select id="adFam"><option value="__new">New family…</option>${AD.families.map((f) => `<option value="${h(f.id)}">${h(f.name)}</option>`).join("")}</select></div>
        <div class="row" id="adFamRow"><label for="adFamName">Family name</label><input id="adFamName" placeholder="e.g. Smith" autocapitalize="words" autocomplete="off"></div>
        <div class="row"><label for="adEmail">Email</label><input id="adEmail" type="email" inputmode="email" autocapitalize="none" autocomplete="off" spellcheck="false" placeholder="name@example.com"></div>
        <div class="row"><label for="adName">Name</label><input id="adName" placeholder="Optional" autocapitalize="words" autocomplete="off"></div>
        <div class="row"><label for="adPw">Password</label><input id="adPw" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="8+ characters"><button class="btn soft sm" data-act="admin-gen-pw">Generate</button></div>
        ${mine ? `<label class="row" id="adCopyRow"><input type="checkbox" id="adCopy" style="flex:none;width:20px;height:20px;padding:0"><span style="flex:1;line-height:1.35;padding:10px 0">Start them with a copy of the ${h(mine.name)} recipe book</span></label>` : ""}
      </div>
      <p class="hint">Creates a confirmed login right away — no email needed. Pick an existing family to add another login to it (they share one recipe box).</p>
      <button class="btn primary block" style="margin-top:16px" data-act="admin-create">Create login</button>`;
  const sheet = $("#adminSheet");
  sheet.innerHTML = `${adBar()}<div class="sheet-body">${S.view ? `<div class="ad-viewing" style="--fam:${h(S.view.color)}"><span>${icon(S.view.can_edit ? "edit" : "eye", "sm")} Viewing the <b>${h(S.view.name)}</b> family · ${S.view.can_edit ? "editing" : "read-only"}</span><button class="btn soft sm" data-act="view-stop">Exit</button></div>` : ""}
    <div class="group-title" style="margin-top:14px">Families</div><div class="group">${famList || `<div class="ad-fam" style="color:var(--ink-3)">No families yet</div>`}</div>${body}</div>`;
}
// ------------------------------------------------------------------ admin: view as another family
// The database does the real work (009_admin_view.sql): while viewing, my_family_id() returns their family,
// and read-only mode blocks every write with restrictive RLS policies. The UI just hides what can't be used.
const isRO = () => !!(S.view && !S.view.can_edit);
const viewErr = (m) => (/admin_view|function|schema cache/i.test(m) ? "View-as isn't set up yet — run 009_admin_view.sql in Supabase" : m);
const RO_MSG = "Read-only view — tap the banner's “Allow edits” to make changes";
const WRITE_KEYS = ["rate", "pin", "edit", "groc", "gck", "gdel", "sharefam", "wdrink", "wqty", "wedit", "tag", "untag"];
const WRITE_ACTS = new Set(["new", "bar-new", "pin", "edit", "add-groc", "add-pinned-groc", "add-fav-groc", "add-grocery-item", "clear-checked", "clear-all-grocery",
  "share", "rl-groc", "rl-pin", "save", "delete", "wine-save", "wine-delete", "drink-confirm"]);
const isWriteClick = (d) => WRITE_ACTS.has(d.act) || WRITE_KEYS.some((k) => d[k] != null);

function viewButtons(f) {
  if (f.id === S.me.family_id) return `<div class="ad-mem" style="color:var(--ink-3)">Your family</div>`;
  const on = S.view?.family_id === f.id;
  return `<div class="ad-view">
    <button class="btn sm ${on && !S.view.can_edit ? "mint" : "soft"}" data-viewfam="${h(f.id)}" data-vmode="ro">${icon("eye", "sm")} ${on && !S.view.can_edit ? "Viewing" : "View read-only"}</button>
    <button class="btn sm ${on && S.view.can_edit ? "mint" : "soft"}" data-viewfam="${h(f.id)}" data-vmode="edit">${icon("edit", "sm")} ${on && S.view.can_edit ? "Editing" : "View & edit"}</button></div>`;
}
function applyView() {
  const v = S.view, root = document.documentElement;
  root.classList.toggle("viewing", !!v);
  root.classList.toggle("ro", isRO());
  const b = $("#viewBanner"); if (!b) return;
  b.hidden = !v;
  if (!v) return;
  b.style.setProperty("--fam", v.color || "var(--lav)");
  b.innerHTML = `<span class="vb-dot"></span><span class="vb-txt">${icon(v.can_edit ? "edit" : "eye", "sm")} <b>${h(v.name)}</b></span>
    <span class="vb-mode ${v.can_edit ? "edit" : ""}">${v.can_edit ? "Editing" : "Read-only"}</span>
    <button class="vb-btn" data-act="view-mode">${v.can_edit ? "Make read-only" : "Allow edits"}</button>
    <button class="vb-btn strong" data-act="view-stop">Exit</button>`;
}
function resetBrowseState() {
  S.filters = {}; S.q = ""; S.open.clear(); S.ck.clear(); S.detail = null;
  S.bq = ""; S.spirit.clear(); S.wtype.clear(); S.wopen.clear(); S.showEmpty = false;
  for (const id of ["q", "bq"]) { const el = $("#" + id); if (el) el.value = ""; }
}
async function switchView(familyId, edit) {
  const sameFamily = S.view?.family_id === familyId;
  try { S.view = familyId ? await store.viewStart(familyId, edit) : (await store.viewStop(), null); }
  catch (e) { return toast(viewErr(e.message)); }
  if (!sameFamily) resetBrowseState();
  closeSheet("adminSheet");
  await reload();
  if (!sameFamily) { depth = 0; if (location.hash !== "#/recipes") location.hash = "#/recipes"; else route(); window.scrollTo({ top: 0 }); }
  toast(!S.view ? "Back to your own recipe box 🍑" : sameFamily ? (S.view.can_edit ? "Edits allowed ✏️" : "Read-only again 👀")
    : `Viewing the ${S.view.name} family${S.view.can_edit ? " — edits allowed" : " (read-only)"} 👀`);
}

document.addEventListener("change", (e) => {
  if (e.target.id === "wGroup") { S.wgroup = e.target.value; return renderBar(); }
  if (e.target.id === "wPairIn" && W) return addPairing(e.target.value);
  if (e.target.id !== "adFam") return;
  const isNew = e.target.value === "__new";
  $("#adFamRow").hidden = !isNew;
  if ($("#adCopyRow")) $("#adCopyRow").hidden = !isNew;
});
async function adminCreate() {
  const isNew = $("#adFam").value === "__new";
  const payload = {
    email: $("#adEmail").value.trim().toLowerCase(), display_name: $("#adName").value.trim(), password: $("#adPw").value,
    ...(isNew ? { family_name: $("#adFamName").value.trim(), copy_from: $("#adCopy")?.checked ? S.me.family_id : null } : { family_id: $("#adFam").value }),
  };
  if (isNew && !payload.family_name) { toast("Give the new family a name"); return $("#adFamName").focus(); }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) { toast("That doesn't look like a valid email"); return $("#adEmail").focus(); }
  if (payload.password.length < 8) { toast("Password needs at least 8 characters — tap Generate for one"); return $("#adPw").focus(); }
  const btn = $('[data-act="admin-create"]'); busy(btn, true);
  try {
    const out = await store.adminCreateUser(payload);
    AD.result = { ...out, password: payload.password, created: isNew };
    AD.families = await store.adminList().catch(() => AD.families);
    $("#adminSheet").scrollTop = 0;
    renderAdmin();
  } catch (e) { busy(btn, false, "Create login"); toast(e.message); }
}
async function copyInvite() {
  const r = AD.result; if (!r) return;
  const text = `You're in! 🍑\nOpen ${location.origin} and sign in:\n\nEmail: ${r.email}\nPassword: ${r.password}\n\nOnce you're in, you can change your password under Me → Password.`;
  if (navigator.share) { try { await navigator.share({ title: "Eckert Haus Kitchen login", text }); } catch { /* cancelled */ } return; }
  try { await navigator.clipboard.writeText(text); toast("Invite copied"); } catch { toast("Couldn't copy — select the text above instead"); }
}

// ------------------------------------------------------------------ bar: cocktails + wine vault
const WINE_TYPES = ["Red", "White", "Rosé", "Sparkling", "Dessert", "Fortified", "Orange"];
const WINE_STYLE = { Red: ["🍷", "#FDE9EE", "#F7D0DA"], White: ["🥂", "#FFF5DA", "#FBE9BE"], "Rosé": ["🌸", "#FDE9EE", "#FFE6D8"], Sparkling: ["🍾", "#E0F5EC", "#FFF5DA"],
  Dessert: ["🍯", "#FFF5DA", "#FFE6D8"], Fortified: ["🥃", "#EFEBFC", "#FDE9EE"], Orange: ["🍊", "#FFE6D8", "#FFF5DA"] };
const WINE_TINT = { Red: "blush", White: "butter", "Rosé": "blush", Sparkling: "mint", Dessert: "butter", Fortified: "lav", Orange: "peach" };
const WINE_SIZES = ["375 ml", "750 ml", "1.5 L", "3 L"];
const VARIETALS = ["Cabernet Sauvignon", "Merlot", "Pinot Noir", "Syrah / Shiraz", "Zinfandel", "Malbec", "Tempranillo", "Sangiovese", "Nebbiolo", "Grenache", "Red blend",
  "Chardonnay", "Sauvignon Blanc", "Pinot Grigio", "Riesling", "Chenin Blanc", "Moscato", "White blend", "Champagne blend", "Prosecco", "Port"];
const WINE_PLACES = ["Basement cellar", "Kitchen wine fridge", "Dining room cabinet", "Bar cart", "Garage fridge"];
const OCCASIONS = ["Weeknight dinner", "Date night", "Celebration", "Holiday", "Guests over", "Gave as a gift"];
const WINDOW_ORDER = ["Drink soon", "Ready", "Aging", "Past peak", "No window set"];
const barErr = (m) => (/wine|drink_wine|spirit|schema cache|relation|column/i.test(m) ? "The Bar isn't set up yet — run 008_bar.sql in Supabase" : m);
const yearNow = () => new Date().getFullYear();
const money = (n) => (n == null || n === "" || Number.isNaN(+n) ? "" : "$" + (+n).toLocaleString(undefined, { minimumFractionDigits: +n % 1 ? 2 : 0, maximumFractionDigits: 2 }));
const wineById = (id) => S.wines.find((w) => w.id === id);
const wineName = (w) => [w.producer, w.name].filter(Boolean).join(" ") || "Untitled wine";
const wineWhere = (w) => [w.location, w.zone, w.slot].filter(Boolean).join(" › ");
const pairedRecipes = (wineId) => S.pairings.filter((p) => p.wine_id === wineId).map((p) => byId(p.recipe_id)).filter(Boolean);
const wineLogFor = (wineId) => S.wineLog.filter((l) => l.wine_id === wineId);

function wineWindow(w) {
  const y = yearNow(), f = +w.drink_from || null, b = +w.drink_by || null;
  if (!f && !b) return null;
  if (f && y < f) return { key: "Aging", label: `Aging · ready ${f}`, tint: "lav" };
  if (b && y > b) return { key: "Past peak", label: `Past peak · ${b}`, tint: "blush" };
  if (b && b - y <= 1) return { key: "Drink soon", label: b === y ? "Drink this year" : `Drink by ${b}`, tint: "peach" };
  return { key: "Ready", label: b ? `Ready · through ${b}` : "Ready to drink", tint: "mint" };
}
function wineThumb(w) {
  if (w.image_url) return `<img src="${h(w.image_url)}" alt="" loading="lazy" data-art="${h(JSON.stringify({ title: w.name, course: "Drink" }))}">`;
  const [e, a, b] = WINE_STYLE[w.wine_type] || ["🍷", "#FDE9EE", "#EFEBFC"];
  return `<div class="art" style="background:linear-gradient(145deg,${a},${b})">${e}</div>`;
}
function wineLinkHtml(w) {
  return `<button class="rank wl" data-wine="${w.id}"><span class="tn">${wineThumb(w)}</span>
    <span class="mid"><h4>${h(wineName(w))}</h4><span class="sub">${h([w.vintage || "NV", wineWhere(w)].filter(Boolean).join(" · "))}</span></span>
    <span class="qty ${w.quantity ? "" : "zero"}">×${w.quantity}</span></button>`;
}

// ---------- shared shell
function renderBar() {
  for (const b of $$("#barSeg button")) b.setAttribute("aria-pressed", b.dataset.bar === S.bar);
  const q = $("#bq");
  if (q) q.placeholder = S.bar === "vault" ? "Search wines, regions, where it's stored" : "Search cocktails, spirits, ingredients";
  $("#barNew")?.setAttribute("aria-label", S.bar === "vault" ? "Add a wine" : "Add a cocktail");
  if (!$("#barTools")) return;
  $("#barTools").innerHTML = S.bar === "vault" ? vaultTools() : cocktailTools();
  renderBarList();
}
function renderBarList() {
  const el = $("#barList"); if (!el) return;
  el.innerHTML = S.bar === "vault" ? vaultList() : cocktailList();
}
const renderBarListSoon = debounce(renderBarList, 120);
const barTerms = () => S.bq.toLowerCase().split(/\s+/).filter(Boolean);

// ---------- cocktails
const drinkRecipes = () => S.recipes.filter(isDrink);
function cocktailMatch(r, skipSpirit = false) {
  const terms = barTerms();
  if (terms.length) {
    const hay = [r.title, r.description, r.course, r.spirit, r.method, r.glass, r.garnish, (r.tags || []).join(" "), r.ingredient_names, r.credit].join(" ").toLowerCase();
    if (!terms.every((t) => hay.includes(t))) return false;
  }
  return skipSpirit || !S.spirit.size || S.spirit.has(r.spirit || "Other");
}
function cocktailTools() {
  const counts = new Map();
  for (const r of drinkRecipes()) if (cocktailMatch(r, true)) counts.set(r.spirit || "Other", (counts.get(r.spirit || "Other") || 0) + 1);
  for (const v of S.spirit) if (!counts.has(v)) counts.set(v, 0);
  const rank = (k) => { const i = SPIRITS.indexOf(k); return k === "Other" ? 999 : i < 0 ? 500 : i; };
  const keys = [...counts.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  return keys.length > 1 || S.spirit.size ? `<div class="bar-chips">${keys.map((k) => `<button class="chip" data-spirit="${h(k)}" aria-pressed="${S.spirit.has(k)}">${h(k)} <small>${counts.get(k)}</small></button>`).join("")}</div>` : "";
}
function cocktailList() {
  const all = drinkRecipes(), list = all.filter((r) => cocktailMatch(r));
  if (!list.length) return all.length
    ? emptyState("🔍", "No matches", "Try a different search or spirit.", `<button class="btn soft" data-act="bar-clear">Clear</button>`)
    : emptyState("🍸", "No cocktails yet", "Add your house Old Fashioned, a party punch, or a mocktail for the kids.", `<button class="btn primary" data-act="bar-new">${icon("plus")} Add a cocktail</button>`);
  const map = new Map();
  for (const r of [...list].sort((a, b) => a.title.localeCompare(b.title))) { const k = r.spirit || "Other"; if (!map.has(k)) map.set(k, []); map.get(k).push(r); }
  const rank = (k) => { const i = SPIRITS.indexOf(k); return k === "Other" ? 999 : i < 0 ? 500 : i; };
  const groups = [...map.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
  return `${S.barReady ? "" : setupNote()}<div class="list-meta"><span>${list.length} cocktail${list.length === 1 ? "" : "s"}${list.length < all.length ? ` of ${all.length}` : ""} · by spirit</span></div>
    ${groups.map(([k, items]) => `<section class="lgroup"><div class="lgroup-head"><h2>${h(k)}</h2><span class="n">${items.length}</span></div>
      <div class="list">${items.map(row).join("")}</div></section>`).join("")}`;
}
const setupNote = () => `<div class="demo-note" style="margin-top:12px"><b>One setup step:</b> run <code>supabase/008_bar.sql</code> in the Supabase SQL Editor to turn on the wine vault and cocktail details (spirit, glass, garnish, method).</div>`;

// ---------- wine vault
function wineMatch(w, skipType = false) {
  if (!S.showEmpty && !w.quantity) return false;
  const terms = barTerms();
  if (terms.length) {
    const hay = [w.name, w.producer, w.vintage, w.wine_type, w.varietal, w.region, w.country, w.location, w.zone, w.slot, w.notes, w.pairing_notes, w.purchased_from,
      ...pairedRecipes(w.id).map((r) => r.title)].join(" ").toLowerCase();
    if (!terms.every((t) => hay.includes(t))) return false;
  }
  return skipType || !S.wtype.size || S.wtype.has(w.wine_type || "Other");
}
const WGROUPS = {
  location: { label: "Location", key: (w) => w.location || "Not shelved yet", cmp: (a, b) => (a.zone || "").localeCompare(b.zone || "", undefined, { numeric: true }) || (a.slot || "").localeCompare(b.slot || "", undefined, { numeric: true }) || wineName(a).localeCompare(wineName(b)) },
  type: { label: "Type", key: (w) => w.wine_type || "Other", order: WINE_TYPES },
  region: { label: "Region", key: (w) => [w.region, w.country].filter(Boolean).join(", ") || "Unknown region" },
  vintage: { label: "Vintage", key: (w) => String(w.vintage || "NV"), desc: true },
  window: { label: "Drinking window", key: (w) => wineWindow(w)?.key || "No window set", order: WINDOW_ORDER },
};
function vaultTools() {
  if (!S.barReady) return "";
  const stocked = S.wines.filter((w) => w.quantity > 0);
  const bottles = stocked.reduce((a, w) => a + w.quantity, 0);
  const value = stocked.reduce((a, w) => a + w.quantity * (+(w.value ?? w.price) || 0), 0);
  const soon = stocked.filter((w) => ["Drink soon", "Past peak"].includes(wineWindow(w)?.key)).length;
  const counts = new Map();
  for (const w of S.wines) if (wineMatch(w, true)) counts.set(w.wine_type || "Other", (counts.get(w.wine_type || "Other") || 0) + 1);
  for (const v of S.wtype) if (!counts.has(v)) counts.set(v, 0);
  const keys = [...counts.keys()].sort((a, b) => (WINE_TYPES.indexOf(a) + 1 || 99) - (WINE_TYPES.indexOf(b) + 1 || 99));
  const empties = S.wines.filter((w) => !w.quantity).length;
  return `<div class="tiles four">
      <div class="tile"><b>${bottles}</b><span>Bottles</span></div>
      <div class="tile"><b>${stocked.length}</b><span>Wines</span></div>
      <div class="tile"><b>${value ? money(Math.round(value)) : "—"}</b><span>Value</span></div>
      <button class="tile ${soon ? "alert" : ""}" data-act="wine-soon"><b>${soon}</b><span>Drink soon</span></button></div>
    <div class="toolbar">
      <label class="pill-btn sort-pill" for="wGroup">${icon("sort", "sm")}<select id="wGroup" aria-label="Group wines by">${Object.entries(WGROUPS).map(([k, g]) => `<option value="${k}" ${S.wgroup === k ? "selected" : ""}>${g.label}</option>`).join("")}</select>${icon("down", "sm chev")}</label>
      ${empties ? `<button class="chip" style="margin-left:auto" data-act="wine-empties" aria-pressed="${S.showEmpty}">Finished <small>${empties}</small></button>` : ""}
    </div>
    ${keys.length > 1 || S.wtype.size ? `<div class="bar-chips">${keys.map((k) => `<button class="chip" data-wtype="${h(k)}" aria-pressed="${S.wtype.has(k)}">${(WINE_STYLE[k] || ["🍷"])[0]} ${h(k)} <small>${counts.get(k)}</small></button>`).join("")}</div>` : ""}`;
}
function vaultList() {
  if (!S.barReady) return setupNote().replace("margin-top:12px", "margin-top:4px") + emptyState("🍷", "Wine vault is almost ready", "Run the 008_bar.sql migration in Supabase, then refresh.");
  const list = S.wines.filter((w) => wineMatch(w));
  if (!list.length) return S.wines.length
    ? emptyState("🔍", "No matches", S.showEmpty ? "Try a different search or type." : "Try a different search or type — or show finished bottles.", `<button class="btn soft" data-act="bar-clear">Clear</button>`)
    : emptyState("🍷", "Your vault is empty", "Add the bottles you're keeping — what they are, where they're stored, and when to open them.", `<button class="btn primary" data-act="bar-new">${icon("plus")} Add a wine</button>`);
  const g = WGROUPS[S.wgroup] || WGROUPS.location;
  const map = new Map();
  for (const w of list) { const k = g.key(w); if (!map.has(k)) map.set(k, []); map.get(k).push(w); }
  const rank = (k) => { const i = (g.order || []).indexOf(k); return i < 0 ? 500 : i; };
  const groups = [...map.entries()].sort(([a], [b]) => rank(a) - rank(b) || (g.desc ? (a === "NV") - (b === "NV") || b.localeCompare(a) : a.localeCompare(b)));
  const cmp = g.cmp || ((a, b) => wineName(a).localeCompare(wineName(b)) || (a.vintage || 0) - (b.vintage || 0));
  const n = list.reduce((a, w) => a + (w.quantity || 0), 0);
  return `<div class="list-meta"><span>${list.length} wine${list.length === 1 ? "" : "s"} · ${n} bottle${n === 1 ? "" : "s"} · by ${g.label.toLowerCase()}</span></div>
    ${groups.map(([k, items]) => {
      const b = items.reduce((a, w) => a + (w.quantity || 0), 0);
      return `<section class="lgroup"><div class="lgroup-head"><h2>${h(k)}</h2><span class="n">${b} btl</span></div>
        <div class="list">${items.sort(cmp).map(wineRowHtml).join("")}</div></section>`;
    }).join("")}`;
}
function wineRowHtml(w) {
  const open = S.wopen.has(w.id), win = wineWindow(w);
  const spot = S.wgroup === "location" ? [w.zone, w.slot].filter(Boolean).join(" · ") : w.location;
  const meta = [w.vintage || "NV", w.varietal, w.region || w.country, spot].filter(Boolean).map(h).join(" · ");
  return `<article class="item wine ${open ? "open" : ""}" data-witem="${w.id}">
    <button class="item-head" data-wtoggle="${w.id}" aria-expanded="${open}">
      <span class="tn">${wineThumb(w)}</span>
      <span class="mid"><h3>${h(wineName(w))}</h3><span class="meta">${meta || "&nbsp;"}</span></span>
      <span class="right">${win && w.quantity ? `<span class="wdot ${win.tint}" title="${h(win.label)}"></span>` : ""}<span class="qty ${w.quantity ? "" : "zero"}">×${w.quantity}</span>${icon("down", "sm chev")}</span>
    </button>
    ${open ? wineBody(w) : ""}
  </article>`;
}
function wineBody(w) {
  const win = wineWindow(w), recs = pairedRecipes(w.id), log = wineLogFor(w.id);
  const pills = [[w.wine_type, WINE_TINT[w.wine_type] || "peach"], [w.varietal, "mint"], [[w.region, w.country].filter(Boolean).join(", "), "lav"], [w.size && w.size !== "750 ml" ? w.size : "", "butter"]].filter(([v]) => v);
  const facts = [["Where", wineWhere(w)], ["Vintage", w.vintage || "NV"], ["Window", w.drink_from || w.drink_by ? [w.drink_from || "now", w.drink_by || "—"].join("–") : ""],
    ["Paid", money(w.price)], ["Value", money(w.value)], ["From", w.purchased_from], ["Bought", w.purchased_on ? new Date(w.purchased_on + "T12:00").toLocaleDateString(undefined, { month: "short", year: "numeric" }) : ""]].filter(([, v]) => v);
  const who = (id) => profile(id)?.display_name || "";
  return `<div class="item-body">
    <div class="chips">${pills.map(([v, c]) => `<span class="chip static ${c}">${h(v)}</span>`).join("")}${win ? `<span class="chip static ${win.tint}">${h(win.label)}</span>` : ""}</div>
    ${facts.length ? `<div class="facts">${facts.map(([k, v]) => `<span>${k} <b>${h(v)}</b></span>`).join("")}</div>` : ""}
    <div class="item-actions">
      <button class="mini-btn on" data-wdrink="${w.id}" ${w.quantity ? "" : "disabled"}>${icon("glass", "sm")}Open a bottle</button>
      <span class="stepper" role="group" aria-label="Bottles on hand">
        <button class="mini-btn" data-wqty="${w.id}" data-d="-1" aria-label="One fewer bottle" ${w.quantity ? "" : "disabled"}>${icon("minus", "sm")}</button>
        <b>${w.quantity}</b>
        <button class="mini-btn" data-wqty="${w.id}" data-d="1" aria-label="One more bottle">${icon("plus", "sm")}</button></span>
      <button class="mini-btn" data-wedit="${w.id}" style="margin-left:auto">${icon("edit", "sm")}Edit</button>
    </div>
    ${w.pairing_notes || recs.length ? `<details class="sub" open>
      <summary><span class="ico" style="background:var(--peach-soft);color:#B8583A">${icon("bowl", "sm")}</span>Pairs with<span class="cnt">${recs.length ? `${recs.length} recipe${recs.length === 1 ? "" : "s"}` : ""}</span>${icon("down", "sm chev")}</summary>
      <div class="inner">${w.pairing_notes ? `<p class="pair-notes">${h(w.pairing_notes)}</p>` : ""}
        ${recs.length ? `<div class="chips">${recs.map((r) => `<button class="chip peach" data-open="${r.id}">${h(r.title)}</button>`).join("")}</div>` : ""}</div></details>` : ""}
    ${log.length ? `<details class="sub">
      <summary><span class="ico" style="background:var(--lav-soft);color:var(--lav-deep)">${icon("clock", "sm")}</span>Opened<span class="cnt">${log.reduce((a, l) => a + l.bottles, 0)} bottle${log.reduce((a, l) => a + l.bottles, 0) === 1 ? "" : "s"}</span>${icon("down", "sm chev")}</summary>
      <div class="inner"><ul class="wlog">${log.map((l) => `<li><span class="when">${new Date(l.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
        <span class="what">${l.bottles > 1 ? `<b>${l.bottles} bottles</b> · ` : ""}${h(l.occasion || "Opened")}${l.note ? ` <span class="note">— ${h(l.note)}</span>` : ""}${who(l.user_id) ? ` <span class="note">· ${h(who(l.user_id))}</span>` : ""}</span></li>`).join("")}</ul></div></details>` : ""}
    ${w.notes ? `<div class="item-notes">${h(w.notes)}</div>` : ""}
  </div>`;
}
async function bumpWine(id, d) {
  const w = wineById(id); if (!w) return;
  const q = Math.max(0, (w.quantity || 0) + d);
  if (q === w.quantity) return;
  w.quantity = q; renderBar();
  try { await store.setWineQty(id, q); } catch (e) { toast(barErr(e.message)); }
}

// ---------- open-a-bottle sheet
const DK = { id: null, n: 1, occasion: "" };
function openDrink(id) {
  const w = wineById(id); if (!w || !w.quantity) return;
  Object.assign(DK, { id, n: 1, occasion: "" });
  renderDrink(); $("#drinkSheet").scrollTop = 0; openSheet("drinkSheet");
}
function renderDrink() {
  const w = wineById(DK.id); if (!w) return closeSheet("drinkSheet");
  const recs = pairedRecipes(w.id);
  $("#drinkSheet").innerHTML = `<div class="sheet-bar"><button class="bar-btn l" data-act="drink-cancel">Cancel</button><h2>Open a bottle</h2><span></span></div>
    <div class="sheet-body">
      <div class="rank wl" style="margin-top:14px;box-shadow:none"><span class="tn">${wineThumb(w)}</span><span class="mid"><h4>${h(wineName(w))}</h4><span class="sub">${h([w.vintage || "NV", wineWhere(w)].filter(Boolean).join(" · "))}</span></span><span class="qty">×${w.quantity}</span></div>
      ${w.quantity > 1 ? `<div class="group-title">How many</div><div class="seg-row" style="padding:0"><div class="segmented" style="width:100%">${Array.from({ length: Math.min(w.quantity, 6) }, (_, i) => i + 1).map((n) => `<button style="flex:1" data-dkn="${n}" aria-pressed="${DK.n === n}">${n}</button>`).join("")}</div></div>` : ""}
      <div class="group-title">Occasion</div>
      <div class="group"><div class="row"><input id="dkOcc" placeholder="Anniversary dinner, Tuesday…" value="${h(DK.occasion)}" autocapitalize="sentences"></div>
        <div class="row stack"><textarea id="dkNote" rows="2" placeholder="How was it? (optional)"></textarea></div></div>
      <div class="suggest">${[...recs.map((r) => r.title), ...OCCASIONS].slice(0, 8).map((o) => `<button class="chip" data-dkocc="${h(o)}">${h(o)}</button>`).join("")}</div>
      <button class="btn primary block" style="margin-top:22px" data-act="drink-confirm">${icon("glass")} Open ${DK.n > 1 ? `${DK.n} bottles` : "it"}</button>
      <p class="hint" style="text-align:center">Takes ${DK.n === 1 ? "one bottle" : `${DK.n} bottles`} out of the vault and adds ${DK.n === 1 ? "it" : "them"} to this wine's history.</p>
    </div>`;
}
async function confirmDrink() {
  const w = wineById(DK.id); if (!w) return;
  const btn = $('[data-act="drink-confirm"]'); busy(btn, true);
  try {
    const left = await store.drinkWine(w.id, DK.n, $("#dkOcc").value.trim(), $("#dkNote").value.trim());
    closeSheet("drinkSheet");
    await reload();
    toast(left ? `Cheers! ${left} left in the vault 🍷` : "Cheers! That was the last one 🍷");
  } catch (e) { busy(btn, false, `${icon("glass")} Open it`); toast(barErr(e.message)); }
}

// ---------- wine editor
let W = null;
const wBlank = () => ({ id: null, name: "", producer: "", vintage: "", wine_type: "Red", varietal: "", region: "", country: "", size: "750 ml", quantity: 1,
  location: "", zone: "", slot: "", drink_from: "", drink_by: "", price: "", value: "", purchased_from: "", purchased_on: "", pairing_notes: "", notes: "", image_url: "", recipes: [] });
async function openWineEditor(id) {
  if (!S.barReady) { toast("The Bar isn't set up yet — run 008_bar.sql in Supabase"); return back("#/bar"); }
  if (id) {
    const w = wineById(id);
    if (!w) { toast("That wine was removed."); return back("#/bar"); }
    W = { ...wBlank(), ...Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v ?? ""])), recipes: pairedRecipes(id).map((r) => r.id) };
  } else W = wBlank();
  renderWineEditor();
  $("#wineSheet").scrollTop = 0;
  openSheet("wineSheet");
}
function renderWineEditor() {
  const known = (k) => S.wines.map((w) => w[k]);
  const inp = (k, ph, extra = "") => `<input data-w="${k}" placeholder="${ph}" value="${h(W[k])}" ${extra}>`;
  const food = foodRecipes().filter((r) => !W.recipes.includes(r.id));
  const zoneHints = S.wines.filter((w) => !W.location || w.location === W.location).map((w) => w.zone);
  $("#wineSheet").innerHTML = `
    <div class="sheet-bar"><button class="bar-btn l" data-act="wine-cancel">Cancel</button><h2>${W.id ? "Edit Wine" : "New Wine"}</h2>
      <button class="bar-btn strong r" data-act="wine-save">Save</button></div>
    <div class="sheet-body">
      <div class="photo ${W.image_url ? "has" : ""}" data-act="wphoto" role="button" aria-label="Add a label photo" style="height:160px">
        ${W.image_url ? `<img src="${h(W.image_url)}" alt=""><span class="btn sm change">${icon("camera", "sm")} Change</span>` : `<span class="ph">${icon("camera")}Snap the label</span>`}</div>
      ${W.image_url ? `<div class="photo-links"><span></span><button class="link-btn" style="color:var(--ink-3)" data-act="wimg-clear">Remove photo</button></div>` : ""}

      <div class="group-title">Wine</div>
      <div class="group">
        <div class="row">${inp("producer", "Producer / winery", 'list="dlProducer" autocapitalize="words" style="font-weight:650;font-size:18px"')}</div>
        <div class="row">${inp("name", "Wine name (Reserve Cabernet…)", 'autocapitalize="words"')}</div>
        <div class="row"><label>Vintage</label>${inp("vintage", "NV", 'inputmode="numeric" maxlength="4"')}</div>
        <div class="seg-row"><div class="segmented" role="group" aria-label="Type">${WINE_TYPES.map((t) => `<button data-wt="${t}" aria-pressed="${W.wine_type === t}">${t}</button>`).join("")}</div></div>
      </div>

      <div class="group-title">Details</div>
      <div class="group">
        <div class="row"><label>Grape</label>${inp("varietal", "Cabernet Sauvignon", 'list="dlVarietal" autocapitalize="words"')}</div>
        <div class="row"><label>Region</label>${inp("region", "Napa Valley", 'list="dlRegion" autocapitalize="words"')}</div>
        <div class="row"><label>Country</label>${inp("country", "USA", 'list="dlCountry" autocapitalize="words"')}</div>
        <div class="seg-row"><div class="segmented" role="group" aria-label="Bottle size">${WINE_SIZES.map((t) => `<button data-wsize="${t}" aria-pressed="${W.size === t}">${t}</button>`).join("")}</div></div>
      </div>

      <div class="group-title">Where it lives</div>
      <div class="group">
        <div class="row"><label>Bottles</label><span class="stepper"><button class="mini-btn" data-act="wq-down" aria-label="Fewer">${icon("minus", "sm")}</button><b id="wQty">${+W.quantity || 0}</b><button class="mini-btn" data-act="wq-up" aria-label="More">${icon("plus", "sm")}</button></span></div>
        <div class="row"><label>Location</label>${inp("location", "Basement cellar", 'list="dlLoc" autocapitalize="words"')}</div>
        <div class="row"><label>Rack / zone</label>${inp("zone", "Rack B, top shelf…", 'list="dlZone" autocapitalize="words"')}</div>
        <div class="row"><label>Slot / bin</label>${inp("slot", "Row 3, bin 4…", 'list="dlSlot"')}</div>
      </div>
      <p class="hint">Pick from places you've used before so the vault groups neatly by location.</p>

      <div class="group-title">Drinking window</div>
      <div class="group"><div class="pair">
        <div class="row"><label>From</label>${inp("drink_from", String(yearNow()), 'inputmode="numeric" maxlength="4"')}</div>
        <div class="row"><label>Through</label>${inp("drink_by", String(yearNow() + 5), 'inputmode="numeric" maxlength="4"')}</div></div></div>
      <p class="hint">Leave blank if it's ready now. Wines inside a year of their end date show up under Drink soon.</p>

      <div class="group-title">Purchase</div>
      <div class="group">
        <div class="pair">
          <div class="row"><label>Paid</label>${inp("price", "$ / bottle", 'inputmode="decimal"')}</div>
          <div class="row"><label>Value</label>${inp("value", "$ now", 'inputmode="decimal"')}</div></div>
        <div class="row"><label>From</label>${inp("purchased_from", "Winery, shop, gift…", 'list="dlShop" autocapitalize="words"')}</div>
        <div class="row"><label>Date</label><input data-w="purchased_on" type="date" value="${h(W.purchased_on)}"></div>
      </div>

      <div class="group-title">Pairings</div>
      <div class="group">
        <div class="row"><textarea data-w="pairing_notes" rows="2" placeholder="Steak, mushroom risotto, aged cheddar…">${h(W.pairing_notes)}</textarea></div>
        <div class="tag-input">${W.recipes.map((id) => byId(id)).filter(Boolean).map((r) => `<button class="chip pr" data-wunpair="${r.id}">${h(r.title)} ${icon("x", "sm")}</button>`).join("")}
          <input id="wPairIn" list="dlRecipes" placeholder="${W.recipes.length ? "Link another recipe" : "Link a recipe from your box…"}" autocomplete="off"></div>
      </div>
      <p class="hint">Linked recipes show this wine on their page, so it's right there when you're planning dinner.</p>

      <div class="group-title">Tasting notes</div>
      <div class="group"><div class="row"><textarea data-w="notes" rows="3" placeholder="Dark cherry, cocoa, firm tannins…">${h(W.notes)}</textarea></div></div>

      ${dl("dlProducer", [], known("producer"))}${dl("dlVarietal", VARIETALS, known("varietal"))}${dl("dlRegion", [], known("region"))}${dl("dlCountry", ["USA", "France", "Italy", "Spain", "Portugal", "Argentina", "Chile", "Australia", "New Zealand", "Germany", "South Africa"], known("country"))}
      ${dl("dlLoc", WINE_PLACES, known("location"))}${dl("dlZone", [], zoneHints)}${dl("dlSlot", [], known("slot"))}${dl("dlShop", [], known("purchased_from"))}
      <datalist id="dlRecipes">${food.map((r) => `<option value="${h(r.title)}">`).join("")}</datalist>

      <button class="btn primary block" style="margin-top:26px" data-act="wine-save">Save wine</button>
      ${W.id ? `<button class="btn danger block" style="margin-top:12px" data-act="wine-delete">${icon("trash", "sm")} Delete wine</button>` : ""}
    </div>`;
  for (const ta of $$("#wineSheet textarea")) autosize(ta);
}
function wRerender(focusSel) {
  const sh = $("#wineSheet"), y = sh.scrollTop;
  renderWineEditor(); sh.scrollTop = y;
  if (focusSel) $(focusSel)?.focus({ preventScroll: true });
}
function addPairing(title) {
  const t = title.trim().toLowerCase(); if (!t) return;
  const r = foodRecipes().find((x) => x.title.toLowerCase() === t);
  if (!r) return;
  if (!W.recipes.includes(r.id)) W.recipes.push(r.id);
  wRerender("#wPairIn");
}
async function saveWine() {
  if (!String(W.name).trim() && !String(W.producer).trim()) { toast("Give the wine a name or producer"); return $('[data-w="producer"]')?.focus(); }
  if (!String(W.name).trim()) W.name = W.varietal || W.wine_type || "Wine";
  const pend = $("#wPairIn")?.value; if (pend) addPairing(pend);
  for (const b of $$('[data-act="wine-save"]')) b.disabled = true;
  try {
    const isNew = !W.id;
    const id = await store.saveWine(W, W.recipes);
    await reload();
    S.wopen.add(id); S.scrollWine = id;
    toast(isNew ? "Added to the vault 🍷" : "Saved");
    back("#/bar");
  } catch (e) {
    toast(barErr(e.message));
    for (const b of $$('[data-act="wine-save"]')) b.disabled = false;
  }
}
async function deleteWine() {
  const btn = $('[data-act="wine-delete"]');
  if (!btn.dataset.confirm) { btn.dataset.confirm = "1"; btn.innerHTML = `${icon("trash", "sm")} Tap again to delete (history too)`; return; }
  try { await store.deleteWine(W.id); S.wopen.delete(W.id); await reload(); toast("Wine deleted"); back("#/bar"); }
  catch (e) { toast(barErr(e.message)); }
}

// ------------------------------------------------------------------ events
document.addEventListener("click", async (e) => {
  const t = e.target.closest("button, [data-open], [data-act], [data-ck]");
  if (!t) return;
  const d = t.dataset;
  if (d.viewfam) return switchView(d.viewfam, d.vmode === "edit");
  if (isRO() && isWriteClick(d)) { e.preventDefault(); return toast(RO_MSG); }

  if (d.ck) { S.ck.has(d.ck) ? S.ck.delete(d.ck) : S.ck.add(d.ck); return t.classList.toggle("done"); }
  if (d.open) return go("#/r/" + d.open);
  if (d.tab) { if (d.tab === S.tab && !$$(".sheet.open").length) { window.scrollTo({ top: 0, behavior: "smooth" }); return syncNow(false); } return go("#/" + d.tab); }
  if (d.f) { // filter chip
    const set = (S.filters[d.f] ||= new Set());
    set.has(d.v) ? set.delete(d.v) : set.add(d.v);
    return renderHome();
  }
  if (d.fam) { S.famTab = d.fam; return renderFavorites(); }
  if (d.toggle) { S.open.has(d.toggle) ? S.open.delete(d.toggle) : S.open.add(d.toggle); return S.tab === "bar" ? renderBarList() : renderHome(); }
  // bar
  if (d.bar) { if (S.bar !== d.bar) { S.bar = d.bar; S.bq = ""; $("#bq").value = ""; renderBar(); } return; }
  if (d.spirit) { S.spirit.has(d.spirit) ? S.spirit.delete(d.spirit) : S.spirit.add(d.spirit); return renderBar(); }
  if (d.wtype) { S.wtype.has(d.wtype) ? S.wtype.delete(d.wtype) : S.wtype.add(d.wtype); return renderBar(); }
  if (d.wtoggle) { S.wopen.has(d.wtoggle) ? S.wopen.delete(d.wtoggle) : S.wopen.add(d.wtoggle); return renderBarList(); }
  if (d.wdrink) return openDrink(d.wdrink);
  if (d.wqty) return bumpWine(d.wqty, +d.d);
  if (d.wedit) return go("#/wine/" + d.wedit);
  if (d.wine) { S.bar = "vault"; S.wopen.add(d.wine); S.scrollWine = d.wine; if (!wineMatch(wineById(d.wine) || {})) { S.bq = ""; S.wtype.clear(); S.showEmpty = true; $("#bq").value = ""; } renderBar(); return go("#/bar"); }
  if (d.dkn) { DK.n = +d.dkn; DK.occasion = $("#dkOcc")?.value || ""; const note = $("#dkNote")?.value || ""; renderDrink(); $("#dkNote").value = note; return; }
  if (d.dkocc) { $("#dkOcc").value = d.dkocc; return; }
  if (d.wt) { W.wine_type = d.wt; for (const b of $$("[data-wt]")) b.setAttribute("aria-pressed", b.dataset.wt === W.wine_type); return; }
  if (d.wsize) { W.size = d.wsize; for (const b of $$("[data-wsize]")) b.setAttribute("aria-pressed", b.dataset.wsize === W.size); return; }
  if (d.wunpair) { W.recipes = W.recipes.filter((x) => x !== d.wunpair); return wRerender(); }
  if (d.meth) { E.method = E.method === d.meth ? "" : d.meth; for (const b of $$("#methSeg button")) b.setAttribute("aria-pressed", b.dataset.meth === E.method); return; }
  if (d.pin) return togglePin(d.pin);
  if (d.edit) return go("#/edit/" + d.edit);
  if (d.rate) return rate(d.rid || S.detail.id, +d.rate);
  if (d.scale) { S.scale = +d.scale; return renderDetail(); }
  if (d.diff) { E.difficulty = E.difficulty === d.diff ? "" : d.diff; for (const b of $$("#diffSeg button")) b.setAttribute("aria-pressed", b.dataset.diff === E.difficulty); return; }
  if (d.tag) return addTag(d.tag);
  if (d.untag) { E.tags = E.tags.filter((x) => x !== d.untag); return rerenderKeepScroll(); }
  if (d.groc) return addRecipeToGrocery(d.groc);
  if (d.gck) return toggleGroceryChecked(d.gck);
  if (d.gdel) return deleteGroceryItem(d.gdel);
  if (d.sharefam) return doShare(d.sharefam);
  if (d.rln) { RL.n = +d.rln; RL.slots = []; return renderRoulette(); }
  if (d.rlock) { const sl = RL.slots[+d.rlock]; if (sl?.id) sl.locked = !sl.locked; return renderRoulette(); }
  if (d.rroll) return spinRoulette(+d.rroll);

  switch (d.act) {
    case "new": return go("#/new");
    case "bar-new": return go(S.bar === "vault" ? "#/wine/new" : "#/new-drink");
    case "bar-clear": S.bq = ""; $("#bq").value = ""; S.spirit.clear(); S.wtype.clear(); return renderBar();
    case "wine-soon": S.wgroup = "window"; S.showEmpty = false; return renderBar();
    case "wine-empties": S.showEmpty = !S.showEmpty; return renderBar();
    case "drink-cancel": return closeSheet("drinkSheet");
    case "drink-confirm": return confirmDrink();
    case "wine-cancel": return back("#/bar");
    case "wine-save": return saveWine();
    case "wine-delete": return deleteWine();
    case "wq-up": case "wq-down": W.quantity = Math.max(0, (+W.quantity || 0) + (d.act === "wq-up" ? 1 : -1)); $("#wQty").textContent = W.quantity; return;
    case "wphoto": photoFor = "wine"; return $("#photoInput").click();
    case "wimg-clear": W.image_url = ""; return wRerender();
    case "expand-all": visibleIds.forEach((id) => S.open.add(id)); return renderHome();
    case "collapse-all": S.open.clear(); return renderHome();
    case "clear-filters": S.filters = {}; S.q = ""; $("#q").value = ""; return renderHome();
    case "close-detail": return back("#/" + S.tab);
    case "pin": return togglePin(S.detail.id);
    case "edit": return go("#/edit/" + S.detail.id);
    case "wake": return toggleWake();
    case "share": return openShare();
    case "open-admin": return openAdmin();
    case "close-admin": return closeSheet("adminSheet");
    case "admin-gen-pw": { const el = $("#adPw"); if (el) el.value = genPassword(); return; }
    case "admin-create": return adminCreate();
    case "admin-copy-invite": return copyInvite();
    case "admin-again": AD.result = null; return renderAdmin();
    case "save-password": return savePassword();
    case "view-stop": return switchView(null);
    case "view-mode": return S.view && switchView(S.view.family_id, !S.view.can_edit);
    case "close-share": return closeSheet("shareSheet");
    case "share-text": return shareAsText();
    case "roulette": return openRoulette();
    case "close-roulette": return closeSheet("rouletteSheet");
    case "rl-spin": return spinRoulette();
    case "rl-mains": S.filters.course = new Set(["Entree"]); RL.slots = []; renderHome(); return renderRoulette();
    case "rl-filters":
      closeSheet("rouletteSheet"); S.filterOpen = true;
      $("#filterWrap").classList.add("open"); $("#filterToggle").setAttribute("aria-expanded", "true");
      return window.scrollTo({ top: 0, behavior: "smooth" });
    case "rl-groc": return pushRecipesToGrocery(rlPicks(), `Added ingredients for ${rlPicks().length} meal${rlPicks().length === 1 ? "" : "s"} 🧺`);
    case "rl-pin": return pinPicks();
    case "cancel-edit": return back(E?.id ? "#/r/" + E.id : "#/" + S.tab);
    case "save": return saveRecipe();
    case "delete": return deleteRecipe();
    case "import": return doImport();
    case "paste-clip": {
      try {
        const txt = (await navigator.clipboard.readText()).trim();
        if (/^https?:\/\/\S+$/i.test(txt)) { $("#impUrl").value = txt; return doImport(txt); }
        if (txt.includes("\n")) { applyText(txt); return; }
        toast("Clipboard doesn't have a link yet");
      } catch { toast("Long-press the box and choose Paste"); $("#impUrl").focus(); }
      return;
    }
    case "toggle-paste-text": $("#pasteText").hidden = !$("#pasteText").hidden; return $("#pasteArea").focus();
    case "sort-text": return applyText($("#pasteArea").value);
    case "photo": photoFor = "recipe"; return $("#photoInput").click();
    case "img-url": $("#imgUrlRow").hidden = false; return $('#imgUrlRow input').focus();
    case "img-clear": E.image_url = ""; return rerenderKeepScroll();
    case "toggle-parsed": $("#parsed").hidden = !$("#parsed").hidden; return updateParsed();
    case "add-groc": return addRecipeToGrocery(S.detail.id);
    case "add-pinned-groc": return addPinnedToGrocery();
    case "add-fav-groc": return addFavoritesToGrocery();
    case "add-grocery-item": { const v = $("#groceryAdd").value; $("#groceryAdd").value = ""; return addManualGroceryItem(v); }
    case "clear-checked": return clearCheckedGrocery();
    case "clear-all-grocery": return clearAllGrocery();
    case "export-grocery": return exportGrocery();
    case "signout": return store.signOut();
  }
});

function applyText(txt) {
  const r = splitRecipeText(txt);
  if (!r.ingredients.length && !r.steps.length) return toast("Couldn't find ingredients — try typing them below");
  applyImport({ title: E.title ? "" : r.title, ingredients: r.ingredients, steps: r.steps.map((body) => ({ body })) });
  toast("Sorted! Double-check it, then Save ✨");
}

document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.id === "q") { S.q = el.value; return renderHomeSoon(); }
  if (el.id === "meName") return saveNameSoon(el.value);
  if (el.id === "bq") { S.bq = el.value; return renderBarListSoon(); }
  if (el.dataset.w && W) { W[el.dataset.w] = el.value; if (el.tagName === "TEXTAREA") autosize(el); return; }
  if (el.id === "wPairIn" && W && foodRecipes().some((r) => r.title.toLowerCase() === el.value.trim().toLowerCase())) return addPairing(el.value);
  const k = el.dataset.k;
  if (!k || !E) return;
  E[k] = el.value;
  if (el.tagName === "TEXTAREA") autosize(el);
  if (k === "ingText") updateParsedSoon();
  if (k === "prep_min" || k === "cook_min") autoTotal();
  if (k === "course" && isDrink(E) !== E._drink) { E._drink = isDrink(E); rerenderKeepScroll('[data-k="course"]'); }
  if (k === "image_url") debounce(() => rerenderKeepScroll('#imgUrlRow input'), 900)();
});
const renderHomeSoon = debounce(renderHome, 120);
const saveNameSoon = debounce(async (v) => { S.me.display_name = v.trim(); await store.updateProfile({ display_name: v.trim() }).catch((er) => toast(er.message)); const p = profile(S.me.id); if (p) p.display_name = v.trim(); renderFavorites(); }, 700);

document.addEventListener("keydown", (e) => {
  if (e.target.id === "tagIn" && (e.key === "Enter" || e.key === ",")) { e.preventDefault(); if (e.target.value.trim()) { addTag(e.target.value); $("#tagIn")?.focus(); } }
  if (e.target.id === "tagIn" && e.key === "Backspace" && !e.target.value && E.tags.length) { E.tags.pop(); rerenderKeepScroll("#tagIn"); }
  if (e.target.id === "impUrl" && e.key === "Enter") { e.preventDefault(); doImport(); }
  if (e.target.id === "groceryAdd" && e.key === "Enter" && isRO()) { e.preventDefault(); e.target.value = ""; toast(RO_MSG); }
  else if (e.target.id === "groceryAdd" && e.key === "Enter") { e.preventDefault(); const v = e.target.value; e.target.value = ""; addManualGroceryItem(v); }
  if (e.target.id === "wPairIn" && e.key === "Enter") { e.preventDefault(); addPairing(e.target.value); }
  if (e.key === "Escape") {
    if ($("#drinkSheet").classList.contains("open")) closeSheet("drinkSheet");
    else if ($("#wineSheet").classList.contains("open")) back("#/bar");
    else if ($("#editorSheet").classList.contains("open")) back(E?.id ? "#/r/" + E.id : "#/" + S.tab);
    else if ($("#detailSheet").classList.contains("open")) back("#/" + S.tab);
  }
});
document.addEventListener("focusout", (e) => { if (e.target.id === "tagIn" && e.target.value.trim()) addTag(e.target.value); });
document.addEventListener("toggle", (e) => {
  const sec = e.target.dataset?.sec;
  if (sec) { const id = e.target.dataset.rid; const v = S.sec.get(id) || { ing: true, steps: false }; v[sec] = e.target.open; S.sec.set(id, v); return; }
  const g = e.target.dataset?.group; if (!g) return;
  e.target.open ? S.openGroups.add(g) : S.openGroups.delete(g);
}, true);

$("#sortSel").addEventListener("change", (e) => { S.sort = e.target.value; S.dir = 1; renderHome(); });
$("#dirBtn").addEventListener("click", () => { S.dir *= -1; renderHome(); });
$("#filterToggle").addEventListener("click", () => {
  S.filterOpen = !S.filterOpen;
  $("#filterWrap").classList.toggle("open", S.filterOpen);
  $("#filterToggle").setAttribute("aria-expanded", S.filterOpen);
});
$("#scrim").addEventListener("click", () => {
  if ($("#shareSheet").classList.contains("open")) return closeSheet("shareSheet");
  if ($("#drinkSheet").classList.contains("open")) return closeSheet("drinkSheet");
  if ($("#wineSheet").classList.contains("open")) return;
  if ($("#adminSheet").classList.contains("open")) return closeSheet("adminSheet");
  if ($("#editorSheet").classList.contains("open")) return;
  if ($("#detailSheet").classList.contains("open")) return back("#/" + S.tab);
  if ($("#rouletteSheet").classList.contains("open")) return closeSheet("rouletteSheet");
  back("#/" + S.tab);
});
let photoFor = "recipe";
$("#photoInput").addEventListener("change", async (e) => {
  const f = e.target.files[0]; e.target.value = "";
  if (photoFor === "wine") {
    if (!f || !W) return;
    $("#wineSheet .photo").innerHTML = `<span class="ph"><span class="spin" style="color:var(--peach-deep)"></span>Uploading…</span>`;
    try { W.image_url = await store.uploadImage(f); } catch (er) { toast(er.message); }
    return wRerender();
  }
  if (!f || !E) return;
  const well = $("#editorSheet .photo"); well.innerHTML = `<span class="ph"><span class="spin" style="color:var(--peach-deep)"></span>Uploading…</span>`;
  try { E.image_url = await store.uploadImage(f); } catch (er) { toast(er.message); }
  rerenderKeepScroll();
});

// ------------------------------------------------------------------ boot
async function reload() {
  if (S.admin) { S.view = await store.viewStatus(); applyView(); }
  const { ingredients = [], steps = [], grocery = [], ...d } = await store.loadAll();
  Object.assign(S, d);
  S.wineLog = [...S.wineLog].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  S.grocery = [...grocery].sort((a, b) => (a.position - b.position) || (a.created_at || "").localeCompare(b.created_at || ""));
  S.details = new Map(S.recipes.map((r) => [r.id, { ingredients: [], steps: [] }]));
  for (const i of ingredients) S.details.get(i.recipe_id)?.ingredients.push(i);
  for (const x of steps) S.details.get(x.recipe_id)?.steps.push(x);
  for (const v of S.details.values()) { v.ingredients.sort((a, b) => a.position - b.position); v.steps.sort((a, b) => a.position - b.position); }
  const p = S.profiles.find((x) => x.id === S.me.id);
  if (p) Object.assign(S.me, { display_name: p.display_name, family_id: p.family_id });
  renderAll();
}

let entered = false;
async function enter() {
  if (entered) return;
  if (!(await store.isMember())) {
    showAuth(`You're signed in, but this email isn't on the family list yet. Add it to allowed_emails in Supabase, then refresh.`, true);
    return;
  }
  entered = true;
  S.me = await store.me();
  S.admin = await store.isAdmin();
  if (!S.admin) { S.view = null; applyView(); }
  await reload();
  $("#auth").hidden = true; $("#app").hidden = false; $("#boot").hidden = true;
  await route();
  startSync();
}

// ------------------------------------------------------------------ cross-device sync
// 1) Live: Supabase Realtime pushes changes made on any device.
// 2) Fallback: reload whenever the app comes back to the foreground (phone unlock, tab switch).
// 3) Manual: tap the tab you're already on.
let lastSync = Date.now(), syncing = false;
async function syncNow(quiet = true) {
  if (!entered || syncing) return;
  syncing = true;
  try {
    const y = window.scrollY;
    await reload();
    if (S.detail && !$("#editorSheet").classList.contains("open")) {
      const fresh = byId(S.detail.id);
      if (fresh) { S.detail = { ...fresh, ...structuredClone(detailsOf(fresh.id)) }; renderDetail(); }
    }
    window.scrollTo(0, y);
    lastSync = Date.now();
    if (!quiet) toast("Up to date");
  } catch (e) { if (!quiet) toast(e.message); }
  finally { syncing = false; }
}
const syncSoon = debounce(() => syncNow(true), 700);
function startSync() {
  store.subscribe(() => syncSoon());
  const onFront = () => { if (document.visibilityState === "visible" && Date.now() - lastSync > 5000) syncNow(true); };
  document.addEventListener("visibilitychange", onFront);
  window.addEventListener("focus", onFront);
  window.addEventListener("pageshow", onFront);
  window.addEventListener("online", () => syncNow(true));
}
function showAuth(msg, signedInButBlocked = false) {
  $("#boot").hidden = true; $("#app").hidden = true; $("#auth").hidden = false;
  if (msg) $("#authMsg").textContent = msg;
  if (signedInButBlocked) { $("#authForm").hidden = true; $("#resetForm").hidden = true; $("#authMsg").insertAdjacentHTML("afterend", `<button class="btn soft" data-act="signout">Sign out</button>`); }
}
function showNewPassword() {
  showAuth("Choose a new password for your account.");
  $("#authForm").hidden = true; $("#resetForm").hidden = false; $("#newPw").focus();
}
const busy = (btn, on, label) => { btn.disabled = on; btn.innerHTML = on ? `<span class="spin"></span>` : label; };
const friendly = (m) => /invalid login/i.test(m) ? "That email and password don't match. Try again or reset your password."
  : /email not confirmed/i.test(m) ? "This account hasn't been confirmed yet — check the email inbox, or confirm the user in Supabase."
  : /rate limit|too many/i.test(m) ? "Too many tries — wait a minute and try again." : m;

$("#authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const b = $("#authBtn"); busy(b, true);
  try { await store.signIn($("#authEmail").value.trim().toLowerCase(), $("#authPw").value); }   // onAuth → enter()
  catch (er) { toast(friendly(er.message)); busy(b, false, "Sign in"); }
});
$("#forgotBtn").addEventListener("click", async () => {
  const email = $("#authEmail").value.trim().toLowerCase();
  if (!email) { toast("Type your email first, then tap Forgot password"); return $("#authEmail").focus(); }
  try { await store.resetPassword(email); $("#authMsg").innerHTML = `Check <b>${h(email)}</b> for a link to set a new password.`; }
  catch (er) { toast(friendly(er.message)); }
});
$("#resetForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const b = $("#resetBtn"); busy(b, true);
  try {
    await store.updatePassword($("#newPw").value);
    recovering = false; toast("Password saved"); history.replaceState(null, "", location.pathname);
    await enter();
  } catch (er) { toast(friendly(er.message)); busy(b, false, "Save new password"); }
});
document.addEventListener("click", (e) => {
  const eye = e.target.closest("[data-eye]"); if (!eye) return;
  const inp = $("#" + eye.dataset.eye), show = inp.type === "password";
  inp.type = show ? "text" : "password"; eye.textContent = show ? "Hide" : "Show";
});

// Arriving from a "reset password" email: show the new-password form instead of the app.
let recovering = /type=recovery/.test(location.hash);

(async function boot() {
  try {
    store = await createStore();
    store.onAuth((s, event) => {
      if (event === "PASSWORD_RECOVERY") { recovering = true; return showNewPassword(); }
      if (s && !recovering) enter(); else if (!s && entered) location.reload();
    });
    const session = await store.session();
    if (recovering) showNewPassword();
    else if (session) await enter(); else showAuth();
  } catch (e) {
    console.error(e);
    $("#boot").innerHTML = `<div class="empty"><div class="logo">🥲</div><h3>Couldn't start</h3><p>${h(e.message)}</p></div>`;
  }
})();
