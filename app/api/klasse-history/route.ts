// app/api/klasse-history/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("klasse_history")
    .select("*")
    .order("bib")
    .order("changed_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** DELETE { id } — undo a wrongly recorded switch */
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("klasse_history").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}