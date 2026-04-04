import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseDeelnemersFile } from "@/lib/excel";

export async function GET() {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("deelnemers")
    .select("*")
    .order("bib");

  if (error) {
    console.error("GET deelnemers error:", error);
    return NextResponse.json([]); // 🔥 NOOIT crashen
  }

  return NextResponse.json(Array.isArray(data) ? data : []);
}
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    const supabase = getSupabaseAdmin();
    let dataToUpsert: any[] | any;

    if (contentType.includes("multipart/form-data")) {
      // 1. Handle File Upload
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      
      if (!file) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
      }

      const buffer = await file.arrayBuffer();
      const deelnemers = parseDeelnemersFile(buffer);

      if (!deelnemers || deelnemers.length === 0) {
        return NextResponse.json({ error: "No valid participants found in file" }, { status: 400 });
      }
      
      dataToUpsert = deelnemers;
    } else {
      // 2. Handle JSON Body
      const body = await req.json();
      
      // Ensure body isn't empty
      if (!body || (Array.isArray(body) && body.length === 0)) {
        return NextResponse.json({ error: "Empty request body" }, { status: 400 });
      }

      dataToUpsert = body;
    }

    // 3. Perform the Upsert
    // We use onConflict: 'bib' to update existing players based on their start number
    const { error, data } = await supabase
      .from("deelnemers")
      .upsert(dataToUpsert, { 
        onConflict: "bib",
        ignoreDuplicates: false // Set to true if you only want to insert new ones
      })
      .select(); // Optional: returns the updated/inserted rows

    if (error) {
      console.error("Supabase Upsert Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      count: Array.isArray(dataToUpsert) ? dataToUpsert.length : 1 
    });

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
    const { error } = await supabase.from("deelnemers").delete().eq("bib", bib);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
