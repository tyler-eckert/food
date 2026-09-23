// Pulls a recipe out of a web page's HTML.
// 1) schema.org/Recipe JSON-LD (used by ~all major recipe sites & WordPress recipe plugins)
// 2) microdata (itemprop="recipeIngredient")
// 3) OpenGraph title/image/description as a last resort

export type ImportedRecipe = {
  title: string;
  description?: string;
  image_url?: string;
  source_url: string;
  servings?: string;
  prep_min?: number;
  cook_min?: number;
  total_min?: number;
  course?: string;
  cuisine?: string;
  tags: string[];
  ingredients: string[]; // raw lines — the app parses qty/unit/name
  steps: { section?: string; body: string }[];
  partial?: boolean;
};

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—",
  frac12: "½", frac14: "¼", frac34: "¾", deg: "°", hellip: "…", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“", eacute: "é", egrave: "è", ntilde: "ñ", reg: "®", trade: "™", copy: "©",
};

export function clean(s: unknown): string {
  if (s == null) return "";
  let t = String(s);
  t = t.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|li|div)>/gi, "\n").replace(/<[^>]+>/g, "");
  for (let i = 0; i < 2; i++) {
    t = t.replace(/&(#x?[0-9a-f]+|[a-z]+\d*);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    });
  }
  return t.replace(/[ \t ]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}

/** ISO-8601 duration ("PT1H30M", "P0DT0H20M", "PT90M") → minutes */
export function isoMinutes(d: unknown): number | undefined {
  if (typeof d !== "string") return undefined;
  const m = d.trim().match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!m) return undefined;
  const mins = (+(m[1] || 0)) * 1440 + (+(m[2] || 0)) * 60 + (+(m[3] || 0)) + (+(m[4] || 0)) / 60;
  return mins > 0 ? Math.round(mins) : undefined;
}

function first(v: unknown): unknown {
  return Array.isArray(v) ? v[0] : v;
}

function asText(v: unknown): string {
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(", ");
  if (v && typeof v === "object") return clean((v as any).name ?? (v as any)["@value"] ?? "");
  return clean(v);
}

function imageOf(v: unknown): string | undefined {
  if (!v) return undefined;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    // prefer the largest if objects carry width
    const objs = v.filter((x) => x && typeof x === "object") as any[];
    if (objs.length && objs.some((o) => o.width)) {
      objs.sort((a, b) => (+b.width || 0) - (+a.width || 0));
      return imageOf(objs[0]);
    }
    return imageOf(v[0]);
  }
  if (typeof v === "object") return (v as any).url ?? (v as any).contentUrl ?? (v as any)["@id"];
  return undefined;
}

function isRecipe(node: any): boolean {
  const t = node?.["@type"];
  return t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"));
}

function findRecipe(node: any, depth = 0): any | undefined {
  if (!node || typeof node !== "object" || depth > 8) return undefined;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipe(n, depth + 1);
      if (r) return r;
    }
    return undefined;
  }
  if (isRecipe(node)) return node;
  for (const key of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement", "item"]) {
    if (node[key]) {
      const r = findRecipe(node[key], depth + 1);
      if (r) return r;
    }
  }
  return undefined;
}

function parseJsonLoose(txt: string): unknown {
  const s = txt.trim().replace(/^<!\[CDATA\[|\]\]>$/g, "");
  try { return JSON.parse(s); } catch { /* try harder */ }
  try { return JSON.parse(s.replace(/[\u0000-\u001f]+/g, " ")); } catch { /* */ }
  try { return JSON.parse(s.replace(/,\s*([}\]])/g, "$1").replace(/[\u0000-\u001f]+/g, " ")); } catch { return undefined; }
}

function splitLines(s: string): string[] {
  return clean(s).split(/\n+/).map((x) => x.trim()).filter(Boolean);
}

