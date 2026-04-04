import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { DEFAULT_CONFIG } from "@/lib/utils";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("config")
      .select("*")
      .eq("id", 1)
      .single();

    if (error && error.code === "PGRST116") {
      // No config yet, return defaults
      return NextResponse.json(DEFAULT_CONFIG);
    }
    if (error) throw error;

    return NextResponse.json({
      currentWeek: data.current_week ?? DEFAULT_CONFIG.currentWeek,
      isSecondPeriodStarted: data.is_second_period_started ?? false,
      secondPeriodStartWeek: data.second_period_start_week ?? 12,
      seasonEnded: data.season_ended ?? false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from("config").upsert({
      id: 1,
      current_week: body.currentWeek,
      is_second_period_started: body.isSecondPeriodStarted,
      second_period_start_week: body.secondPeriodStartWeek,
      season_ended: body.seasonEnded,
    });

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
