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

const COURSES = ["Entree", "Side", "Appetizer", "Dessert", "Drink", "Breakfast", "Brunch", "Lunch", "Dinner", "Soup", "Salad", "Snack", "Sauce", "Bread"];
const COURSE_LABEL = { Entree: "Entrées", Side: "Sides", Appetizer: "Appetizers", Dessert: "Desserts", Drink: "Drinks", Soup: "Soups", Salad: "Salads", Snack: "Snacks", Sauce: "Sauces", Bread: "Breads" };
const COURSE_COLOR = { Entree: "var(--peach)", Side: "var(--mint)", Appetizer: "var(--blush)", Dessert: "var(--lav)", Drink: "var(--butter)" };
const CUISINES = ["American", "Southern", "Cajun", "Tex-Mex", "Mexican", "Italian", "German", "Spanish", "Argentinian", "Korean", "French", "Greek", "Mediterranean", "Asian", "Chinese", "Japanese", "Thai", "Indian", "BBQ"];
const PROTEINS = ["Chicken", "Beef", "Pork", "Turkey", "Seafood", "Eggs", "Beans", "Vegetarian", "Vegan"];
const TAG_IDEAS = ["kid friendly", "weeknight", "freezer friendly", "holiday", "one pan", "healthy", "crockpot", "make ahead", "grill"];
const FAMILY_COLORS = ["#FFB997", "#9ED9C3", "#F7B7C5", "#CFC6F2", "#FBE3A6", "#A9D6F5"];
const EMOJI = { Breakfast: "🥞", Brunch: "🍳", Lunch: "🥪", Side: "🥔", Appetizer: "🧀", Soup: "🍲", Salad: "🥗", Dessert: "🧁", Snack: "🍿", Drink: "🍹", Sauce: "🫙", Bread: "🥖" };
const PROTEIN_EMOJI = { Chicken: "🍗", Beef: "🥩", Pork: "🥓", Turkey: "🦃", Seafood: "🐟", Eggs: "🍳", Vegetarian: "🥕", Vegan: "🥑", Beans: "🫘" };
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
  me: null, recipes: [], pins: new Map(), ratings: [], profiles: [], families: [],
  tab: "recipes", q: "", filters: {}, filterOpen: false, openGroups: new Set(["course"]),
  famTab: "all", detail: null, scale: 1, checked: new Set(), wake: null,
  sort: "category", dir: 1, open: new Set(), sec: new Map(), ck: new Set(), details: new Map(),
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
    for (const r of S.recipes) if (matches(r, g.key)) for (const v of valuesOf(r, g.key)) counts.set(v, (counts.get(v) || 0) + 1);
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
  const shown = S.recipes.filter((r) => matches(r)).length;
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
  const facts = [["Prep", fmtMin(r.prep_min)], ["Cook", fmtMin(r.cook_min)], ["Total", fmtMin(totalOf(r))], ["Serves", r.servings]].filter(([, v]) => v);
  const pills = [[r.course, "peach"], [r.cuisine, "mint"], [r.protein, "blush"], [r.difficulty, "butter"]].filter(([v]) => v);
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
  const list = S.recipes.filter((r) => matches(r));
  visibleIds = list.map((r) => r.id);
  const browsing = !S.q && !activeCount();
  const pins = pinnedList();
  const anyOpen = visibleIds.some((id) => S.open.has(id));
  const cfg = SORTS[S.sort] || SORTS.category;
  $("#dirBtn").dataset.dir = S.dir;
  $("#sortSel").value = S.sort;
  $("#list").innerHTML = !list.length
    ? (S.recipes.length
      ? emptyState("🔍", "No matches", "Try a different search or loosen a filter.", `<button class="btn soft" data-act="clear-filters">Clear filters</button>`)
      : emptyState("🍑", "Your recipe box is empty", "Paste a link from any recipe site, or type in Grandma's favorite.", `<button class="btn primary" data-act="new">${icon("plus")} Add a recipe</button>`))
    : `<div class="list-meta"><span>${list.length} recipe${list.length === 1 ? "" : "s"}${browsing ? "" : ` of ${S.recipes.length}`} · by ${cfg.label}</span>
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
  const me = S.me, fam = family(me.family_id);
  const mine = S.ratings.filter((r) => r.user_id === me.id).length;
  const added = S.recipes.filter((r) => r.created_by === me.id).length;
  $("#meBody").innerHTML = `
    <div class="profile"><div class="big-av">${h(initials(me.display_name || me.email))}</div>
      <div><h2>${h(me.display_name || "Hello!")}</h2><p>${h(me.email)}${fam ? ` · ${h(fam.name)} family` : ""}</p></div></div>
    <div class="tiles"><div class="tile"><b>${added}</b><span>Added</span></div><div class="tile"><b>${S.pins.size}</b><span>Pinned</span></div><div class="tile"><b>${mine}</b><span>Rated</span></div></div>
    <div class="group-title">Your name</div>
    <div class="group"><div class="row"><input id="meName" value="${h(me.display_name)}" placeholder="What the family calls you" autocomplete="nickname"></div></div>
    <div class="group-title">Your family</div>
    <div class="group">
      ${S.families.map((f) => `<button class="row" style="width:100%" data-setfam="${f.id}"><span class="dot" style="background:${f.color}"></span><span style="flex:1;text-align:left">${h(f.name)}</span>${me.family_id === f.id ? `<span style="color:var(--peach-deep)">${icon("check")}</span>` : ""}</button>`).join("")}
      <button class="row" style="width:100%;color:var(--peach-deep);font-weight:600" data-act="new-family">${icon("plus", "sm")} New family</button>
      <div id="newFam" hidden>
        <div class="row"><input id="newFamName" placeholder="e.g. Grandma & Grandpa"></div>
        <div class="swatches">${FAMILY_COLORS.map((c, i) => `<button class="swatch" data-color="${c}" aria-pressed="${i === 1}" style="background:${c}" aria-label="Color"></button>`).join("")}
          <button class="btn sm primary" style="margin-left:auto" data-act="add-family">Add</button></div>
      </div>
    </div>
    <p class="hint">Hearts roll up by family on the Favorites tab.</p>
    <div class="group-title">App</div>
    <div class="group">
      <div class="row" style="color:var(--ink-2);font-size:15px;padding:12px 16px;line-height:1.45">${icon("share", "sm")}<span>On iPhone: tap Share → <b>Add to Home Screen</b> for a full-screen app.</span></div>
      <button class="row" style="width:100%;color:var(--blush-deep);font-weight:600" data-act="signout">${icon("out", "sm")} Sign out</button>
    </div>
    ${isDemo ? `<div class="demo-note"><b>Demo mode.</b> You're seeing sample recipes stored only in this tab. Fill in <code>config.js</code> with your Supabase URL and anon key to go live.</div>` : ""}`;
}

function renderAll() { renderHome(); renderPinned(); renderFavorites(); renderMe(); }

// ------------------------------------------------------------------ tabs & routing
function showTab(tab) {
  if (!["recipes", "pinned", "favorites", "me"].includes(tab)) tab = "recipes";
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
  if (a === "r" && b) { closeSheet("editorSheet"); await openDetail(b); }
  else if (a === "new") await openEditor(null);
  else if (a === "edit" && b) await openEditor(b);
  else { closeSheet("editorSheet"); closeSheet("detailSheet"); showTab(a || "recipes"); }
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
  const stats = [["Prep", fmtMin(r.prep_min)], ["Cook", fmtMin(r.cook_min)], ["Total", fmtMin(totalOf(r))], ["Serves", r.servings]].filter(([, v]) => v);
  const pills = [[r.course, "peach"], [r.cuisine, "mint"], [r.protein, "blush"], [r.difficulty, "butter"]].filter(([v]) => v);
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
      ${stats.length ? `<div class="stats" style="grid-template-columns:repeat(${stats.length},1fr)">${stats.map(([k, v]) => `<div class="stat"><b>${h(v).replace(/ min$/, "<small style='font-size:12px'> min</small>")}</b><span>${k}</span></div>`).join("")}</div>` : ""}
      <div class="action-row">
        <button class="action ${S.wake ? "on" : ""}" data-act="wake">${icon("flame")}${S.wake ? "Screen on" : "Cook mode"}</button>
        <button class="action" data-act="share">${icon("share")}Share</button>
        ${r.source_url ? `<a class="action" href="${h(r.source_url)}" target="_blank" rel="noopener">${icon("link")}Source</a>` : `<button class="action" data-act="pin">${icon("pin")}${pinned ? "Unpin" : "Pin"}</button>`}
        <button class="action" data-act="edit">${icon("edit")}Edit</button>
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
  renderHome(); renderPinned();
  toast(on ? "Pinned 📌" : "Unpinned");
  try { await store.setPin(id, on); } catch (e) { toast(e.message); }
}
async function rate(id, n) {
  const cur = myScore(id);
  const score = cur === n ? 0 : n;
  S.ratings = S.ratings.filter((r) => !(r.recipe_id === id && r.user_id === S.me.id));
  if (score) S.ratings.push({ user_id: S.me.id, recipe_id: id, score });
  if (S.detail?.id === id) { renderDetail(); $(`#detailSheet [data-rate="${n}"]`)?.classList.add("pop"); }
  renderHome(); renderPinned(); renderFavorites();
  $(`#list [data-item="${id}"] [data-rate="${n}"]`)?.classList.add("pop");
  try { await store.setRating(id, score); } catch (e) { toast(e.message); }
}

