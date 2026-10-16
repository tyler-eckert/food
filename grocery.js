// Grocery list consolidation: "½ onion" + "½ onion" → "1 onion", "2 tbsp butter" + "¼ cup butter" → "6 tbsp butter".
import { qtyToNumber, formatNumber } from "./parse.js";

// Convertible units → base amount (volume in tsp, weight in oz).
const VOLUME = { tsp: 1, tbsp: 3, "fl oz": 6, cup: 48, pt: 96, qt: 192, gal: 768, ml: 0.202884, l: 202.884 };
const WEIGHT = { oz: 1, lb: 16, g: 0.035274, kg: 35.274 };
const COUNT_PLURAL = new Set(["clove", "can", "jar", "stick", "slice", "bunch", "sprig", "head", "handful", "box", "bag", "envelope", "stalk", "container", "block", "link", "wedge", "sleeve", "shot", "dollop", "slab", "pinch", "dash", "loaf", "pkg"]);

// Words that describe prep or size, not what you buy.
// ("diced", "crushed", "shredded", "sliced" stay — they usually name a product: diced tomatoes, shredded cheese.)
const DESCRIPTORS = /\b(fresh|freshly|large|medium|small|extra|finely|roughly|coarsely|thinly|chopped|minced|grated|peeled|halved|quartered|cubed|melted|softened|divided|packed|heaping|level|ripe|cold|warm|room temperature|to taste|optional)\b/g;
const NO_SINGULAR = new Set(["molasses", "hummus", "asparagus", "swiss", "couscous", "grits", "brussels", "oats", "greens", "lemongrass", "bass", "glass", "series", "species", "chips", "sprinkles"]);

