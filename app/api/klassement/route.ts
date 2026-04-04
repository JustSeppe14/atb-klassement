import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { computeKlassement, computeRegelmatigheid, computeTeamKlassement } from "@/lib/klassement";
import { DEFAULT_CONFIG, SeasonConfig } from "@/lib/utils";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const [{ data: deelnemers }, { data: results }, { data: configData }] =
      await Promise.all([
        supabase.from("deelnemers").select("*"),
        supabase.from("race_results").select("*"),
        supabase.from("config").select("*").eq("id", 1).single(),
      ]);

    const config: SeasonConfig = {
      currentWeek: configData?.current_week ?? DEFAULT_CONFIG.currentWeek,
      isSecondPeriodStarted: configData?.is_second_period_started ?? false,
      secondPeriodStartWeek: configData?.second_period_start_week ?? 12,
      seasonEnded: configData?.season_ended ?? false,
    };

    const d = deelnemers ?? [];
    const r = results ?? [];

    const klassement = computeKlassement(d, r, config);
    const regelmatigheid = computeRegelmatigheid(d, r);
    const teamSTA = computeTeamKlassement(d, klassement, "STA");
    const teamDAM = computeTeamKlassement(d, klassement, "DAM");

    return NextResponse.json({ klassement, regelmatigheid, teamSTA, teamDAM, config });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