// ------------------------------------------------------------------ editor
let E = null;
const blank = () => ({ id: null, title: "", description: "", image_url: "", source_url: "", course: "", cuisine: "", protein: "", difficulty: "",
  prep_min: "", cook_min: "", total_min: "", servings: "", tags: [], notes: "", credit: "", ingText: "", stepText: "" });

async function openEditor(id) {
  if (id) {
    const r = S.detail?.id === id ? S.detail : await store.getRecipe(id);
    E = { ...blank(), ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? ""])), tags: [...(r.tags || [])],
      ingText: ingredientsToText(r.ingredients), stepText: stepsToText(r.steps) };
  } else E = blank();
  renderEditor();
  $("#editorSheet").scrollTop = 0;
  openSheet("editorSheet");
  if (!id) setTimeout(() => $("#impUrl")?.focus({ preventScroll: true }), 450);
}

const dl = (id, list, extra) => `<datalist id="${id}">${[...new Set([...list, ...extra.filter(Boolean)])].map((v) => `<option value="${h(v)}">`).join("")}</datalist>`;
function renderEditor() {
  const known = (k) => S.recipes.map((r) => r[k]);
  $("#editorSheet").innerHTML = `
    <div class="sheet-bar"><button class="bar-btn l" data-act="cancel-edit">Cancel</button><h2>${E.id ? "Edit Recipe" : "New Recipe"}</h2>
      <button class="bar-btn strong r" data-act="save" id="saveBtn">Save</button></div>
    <div class="sheet-body">
      ${E.id ? "" : `<div class="import"><h3>${icon("wand")} Import from a link</h3><p>Paste a link from any recipe site and we'll fill everything in.</p>
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

      <div class="group-title">Recipe</div>
      <div class="group">
        <div class="row"><input data-k="title" placeholder="Recipe name" value="${h(E.title)}" style="font-weight:650;font-size:19px" autocapitalize="words"></div>
        <div class="row"><textarea data-k="description" rows="2" placeholder="A short description (optional)">${h(E.description)}</textarea></div>
      </div>

      <div class="group-title">Details</div>
      <div class="group">
        <div class="row"><label>Course</label><input data-k="course" list="dlCourse" placeholder="Dinner" value="${h(E.course)}" autocapitalize="words"></div>
        <div class="row"><label>Cuisine</label><input data-k="cuisine" list="dlCuisine" placeholder="Italian" value="${h(E.cuisine)}" autocapitalize="words"></div>
        <div class="row"><label>Protein</label><input data-k="protein" list="dlProtein" placeholder="Chicken" value="${h(E.protein)}" autocapitalize="words"></div>
        <div class="row"><label>Serves</label><input data-k="servings" placeholder="4" value="${h(E.servings)}" inputmode="text"></div>
        <div class="seg-row"><div class="segmented" id="diffSeg" role="group" aria-label="Difficulty">${["Easy", "Medium", "Hard"].map((d) => `<button data-diff="${d}" aria-pressed="${E.difficulty === d}">${d}</button>`).join("")}</div></div>
      </div>
      ${dl("dlCourse", COURSES, known("course"))}${dl("dlCuisine", CUISINES, known("cuisine"))}${dl("dlProtein", PROTEINS, known("protein"))}${dl("dlCredit", [], known("credit"))}

      <div class="group-title">Time (minutes)</div>
      <div class="group"><div class="pair">
        <div class="row"><label>Prep</label><input data-k="prep_min" inputmode="numeric" placeholder="0" value="${h(E.prep_min)}"></div>
        <div class="row"><label>Cook</label><input data-k="cook_min" inputmode="numeric" placeholder="0" value="${h(E.cook_min)}"></div></div>
        <div class="row"><label>Total</label><input data-k="total_min" inputmode="numeric" id="totalIn" placeholder="auto" value="${h(E.total_min)}" style="text-align:right"></div>
      </div>

      <div class="group-title">Ingredients</div>
      <div class="group">
        <div class="row stack"><textarea data-k="ingText" id="ingText" rows="5" placeholder="2 cups flour&#10;1 tsp salt&#10;3 eggs, beaten&#10;&#10;Frosting:&#10;1 cup powdered sugar">${h(E.ingText)}</textarea></div>
        <button class="parsed-toggle" data-act="toggle-parsed" id="parsedToggle"></button>
        <ul class="parsed" id="parsed" hidden></ul>
      </div>
      <p class="hint">One per line — paste straight from a website or text. End a line with a colon to start a section (“Frosting:”).</p>

      <div class="group-title">Steps</div>
      <div class="group"><div class="row stack"><textarea data-k="stepText" id="stepText" rows="5" placeholder="Preheat the oven to 350°F.&#10;Whisk the dry ingredients.&#10;…">${h(E.stepText)}</textarea></div></div>
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

      <button class="btn primary block" style="margin-top:26px" data-act="save">Save recipe</button>
      ${E.id ? `<button class="btn danger block" style="margin-top:12px" data-act="delete">${icon("trash", "sm")} Delete recipe</button>` : ""}
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
  };
  for (const b of $$('[data-act="save"]')) b.disabled = true;
  try {
    const id = await store.saveRecipe(payload);
    await reload();
    S.detail = null;
    closeSheet("editorSheet");
    toast(E.id ? "Saved" : "Added to the recipe box 🍑");
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
    toast("Recipe deleted");
  } catch (e) { toast(e.message); }
}

