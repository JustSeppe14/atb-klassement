import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { DEFAULT_CONFIG } from "@/lib/utils";
import { DEFAULT_SCORING_CONFIG, parseScoringConfig } from "@/lib/scoring-config";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("config")
      .select("*")
      .eq("id", 1)
      .single();

    if (error && error.code === "PGRST116") {
      return NextResponse.json({ ...DEFAULT_CONFIG, ...DEFAULT_SCORING_CONFIG });
    }
    if (error) throw error;

    return NextResponse.json({
      // SeasonConfig
      currentWeek:           data.current_week            ?? DEFAULT_CONFIG.currentWeek,
      isSecondPeriodStarted: data.is_second_period_started ?? false,
      secondPeriodStartWeek: data.second_period_start_week ?? 12,
      seasonEnded:           data.season_ended             ?? false,

      // ScoringConfig
      ...parseScoringConfig(data),
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

      // SeasonConfig
      current_week:             body.currentWeek,
      is_second_period_started: body.isSecondPeriodStarted,
      second_period_start_week: body.secondPeriodStartWeek,
      season_ended:             body.seasonEnded,

      // ScoringConfig
      ...(body.maxPoints          != null && { max_points:          body.maxPoints }),
      ...(body.capFinishPosition  != null && { cap_finish_position: body.capFinishPosition }),
      ...(body.bestPct            != null && { best_pct:            body.bestPct }),
      ...(body.regAbsentPoints    != null && { reg_absent_points:   body.regAbsentPoints }),
      ...(body.regCapFinish       != null && { reg_cap_finish:      body.regCapFinish }),
      ...(body.maxWeeks           != null && { max_weeks:           body.maxWeeks }),

      // ✅ THIS IS THE FIX
      ...(body.klasseSwitchPoints != null && { klasse_switch_points: body.klasseSwitchPoints }),

      ...(body.teamStaSlots       != null && { team_sta_slots:      body.teamStaSlots }),
      ...(body.teamMixedSlots     != null && { team_mixed_slots:    body.teamMixedSlots }),
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}