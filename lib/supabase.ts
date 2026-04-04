import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client with service role key (for API routes)
export function getSupabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
  return createClient(supabaseUrl, serviceKey);
}

// --- Database helpers ---

export async function getDeelnemers() {
  const { data, error } = await supabase
    .from("deelnemers")
    .select("*")
    .order("bib");
  if (error) throw error;
  console.log("Fetched deelnemers:", data);
  return data;
}

export async function upsertDeelnemers(rows: object[]) {
  const { error } = await supabase
    .from("deelnemers")
    .upsert(rows, { onConflict: "bib" });
    console.log("Upserted deelnemers:", rows);
  if (error) throw error;
}

export async function getRaceResults(week?: number) {
  let query = supabase.from("race_results").select("*");
  if (week !== undefined) query = query.eq("week", week);
  const { data, error } = await query.order("week").order("plaats");
  if (error) throw error;
  return data;
}

export async function upsertRaceResults(rows: object[]) {
  const { error } = await supabase
    .from("race_results")
    .upsert(rows, { onConflict: "week,bib" });
  if (error) throw error;
}

export async function getConfig() {
  const { data, error } = await supabase
    .from("config")
    .select("*")
    .eq("id", 1)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function saveConfig(config: object) {
  const { error } = await supabase
    .from("config")
    .upsert({ id: 1, ...config });
  if (error) throw error;
}
