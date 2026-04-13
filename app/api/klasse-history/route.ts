// app/api/klasse-history/route.ts
// Manage klasse switch history: list all, update from_week, delete a record

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

/** PATCH { id, from_week } — assign which race week the new klasse starts from */
export async function PATCH(req: NextRequest) {
  try {
    const { id, from_week } = await req.json();
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("klasse_history")
      .update({ from_week: from_week ?? null })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE { id } — remove an incorrectly recorded switch */
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