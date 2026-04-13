import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseDeelnemersFile } from "@/lib/excel";
import { normalizeKlasse } from "@/lib/utils";

export async function GET() {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("deelnemers")
    .select("*")
    .order("bib");

  if (error) {
    console.error("GET deelnemers error:", error);
    return NextResponse.json([]);
  }

  return NextResponse.json(Array.isArray(data) ? data : []);
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    const supabase = getSupabaseAdmin();

    if (contentType.includes("multipart/form-data")) {
      // ── File upload (bulk import) ──────────────────────────────────────────
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
      }

      const buffer = await file.arrayBuffer();
      const deelnemers = parseDeelnemersFile(buffer);

      if (!deelnemers || deelnemers.length === 0) {
        return NextResponse.json(
          { error: "No valid participants found in file" },
          { status: 400 }
        );
      }

      // Detect klasse changes vs what's currently in the DB
      const bibs = deelnemers.map((d: { bib: number }) => d.bib);
      const { data: existing } = await supabase
        .from("deelnemers")
        .select("bib, klasse")
        .in("bib", bibs);

      const existingMap = new Map(
        (existing ?? []).map((r: { bib: number; klasse: string }) => [r.bib, r.klasse])
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
        }));

      if (historyRows.length > 0) {
        await supabase.from("klasse_history").insert(historyRows);
      }

      const { error } = await supabase
        .from("deelnemers")
        .upsert(deelnemers, { onConflict: "bib", ignoreDuplicates: false });

      if (error) {
        console.error("Supabase Upsert Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, count: deelnemers.length });
    } else {
      // ── Single JSON upsert (add / edit one rider) ─────────────────────────
      const body = await req.json();

      if (!body || (Array.isArray(body) && body.length === 0)) {
        return NextResponse.json({ error: "Empty request body" }, { status: 400 });
      }

      // Detect klasse change for single-rider edits
      if (!Array.isArray(body) && body.bib) {
        const { data: existing } = await supabase
          .from("deelnemers")
          .select("klasse")
          .eq("bib", body.bib)
          .maybeSingle();

        if (existing) {
          const oldKlasse = normalizeKlasse(existing.klasse);
          const newKlasse = normalizeKlasse(body.klasse ?? "");

          if (oldKlasse && newKlasse && oldKlasse !== newKlasse) {
            await supabase.from("klasse_history").insert({
              bib: body.bib,
              old_klasse: oldKlasse,
              new_klasse: newKlasse,
            });
          }
        }
      }

      const { error } = await supabase
        .from("deelnemers")
        .upsert(body, { onConflict: "bib", ignoreDuplicates: false })
        .select();

      if (error) {
        console.error("Supabase Upsert Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        count: Array.isArray(body) ? body.length : 1,
      });
    }
  } catch (err: unknown) {
    console.error("Server Error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { bib } = await req.json();
    const supabase = getSupabaseAdmin();

    // Clean up history when rider is removed
    await supabase.from("klasse_history").delete().eq("bib", bib);

    const { error } = await supabase.from("deelnemers").delete().eq("bib", bib);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}