// ------------------------------------------------------------------ events
document.addEventListener("click", async (e) => {
  const t = e.target.closest("button, [data-open], [data-act], [data-ck]");
  if (!t) return;
  const d = t.dataset;

  if (d.ck) { S.ck.has(d.ck) ? S.ck.delete(d.ck) : S.ck.add(d.ck); return t.classList.toggle("done"); }
  if (d.open) return go("#/r/" + d.open);
  if (d.tab) { if (d.tab === S.tab && !$$(".sheet.open").length) { window.scrollTo({ top: 0, behavior: "smooth" }); return syncNow(false); } return go("#/" + d.tab); }
  if (d.f) { // filter chip
    const set = (S.filters[d.f] ||= new Set());
    set.has(d.v) ? set.delete(d.v) : set.add(d.v);
    return renderHome();
  }
  if (d.fam) { S.famTab = d.fam; return renderFavorites(); }
  if (d.toggle) { S.open.has(d.toggle) ? S.open.delete(d.toggle) : S.open.add(d.toggle); return renderHome(); }
  if (d.pin) return togglePin(d.pin);
  if (d.edit) return go("#/edit/" + d.edit);
  if (d.rate) return rate(d.rid || S.detail.id, +d.rate);
  if (d.scale) { S.scale = +d.scale; return renderDetail(); }
  if (d.diff) { E.difficulty = E.difficulty === d.diff ? "" : d.diff; for (const b of $$("#diffSeg button")) b.setAttribute("aria-pressed", b.dataset.diff === E.difficulty); return; }
  if (d.tag) return addTag(d.tag);
  if (d.untag) { E.tags = E.tags.filter((x) => x !== d.untag); return rerenderKeepScroll(); }
  if (d.setfam) { S.me.family_id = d.setfam; await store.updateProfile({ family_id: d.setfam }).catch((er) => toast(er.message)); await reload(); return toast("Family updated"); }
  if (d.color) { for (const s of $$(".swatch")) s.setAttribute("aria-pressed", s === t); return; }

  switch (d.act) {
    case "new": return go("#/new");
    case "expand-all": visibleIds.forEach((id) => S.open.add(id)); return renderHome();
    case "collapse-all": S.open.clear(); return renderHome();
    case "clear-filters": S.filters = {}; S.q = ""; $("#q").value = ""; return renderHome();
    case "close-detail": return back("#/" + S.tab);
    case "pin": return togglePin(S.detail.id);
    case "edit": return go("#/edit/" + S.detail.id);
    case "wake": return toggleWake();
    case "share": {
      const url = `${location.origin}${location.pathname}#/r/${S.detail.id}`;
      if (navigator.share) return navigator.share({ title: S.detail.title, url }).catch(() => {});
      await navigator.clipboard?.writeText(url); return toast("Link copied");
    }
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
    case "photo": return $("#photoInput").click();
    case "img-url": $("#imgUrlRow").hidden = false; return $('#imgUrlRow input').focus();
    case "img-clear": E.image_url = ""; return rerenderKeepScroll();
    case "toggle-parsed": $("#parsed").hidden = !$("#parsed").hidden; return updateParsed();
    case "new-family": $("#newFam").hidden = false; return $("#newFamName").focus();
    case "add-family": {
      const name = $("#newFamName").value.trim(); if (!name) return;
      const color = $(".swatch[aria-pressed=true]")?.dataset.color || FAMILY_COLORS[0];
      try { const f = await store.createFamily(name, color); await store.updateProfile({ family_id: f.id }); S.me.family_id = f.id; await reload(); toast(`Welcome, ${name} family!`); }
      catch (er) { toast(er.message); }
      return;
    }
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
  const k = el.dataset.k;
  if (!k || !E) return;
  E[k] = el.value;
  if (el.tagName === "TEXTAREA") autosize(el);
  if (k === "ingText") updateParsedSoon();
  if (k === "prep_min" || k === "cook_min") autoTotal();
  if (k === "image_url") debounce(() => rerenderKeepScroll('#imgUrlRow input'), 900)();
});
const renderHomeSoon = debounce(renderHome, 120);
const saveNameSoon = debounce(async (v) => { S.me.display_name = v.trim(); await store.updateProfile({ display_name: v.trim() }).catch((er) => toast(er.message)); const p = profile(S.me.id); if (p) p.display_name = v.trim(); renderFavorites(); }, 700);

document.addEventListener("keydown", (e) => {
  if (e.target.id === "tagIn" && (e.key === "Enter" || e.key === ",")) { e.preventDefault(); if (e.target.value.trim()) { addTag(e.target.value); $("#tagIn")?.focus(); } }
  if (e.target.id === "tagIn" && e.key === "Backspace" && !e.target.value && E.tags.length) { E.tags.pop(); rerenderKeepScroll("#tagIn"); }
  if (e.target.id === "impUrl" && e.key === "Enter") { e.preventDefault(); doImport(); }
  if (e.key === "Escape") {
    if ($("#editorSheet").classList.contains("open")) back(E?.id ? "#/r/" + E.id : "#/" + S.tab);
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
  if ($("#editorSheet").classList.contains("open")) return;
  back("#/" + S.tab);
});
$("#photoInput").addEventListener("change", async (e) => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f || !E) return;
  const well = $(".photo"); well.innerHTML = `<span class="ph"><span class="spin" style="color:var(--peach-deep)"></span>Uploading…</span>`;
  try { E.image_url = await store.uploadImage(f); } catch (er) { toast(er.message); }
  rerenderKeepScroll();
});

// ------------------------------------------------------------------ boot
async function reload() {
  const { ingredients = [], steps = [], ...d } = await store.loadAll();
  Object.assign(S, d);
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
