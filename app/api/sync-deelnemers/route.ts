import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseDeelnemersFile } from "@/lib/excel";
import { normalizeKlasse } from "@/lib/utils";

export async function POST() {
  try {
    const sheetId = process.env.GOOGLE_SHEETS_ID;
    const gid = process.env.GOOGLE_SHEETS_GID;

    if (!sheetId || !gid) {
      return NextResponse.json(
        { error: "GOOGLE_SHEETS_ID en GOOGLE_SHEETS_GID zijn niet ingesteld." },
        { status: 500 }
      );
    }

    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx&gid=${gid}`;
    const response = await fetch(url);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Google Sheets ophalen mislukt: ${response.status}` },
        { status: 502 }
      );
    }

    const buffer = await response.arrayBuffer();
    const deelnemers = parseDeelnemersFile(buffer);

    if (!deelnemers || deelnemers.length === 0) {
      return NextResponse.json(
        { error: "Geen geldige deelnemers gevonden in sheet." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const bibs = deelnemers.map((d: { bib: number }) => d.bib);

    const [{ data: existing }, { data: latestRace }] = await Promise.all([
      supabase.from("deelnemers").select("bib, klasse").in("bib", bibs),
      supabase
        .from("races")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .single(),
    ]);

    // ✅ FIX: determine correct from_week
    const currentWeek = (latestRace?.sort_order ?? 0) + 1;

    const existingMap = new Map(
      (existing ?? []).map((r: { bib: number; klasse: string }) => [
        r.bib,
        r.klasse,
      ])
    );

    const historyRows = deelnemers
      .filter((d: { bib: number; klasse: string }) => {
        const oldKlasse = existingMap.get(d.bib);
        return (
          oldKlasse !== undefined &&
          normalizeKlasse(oldKlasse) !== normalizeKlasse(d.klasse)
        );
      })
      .map((d: { bib: number; klasse: string }) => ({
        bib: d.bib,
        old_klasse: normalizeKlasse(existingMap.get(d.bib) as string),
        new_klasse: normalizeKlasse(d.klasse),
        from_week: currentWeek,
      }));

    if (historyRows.length > 0) {
      const { error: histError } = await supabase
        .from("klasse_history")
        .insert(historyRows);
      if (histError) console.error(histError);
    }

    const { error } = await supabase
      .from("deelnemers")
      .upsert(deelnemers, { onConflict: "bib" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      count: deelnemers.length,
      switches: historyRows.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}