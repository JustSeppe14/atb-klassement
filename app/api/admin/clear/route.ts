// /api/admin/clear/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST() {
  try {
    const supabase = getSupabaseAdmin();

    const [s1, s2, s3] = await Promise.all([
      supabase.from("klasse_history").delete().neq("id", -1),
      supabase.from("race_results").delete().neq("week", -1),
      supabase.from("deelnemers").delete().neq("bib", -1),
    ]);

    const error = s1.error ?? s2.error ?? s3.error;
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Fout bij wissen" }, { status: 500 });
  }
}