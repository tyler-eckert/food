// Turns free-typed / pasted text into structured ingredients & steps.

const FRAC = { "½": "1/2", "¼": "1/4", "¾": "3/4", "⅓": "1/3", "⅔": "2/3", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8", "⅕": "1/5", "⅙": "1/6" };

const UNIT_ALIASES = {
  cup: ["cup", "cups", "c"],
  tbsp: ["tablespoon", "tablespoons", "tbsp", "tbsps", "tbs", "tbl", "T"],
  tsp: ["teaspoon", "teaspoons", "tsp", "tsps", "t"],
  oz: ["ounce", "ounces", "oz"],
  "fl oz": ["fl oz", "fluid ounce", "fluid ounces"],
  lb: ["pound", "pounds", "lb", "lbs"],
  g: ["g", "gram", "grams"],
  kg: ["kg", "kilogram", "kilograms"],
  ml: ["ml", "milliliter", "milliliters", "millilitre", "millilitres"],
  l: ["l", "liter", "liters", "litre", "litres"],
  qt: ["quart", "quarts", "qt"],
  pt: ["pint", "pints", "pt"],
  gal: ["gallon", "gallons", "gal"],
  pinch: ["pinch", "pinches"],
  dash: ["dash", "dashes"],
  clove: ["clove", "cloves"],
  can: ["can", "cans"],
  jar: ["jar", "jars"],
  pkg: ["package", "packages", "pkg", "pkgs", "packet", "packets"],
  stick: ["stick", "sticks"],
  slice: ["slice", "slices"],
  bunch: ["bunch", "bunches"],
  sprig: ["sprig", "sprigs"],
  head: ["head", "heads"],
  handful: ["handful", "handfuls"],
  box: ["box", "boxes"],
  bag: ["bag", "bags"],
  envelope: ["envelope", "envelopes"],
  stalk: ["stalk", "stalks"],
  container: ["container", "containers", "tub", "tubs"],
  block: ["block", "blocks"],
  link: ["link", "links"],
  wedge: ["wedge", "wedges"],
  sleeve: ["sleeve", "sleeves"],
  shot: ["shot", "shots"],
  dollop: ["dollop", "dollops"],
  slab: ["slab", "slabs"],
  loaf: ["loaf", "loaves"],
};
const UNIT_LOOKUP = new Map();
for (const [canon, list] of Object.entries(UNIT_ALIASES)) {
  for (const a of list) UNIT_LOOKUP.set(a.length <= 1 ? a : a.toLowerCase(), canon);
}

const NUM = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)`;
const QTY_RE = new RegExp(String.raw`^(${NUM}(?:\s*(?:-|–|to)\s*${NUM})?)\s*`);

export function normalizeFractions(s) {
  return s.replace(/(\d)?(\s?)([½¼¾⅓⅔⅛⅜⅝⅞⅕⅙])/g, (m, d, sp, f) => (d ? d + " " : sp) + FRAC[f]);
}
const GLYPHS = Object.fromEntries(Object.entries(FRAC).map(([g, t]) => [t, g]));
const toGlyphs = (t) => t.replace(/\b(\d)\/(\d)\b/g, (m) => GLYPHS[m] || m);

export function isSectionLine(line) {
  const t = line.trim();
  if (!t || /^\d/.test(t)) return false;
  if (/:$/.test(t) && t.length < 48) return true;
  return /^[A-Z][A-Z &'-]{3,40}$/.test(t); // "FOR THE SAUCE"
}
export function sectionName(line) {
  const t = line.trim().replace(/:$/, "");
  return t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t;
}

export function parseIngredient(line) {
  const raw = line.trim().replace(/^[-–•*▢□☐✓◦·]\s*/, "").replace(/\s+/g, " ");
  let s = normalizeFractions(raw);
  let quantity = "", unit = "", note = "";

  const q = s.match(QTY_RE);
  if (q) { quantity = q[1].replace(/\s*(–|to)\s*/, "-").replace(/\s*-\s*/, "-"); s = s.slice(q[0].length); }

  // "1 (14 oz) can tomatoes"
  const size = s.match(/^\(([^)]+)\)\s*/);
  if (size) { note = size[1]; s = s.slice(size[0].length); }

  // unit: try two-word ("fl oz") then one word
  const two = s.match(/^([a-zA-Z]+\.?\s+[a-zA-Z]+\.?)\b\s*/);
  const one = s.match(/^([a-zA-Z]+)\.?(?=\s|$)\s*/);
  const tryUnit = (w) => UNIT_LOOKUP.get(w.length <= 1 ? w : w.toLowerCase().replace(/\./g, ""));
  if (two && tryUnit(two[1]) && two[1].includes(" ")) { unit = tryUnit(two[1]); s = s.slice(two[0].length); }
  else if (one && tryUnit(one[1]) && (quantity || one[1].length > 2)) { unit = tryUnit(one[1]); s = s.slice(one[0].length); }
  s = s.replace(/^of\s+/i, "");

  // trailing notes: ", chopped" or "(optional)"
  let name = s;
  const paren = name.match(/\s*\(([^)]*)\)\s*$/);
  if (paren) { note = [note, paren[1]].filter(Boolean).join(", "); name = name.slice(0, paren.index); }
  const comma = name.indexOf(",");
  if (comma > 0) { note = [note, name.slice(comma + 1).trim()].filter(Boolean).join(", "); name = name.slice(0, comma); }

  return { quantity, unit, name: toGlyphs(name.trim()) || raw, note: toGlyphs(note.trim()), raw };
}

/** Multi-line text → ingredient rows (lines ending in ":" start a new section). */
export function parseIngredientBlock(text) {
  let section = "";
  const out = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (isSectionLine(line)) { section = sectionName(line); continue; }
    out.push({ ...parseIngredient(line), section });
  }
  return out;
}

export function parseStepBlock(text) {
  let section = "";
  const out = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    if (isSectionLine(t) && t.length < 40) { section = sectionName(t); continue; }
    const body = t.replace(/^(step\s*)?\d+[.):]\s*/i, "").replace(/^[-•*]\s*/, "");
    if (body) out.push({ section, body });
  }
  return out;
}

/** Rebuild the editable text from stored rows. */
export function ingredientsToText(rows = []) {
  let sec = "";
  const lines = [];
  for (const r of rows) {
    if ((r.section || "") !== sec) { sec = r.section || ""; if (sec) lines.push((lines.length ? "\n" : "") + sec + ":"); }
    lines.push(r.raw || [r.quantity, r.unit, r.name].filter(Boolean).join(" ") + (r.note ? `, ${r.note}` : ""));
  }
  return lines.join("\n");
}
export function stepsToText(rows = []) {
  let sec = "";
  const lines = [];
  for (const r of rows) {
    if ((r.section || "") !== sec) { sec = r.section || ""; if (sec) lines.push((lines.length ? "\n" : "") + sec + ":"); }
    lines.push(r.body);
  }
  return lines.join("\n");
}

// ---------- quantity scaling ----------
export function qtyToNumber(q) {
  if (!q) return null;
  const part = (p) => {
    p = p.trim();
    const mixed = p.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixed) return +mixed[1] + mixed[2] / mixed[3];
    const fr = p.match(/^(\d+)\/(\d+)$/);
    if (fr) return fr[1] / fr[2];
    return /^\d+(\.\d+)?$/.test(p) ? +p : NaN;
  };
  const range = q.split("-");
  const nums = range.map(part);
  return nums.some(Number.isNaN) ? null : nums;
}
const GLYPH = [[0, ""], [1 / 8, "⅛"], [1 / 4, "¼"], [1 / 3, "⅓"], [3 / 8, "⅜"], [1 / 2, "½"], [5 / 8, "⅝"], [2 / 3, "⅔"], [3 / 4, "¾"], [7 / 8, "⅞"], [1, ""]];
export function formatNumber(n) {
  if (n >= 10) return String(Math.round(n));
  let whole = Math.floor(n), frac = n - whole, best = GLYPH[0];
  for (const g of GLYPH) if (Math.abs(g[0] - frac) < Math.abs(best[0] - frac)) best = g;
  if (best[0] === 1) { whole += 1; best = GLYPH[0]; }
  return whole === 0 && best[1] ? best[1] : `${whole || ""}${best[1]}` || "0";
}
export function scaleQty(q, factor) {
  if (!q) return "";
  const nums = qtyToNumber(q);
  if (!nums) return q;
  return nums.map((n) => formatNumber(n * factor)).join("–");
}
export function prettyQty(q) { return scaleQty(q, 1); }

/** Whole recipe pasted as text → { title, ingredients[], steps[] } using "Ingredients"/"Directions" headings. */
export function splitRecipeText(text) {
  const lines = String(text || "").split(/\r?\n/).map((l) => l.trim());
  const ING = /^(ingredients?|what you('|’)?ll need|you('|’)?ll need)\s*:?$/i;
  const STEP = /^(instructions?|directions?|method|steps|preparation|how to make( it)?)\s*:?$/i;
  let mode = "head", title = "";
  const ing = [], steps = [];
  for (const l of lines) {
    if (!l) continue;
    if (ING.test(l)) { mode = "ing"; continue; }
    if (STEP.test(l)) { mode = "step"; continue; }
    if (mode === "head") { if (!title) title = l; continue; }
    (mode === "ing" ? ing : steps).push(l);
  }
  if (!ing.length && !steps.length) {
    // No headings: lines that start with a quantity are ingredients, longer sentences are steps.
    title = "";
    for (const l of lines.filter(Boolean)) {
      if (!title && !/^\d/.test(l) && l.length < 70) { title = l; continue; }
      (/^([\d½¼¾⅓⅔⅛]|[-•*▢]\s*[\d½¼¾⅓⅔⅛])/.test(l) && l.length < 90 ? ing : steps).push(l);
    }
  }
  return { title, ingredients: ing, steps: parseStepBlock(steps.join("\n")).map((s) => s.body) };
}
