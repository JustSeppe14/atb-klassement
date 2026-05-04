import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseDeelnemersFile } from "@/lib/excel";
import { normalizeKlasse } from "@/lib/utils";

async function getCurrentWeek(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data: latestRace } = await supabase
    .from("races")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  return (latestRace?.sort_order ?? 0) + 1;
}

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("deelnemers").select("*").order("bib");
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    const supabase = getSupabaseAdmin();

    const currentWeek = await getCurrentWeek(supabase);

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File;

      const buffer = await file.arrayBuffer();
      const deelnemers = parseDeelnemersFile(buffer);

      const bibs = deelnemers.map((d: { bib: number }) => d.bib);

      const { data: existing } = await supabase
        .from("deelnemers")
        .select("bib, klasse")
        .in("bib", bibs);

      const existingMap = new Map(
        (existing ?? []).map((r: any) => [r.bib, r.klasse])
      );

      const historyRows = deelnemers
        .filter((d: any) => {
          const oldKlasse = existingMap.get(d.bib);
          return (
            oldKlasse &&
            normalizeKlasse(oldKlasse) !== normalizeKlasse(d.klasse)
          );
        })
        .map((d: any) => ({
          bib: d.bib,
          old_klasse: normalizeKlasse(existingMap.get(d.bib)),
          new_klasse: normalizeKlasse(d.klasse),
          from_week: currentWeek,
        }));

      if (historyRows.length) {
        await supabase.from("klasse_history").insert(historyRows);
      }

      await supabase.from("deelnemers").upsert(deelnemers, {
        onConflict: "bib",
      });

      return NextResponse.json({ success: true, count: deelnemers.length });
    }

    // single rider
    const body = await req.json();

    if (body.bib) {
      const { data: existing } = await supabase
        .from("deelnemers")
        .select("klasse")
        .eq("bib", body.bib)
        .maybeSingle();

      if (existing) {
        const oldKlasse = normalizeKlasse(existing.klasse);
        const newKlasse = normalizeKlasse(body.klasse);

        if (oldKlasse !== newKlasse) {
          await supabase.from("klasse_history").insert({
            bib: body.bib,
            old_klasse: oldKlasse,
            new_klasse: newKlasse,
            from_week: currentWeek,
          });
        }
      }
    }

    await supabase.from("deelnemers").upsert(body, {
      onConflict: "bib",
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest){
  try {
    const body = await req.json();
    const {oldBib, newBib, ...rest} = body;

    if (!oldBib || !newBib) {
      return NextResponse.json({ error: 'oldBib and newBib are required'}, {status: 400});
    }

    const supabase = getSupabaseAdmin();

    const {error} = await supabase.from('deelnemers').update({bib: newBib, ...rest}).eq('bib', oldBib);

    if (error) throw error;

    await supabase.from('race_results').update({bib: newBib}).eq('bib', oldBib);
    //await supabase.from('klasse_history').update({bib: newBib}).eq('bib', oldBib);

    return NextResponse.json({ success: true})
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });

  }
}

export async function DELETE(req: NextRequest) {
  const { bib } = await req.json();
  const supabase = getSupabaseAdmin();

  await supabase.from("klasse_history").delete().eq("bib", bib);
  await supabase.from("deelnemers").delete().eq("bib", bib);

  return NextResponse.json({ success: true });
}