import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseFinishFile } from "@/lib/excel";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const week = parseInt(formData.get("week") as string);

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (isNaN(week) || week < 1 || week > 20)
      return NextResponse.json({ error: "Invalid week number" }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const parsed = parseFinishFile(buffer);

    if (parsed.length === 0)
      return NextResponse.json(
        { error: "No valid results found in file. Check column names (bib, pl)." },
        { status: 400 }
      );

    const supabase = getSupabaseAdmin();

    // Fetch all deelnemers for naam lookup
    const { data: deelnemers } = await supabase
      .from("deelnemers")
      .select("bib, naam, klasse");

    const deelnemerList: { bib: number; naam: string; klasse: string }[] =
      deelnemers ?? [];

    const bibByBib = new Map<number, { naam: string; klasse: string }>(
      deelnemerList.map((d) => [d.bib, { naam: d.naam, klasse: d.klasse }])
    );

    // Normalize naam for matching (lowercase, trim)
    const normalize = (s: string) => s.toLowerCase().trim();
    const bibByNaam = new Map<string, number>(
      deelnemerList.map((d) => [normalize(d.naam), d.bib])
    );

    const results = [];
    const warnings: string[] = [];

    for (const row of parsed) {
      // Always resolve via naam — ignore whatever bib is in the file
      if (!row.naam) {
        warnings.push(`Rij zonder naam overgeslagen (plaats ${row.plaats})`);
        continue;
      }

      const resolvedBib = bibByNaam.get(normalize(row.naam)) ?? null;

      if (resolvedBib === null) {
        warnings.push(`Naam "${row.naam}" niet gevonden in deelnemerslijst — overgeslagen`);
        continue;
      }

      const klasse = bibByBib.get(resolvedBib)?.klasse ?? null;
      results.push({ bib: resolvedBib, plaats: row.plaats, week, klasse });
    }

    if (results.length === 0)
      return NextResponse.json(
        { error: "Geen geldige deelnemers gevonden na koppeling." },
        { status: 400 }
      );

    // Delete existing results for this week, then insert
    await supabase.from("race_results").delete().eq("week", week);
    const { error } = await supabase.from("race_results").insert(results);
    if (error) throw error;

    // Update current_week in config if needed
    const { data: config } = await supabase
      .from("config")
      .select("*")
      .eq("id", 1)
      .single();
    if (week >= (config?.current_week ?? 1)) {
      await supabase.from("config").upsert({ id: 1, current_week: week });
    }

    return NextResponse.json({ success: true, count: results.length, week, warnings });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}