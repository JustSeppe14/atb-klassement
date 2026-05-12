import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseFinishFile } from "@/lib/excel";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const week = parseInt(formData.get("week") as string);
    const customPoints = parseInt(formData.get("customPoints") as string);

    if (!file) return NextResponse.json({ error: "Geen bestand opgegeven" }, { status: 400 });
    if (isNaN(week) || week < 1 || week > 20)
      return NextResponse.json({ error: "Ongeldig weeknummer" }, { status: 400 });
    if (isNaN(customPoints) || customPoints < 0)
      return NextResponse.json({ error: "Ongeldige puntwaarde" }, { status: 400 });

    const buffer = await file.arrayBuffer();
    // Reuse the standard finish file parser (naam + pl/plaats columns)
    const parsed = parseFinishFile(buffer);

    if (parsed.length === 0)
      return NextResponse.json(
        { error: "Geen geldige rijen gevonden in het bestand. Controleer de kolomnamen (naam, pl)." },
        { status: 400 }
      );

    const supabase = getSupabaseAdmin();

    // Fetch all participants
    const { data: deelnemers, error: deelErr } = await supabase
      .from("deelnemers")
      .select("bib, naam, klasse");

    if (deelErr) throw deelErr;
    const deelnemerList: { bib: number; naam: string; klasse: string }[] = deelnemers ?? [];

    const normalize = (s: string) => s.toLowerCase().trim();
    const bibByNaam = new Map<string, { bib: number; klasse: string }>(
      deelnemerList.map((d) => [normalize(d.naam), { bib: d.bib, klasse: d.klasse }])
    );

    // Build the set of bibs present in the file (matched by naam)
    const presentBibs = new Set<number>();
    const warnings: string[] = [];

    for (const row of parsed) {
      if (!row.naam) continue;
      const match = bibByNaam.get(normalize(row.naam));
      if (!match) {
        warnings.push(`Naam "${row.naam}" niet gevonden in deelnemerslijst — overgeslagen`);
        continue;
      }
      presentBibs.add(match.bib);
    }

    if (presentBibs.size === 0)
      return NextResponse.json(
        { error: "Geen enkele naam kon worden gekoppeld aan een deelnemer.", warnings },
        { status: 400 }
      );

    const DNS_POINTS = 80;

    // All participants: riders in the file → customPoints, others → 80 DNS
    const results = deelnemerList.map((d) => {
      const points = presentBibs.has(d.bib) ? customPoints : DNS_POINTS;
      return {
        bib: d.bib,
        plaats: points,        // stored for sorting/display purposes
        week,
        klasse: d.klasse,
        override_points: points, // used directly by klassement engine
      };
    });

    // Delete existing results for this week, then insert all
    await supabase.from("race_results").delete().eq("week", week);
    const { error: insertErr } = await supabase.from("race_results").insert(results);
    if (insertErr) throw insertErr;

    // Update current_week in config if needed
    const { data: config } = await supabase
      .from("config")
      .select("*")
      .eq("id", 1)
      .single();
    if (week >= (config?.current_week ?? 1)) {
      await supabase.from("config").upsert({ id: 1, current_week: week });
    }

    return NextResponse.json({
      success: true,
      overrideCount: presentBibs.size,
      dnsCount: deelnemerList.length - presentBibs.size,
      totalCount: results.length,
      week,
      warnings,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}