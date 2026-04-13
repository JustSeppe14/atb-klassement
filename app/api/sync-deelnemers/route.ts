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
        { error: "GOOGLE_SHEETS_ID en GOOGLE_SHEETS_GID zijn niet ingesteld in de omgevingsvariabelen." },
        { status: 500 }
      );
    }

    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx&gid=${gid}`;
    const response = await fetch(url);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Google Sheets ophalen mislukt: ${response.status} ${response.statusText}` },
        { status: 502 }
      );
    }

    const buffer = await response.arrayBuffer();
    const deelnemers = parseDeelnemersFile(buffer);

    if (!deelnemers || deelnemers.length === 0) {
      return NextResponse.json(
        { error: "Geen geldige deelnemers gevonden in het Google Sheet. Controleer de kolomnamen (nr, naam, klasse)." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch current klasse for all bibs to detect switches
    const bibs = deelnemers.map((d: { bib: number }) => d.bib);
    const { data: existing } = await supabase
      .from("deelnemers")
      .select("bib, klasse")
      .in("bib", bibs);

    const existingMap = new Map(
      (existing ?? []).map((r: { bib: number; klasse: string }) => [r.bib, r.klasse])
    );

    // Build history rows for any rider whose klasse has changed
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
      }));

    if (historyRows.length > 0) {
      const { error: histError } = await supabase
        .from("klasse_history")
        .insert(historyRows);
      if (histError) console.error("klasse_history insert error:", histError);
    }

    const { error } = await supabase
      .from("deelnemers")
      .upsert(deelnemers, { onConflict: "bib", ignoreDuplicates: false });

    if (error) {
      console.error("Supabase upsert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      count: deelnemers.length,
      switches: historyRows.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    console.error("sync-deelnemers error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}