export function singular(word) {
  if (NO_SINGULAR.has(word) || word.length < 4) return word;
  if (/ies$/.test(word)) return word.slice(0, -3) + "y";              // berries → berry
  if (/(tomato|potato|mango|avocado|jalapeno)es$/.test(word)) return word.slice(0, -2);
  if (/(ch|sh|x|ss)es$/.test(word)) return word.slice(0, -2);          // peaches → peach
  if (/[^s]s$/.test(word) && !/(us|is)$/.test(word)) return word.slice(0, -1); // onions → onion
  return word;
}
export function pluralize(word) {
  if (/s$/.test(word)) return word;
  if (/[^aeiou]y$/.test(word)) return word.slice(0, -1) + "ies";
  if (/(ch|sh|x|tomato|potato)$/.test(word)) return word + "es";
  return word + "s";
}
/** "Yellow Onions, diced" → "yellow onion" (the key items are matched on). */
export function nameKey(name) {
  let s = String(name || "").toLowerCase().replace(/\([^)]*\)/g, " ").split(",")[0];
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");                  // jalapeño → jalapeno
  s = s.replace(DESCRIPTORS, " ").replace(/[^a-z0-9&' -]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) s = String(name || "").toLowerCase().trim();
  const words = s.split(" ");
  words[words.length - 1] = singular(words[words.length - 1]);
  return words.join(" ");
}

// "Onions" → "Onion" (keeps the original capitalization) so totals can re-pluralize correctly.
const n1 = (name) => { const w = name.split(" "); const last = w.pop(); const sg = singular(last.toLowerCase()); return [...w, last.slice(0, sg.length) + (sg.length > last.length ? sg.slice(last.length) : "")].join(" "); };
/** "Cups" → "cup", "cloves" → "clove" (stored units are usually canonical already). */
const ALL_UNITS = new Set([...Object.keys(VOLUME), ...Object.keys(WEIGHT), ...COUNT_PLURAL]);
const normUnit = (u) => { u = String(u || "").trim().toLowerCase().replace(/\.$/, ""); return ALL_UNITS.has(u) ? u : u.endsWith("es") && ALL_UNITS.has(u.slice(0, -2)) ? u.slice(0, -2) : u.endsWith("s") && ALL_UNITS.has(u.slice(0, -1)) ? u.slice(0, -1) : u; };
const plU = (n, u) => (n > 1 && u === "cup" ? "cups" : u);
const unitKind = (u) => (u in VOLUME ? "volume" : u in WEIGHT ? "weight" : "count:" + (u || ""));
const amountOf = (q) => { const n = qtyToNumber(q); return n ? Math.max(...n) : null; }; // ranges → buy for the high end

function fmtCount(n, unit, name) {
  const amt = formatNumber(n);
  if (!unit) return { qty: amt, name: n > 1 ? pluralize(name) : name };
  const u = n > 1 && COUNT_PLURAL.has(unit) ? (unit === "loaf" ? "loaves" : /(ch|sh|x)$/.test(unit) ? unit + "es" : unit + "s") : unit;
  return { qty: `${amt} ${u}`, name };
}
function fmtVolume(tsp, units) {
  const only = units.size === 1 ? [...units][0] : null;
  if (only) return `${formatNumber(tsp / VOLUME[only])} ${plU(tsp / VOLUME[only], only)}`; // all the same unit → keep it
  if (tsp >= 24) return `${formatNumber(tsp / 48)} ${plU(tsp / 48, "cup")}`;              // ½ cup or more → cups
  if (tsp >= 3) {                                                          // tablespoons (+ leftover tsp)
    const tb = Math.floor(tsp / 3 + 1e-9), rest = tsp - tb * 3;
    return rest > 0.05 ? `${tb} tbsp + ${formatNumber(rest)} tsp` : `${formatNumber(tsp / 3)} tbsp`;
  }
  return `${formatNumber(tsp)} tsp`;
}
function fmtWeight(oz, units) {
  const only = units.size === 1 ? [...units][0] : null;
  if (only) return `${formatNumber(oz / WEIGHT[only])} ${only}`;
  if ([...units].every((u) => u === "g" || u === "kg")) return oz >= 35.274 ? `${formatNumber(oz / 35.274)} kg` : `${Math.round(oz / 0.035274)} g`;
  return oz >= 16 ? `${formatNumber(oz / 16)} lb` : `${formatNumber(oz)} oz`;
}

/**
 * items: grocery rows { id, name, quantity, unit, note, recipe_id, recipe_title, checked, ... }
 * → [{ key, ids, name, qty, sources[], notes[], checked, count }] in first-seen order.
 */
export function combineGrocery(items) {
  const groups = new Map();
  for (const it of items) {
    const key = nameKey(it.name);
    if (!groups.has(key)) groups.set(key, { key, items: [] });
    groups.get(key).items.push(it);
  }
  return [...groups.values()].map(({ key, items: rows }) => {
    const name = String(rows[0].name || "").split(",")[0].trim() || key;
    const buckets = new Map(); // kind → { total, units:Set, unit }
    let unquantified = 0;
    for (const r of rows) {
      const n = amountOf(r.quantity);
      if (n == null) { unquantified++; continue; }
      const u = normUnit(r.unit), kind = unitKind(u);
      if (!buckets.has(kind)) buckets.set(kind, { total: 0, units: new Set(), unit: u });
      const b = buckets.get(kind);
      b.total += n * (kind === "volume" ? VOLUME[u] : kind === "weight" ? WEIGHT[u] : 1);
      b.units.add(u);
    }
    let displayName = name;
    const parts = [...buckets.entries()].map(([kind, b]) => {
      if (kind === "volume") return fmtVolume(b.total, b.units);
      if (kind === "weight") return fmtWeight(b.total, b.units);
      const c = fmtCount(b.total, b.unit, n1(name));
      if (!b.unit && buckets.size === 1) displayName = c.name;
      return c.qty;
    });
    const sources = [...new Set(rows.map((r) => (r.recipe_id ? r.recipe_title || "Recipe" : "Added by hand")))];
    const notes = [...new Set(rows.map((r) => r.note).filter(Boolean))];
    return {
      key, ids: rows.map((r) => r.id), name: displayName,
      qty: parts.join(" + ") + (parts.length && unquantified ? " + more" : ""),
      sources, notes, count: rows.length, checked: rows.every((r) => r.checked),
    };
  });
}