function stepsFrom(instr: unknown, section?: string, out: { section?: string; body: string }[] = []) {
  if (!instr) return out;
  if (typeof instr === "string") {
    for (const line of splitLines(instr)) out.push({ section, body: line });
  } else if (Array.isArray(instr)) {
    for (const i of instr) stepsFrom(i, section, out);
  } else if (typeof instr === "object") {
    const o = instr as any;
    const type = Array.isArray(o["@type"]) ? o["@type"][0] : o["@type"];
    if (type === "HowToSection" || (o.itemListElement && !o.text)) {
      stepsFrom(o.itemListElement, clean(o.name) || section, out);
    } else {
      const body = clean(o.text ?? o.name ?? o.description ?? "");
      if (body) for (const line of body.split(/\n+/)) if (line.trim()) out.push({ section, body: line.trim() });
    }
  }
  return out;
}

function tagsFrom(r: any): string[] {
  let kw: string[] = [];
  if (Array.isArray(r.keywords)) kw = r.keywords.map(asText);
  else if (typeof r.keywords === "string") kw = r.keywords.split(/[,;]/);
  const extra = [r.suitableForDiet].flat().filter(Boolean).map((d: any) =>
    String(d).replace(/^https?:\/\/schema\.org\//, "").replace(/Diet$/, "").replace(/([a-z])([A-Z])/g, "$1 $2"));
  const seen = new Set<string>();
  return [...kw, ...extra]
    .map((t) => clean(t).toLowerCase())
    .filter((t) => t && t.length <= 24 && !seen.has(t) && seen.add(t))
    .slice(0, 8);
}

function yieldOf(v: unknown): string | undefined {
  const arr = [v].flat().map(asText).filter(Boolean);
  return arr.find((x) => /\d/.test(x) && !/^\d+$/.test(x)) ?? arr[0];
}

function meta(html: string, prop: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, "i");
  const m = html.match(re);
  return m ? clean(m[1] ?? m[2]) : undefined;
}

export function extractRecipe(html: string, url: string): ImportedRecipe | null {
  // 1) JSON-LD
  const scripts = html.matchAll(/<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi);
  for (const s of scripts) {
    const data = parseJsonLoose(s[1]);
    const r = findRecipe(data);
    if (!r) continue;
    const ingredients = [r.recipeIngredient ?? r.ingredients ?? []].flat().map((x: unknown) => clean(x)).filter(Boolean);
    const prep = isoMinutes(r.prepTime), cook = isoMinutes(r.cookTime);
    let total = isoMinutes(r.totalTime);
    if (!total && (prep || cook)) total = (prep ?? 0) + (cook ?? 0);
    return {
      title: asText(r.name) || meta(html, "og:title") || "Untitled recipe",
      description: asText(r.description) || undefined,
      image_url: imageOf(r.image) || meta(html, "og:image"),
      source_url: url,
      servings: yieldOf(r.recipeYield),
      prep_min: prep, cook_min: cook, total_min: total,
      course: asText(first(r.recipeCategory)) || undefined,
      cuisine: asText(first(r.recipeCuisine)) || undefined,
      tags: tagsFrom(r),
      ingredients,
      steps: stepsFrom(r.recipeInstructions),
    };
  }

  // 2) Microdata
  const ing = [...html.matchAll(/itemprop=["'](?:recipeIngredient|ingredients)["'][^>]*>([\s\S]*?)<\/(?:li|span|p|div)>/gi)]
    .map((m) => clean(m[1])).filter(Boolean);
  const title = meta(html, "og:title") ?? clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  if (ing.length) {
    const steps = [...html.matchAll(/itemprop=["']recipeInstructions["'][^>]*>([\s\S]*?)<\/(?:ol|div|section)>/gi)]
      .flatMap((m) => splitLines(m[1])).map((body) => ({ body }));
    return { title: title || "Untitled recipe", source_url: url, image_url: meta(html, "og:image"),
             description: meta(html, "og:description"), tags: [], ingredients: ing, steps, partial: true };
  }

  // 3) OpenGraph only — at least prefill title/photo
  if (title) {
    return { title, source_url: url, image_url: meta(html, "og:image"), description: meta(html, "og:description"),
             tags: [], ingredients: [], steps: [], partial: true };
  }
  return null;
}
