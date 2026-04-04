import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const EXCLUDED = ["", "vrij"];

function isValidRace(name: string) {
  return !EXCLUDED.includes(name.trim().toLowerCase());
}

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("races")
    .select("*")
    .order("sort_order")
    .order("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const filtered = (data ?? [])
    .filter((r) => isValidRace(r.name))
    .sort((a, b) => {
      if (a.date && b.date) return a.date.localeCompare(b.date);
      if (a.date) return -1;
      if (b.date) return 1;
      return a.sort_order - b.sort_order;
    });
  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    if (!name || !isValidRace(name)) {
      return NextResponse.json({ error: "Ongeldige naam" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Determine next sort_order
    const { data: existing } = await supabase
      .from("races")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1);
    const nextOrder = ((existing?.[0]?.sort_order) ?? 0) + 1;

    const { data, error } = await supabase
      .from("races")
      .insert({ name, date: body.date ?? null, sort_order: nextOrder })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, date } = await req.json();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("races")
      .update({ date: date ?? null })
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

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("races").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}