// Supabase Edge Function: import-recipe
// POST { url } → { recipe } parsed from the page's schema.org Recipe data.
// Deploy:  supabase functions deploy import-recipe
import { createClient } from "jsr:@supabase/supabase-js@2";
import { extractRecipe } from "./extract.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Block obvious internal targets so this can't be used to probe private networks.
function isPrivateHost(host: string) {
  return /^(localhost|0\.0\.0\.0|\[?::1\]?)$/i.test(host) ||
    /^(10|127)\.\d+\.\d+\.\d+$/.test(host) ||
    /^192\.168\.\d+\.\d+$/.test(host) ||
    /^169\.254\.\d+\.\d+$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host) ||
    host.endsWith(".internal") || host.endsWith(".local");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // Only allow-listed family members may use the importer.
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: member } = await sb.rpc("is_member");
  if (member !== true) return json({ error: "Not authorized" }, 403);

  let target: URL;
  try {
    const { url } = await req.json();
    target = new URL(String(url).trim());
    if (!/^https?:$/.test(target.protocol) || isPrivateHost(target.hostname)) throw new Error();
  } catch {
    return json({ error: "That doesn't look like a valid web link." }, 400);
  }

  try {
    const res = await fetch(target, {
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return json({ error: `The site responded with ${res.status}. Try copying the recipe text instead.` }, 502);
    const html = (await res.text()).slice(0, 3_000_000);
    const recipe = extractRecipe(html, res.url || target.href);
    if (!recipe) return json({ error: "Couldn't find a recipe on that page." }, 422);
    return json({ recipe });
  } catch (e) {
    return json({ error: `Couldn't reach that page (${(e as Error).message}).` }, 502);
  }
});
