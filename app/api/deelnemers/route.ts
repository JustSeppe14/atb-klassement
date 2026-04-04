import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseDeelnemersFile } from "@/lib/excel";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("deelnemers")
      .select("*")
      .order("bib");
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    const supabase = getSupabaseAdmin();

    if (contentType.includes("multipart/form-data")) {
      // File upload
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

      const buffer = await file.arrayBuffer();
      const deelnemers = parseDeelnemersFile(buffer);

      if (deelnemers.length === 0)
        return NextResponse.json({ error: "No valid participants found" }, { status: 400 });

      const { error } = await supabase
        .from("deelnemers")
        .upsert(deelnemers, { onConflict: "bib" });
      if (error) throw error;

      return NextResponse.json({ success: true, count: deelnemers.length });
    } else {
      // Single deelnemer upsert
      const body = await req.json();
      const { error } = await supabase
        .from("deelnemers")
        .upsert(body, { onConflict: "bib" });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { bib } = await req.json();
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("deelnemers").delete().eq("bib", bib);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
