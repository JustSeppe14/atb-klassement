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
    const results = parseFinishFile(buffer);

    if (results.length === 0)
      return NextResponse.json({ error: "No valid results found in file. Check column names (bib, pl)." }, { status: 400 });

    const supabase = getSupabaseAdmin();

    // Fetch current klasse for all bibs so we can snapshot it on the result row
    const bibs = results.map((r) => r.bib);
    const { data: deelnemers } = await supabase
      .from("deelnemers")
      .select("bib, klasse")
      .in("bib", bibs);

    const klasseByBib = new Map<number, string>(
      (deelnemers ?? []).map((d: { bib: number; klasse: string }) => [d.bib, d.klasse])
    );

    // Attach week number and current klasse snapshot
    const withWeek = results.map((r) => ({
      ...r,
      week,
      klasse: klasseByBib.get(r.bib) ?? null,
    }));

    // Delete existing results for this week first
    await supabase.from("race_results").delete().eq("week", week);

    // Insert new results
    const { error } = await supabase.from("race_results").insert(withWeek);
    if (error) throw error;

    // Update current_week in config if this is a new week
    const { data: config } = await supabase.from("config").select("*").eq("id", 1).single();
    const currentWeek = config?.current_week ?? 1;
    if (week >= currentWeek) {
      await supabase.from("config").upsert({ id: 1, current_week: week });
    }

    return NextResponse.json({ success: true, count: results.length, week });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}