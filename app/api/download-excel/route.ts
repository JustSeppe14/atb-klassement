// app/api/klassement/route.ts  (Excel download)

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { exportKlassementToExcel } from "@/lib/excel";
import { computeKlassement, computeRegelmatigheid, computeTeamScores } from "@/lib/klassement";
import { DEFAULT_CONFIG, SeasonConfig } from "@/lib/utils";
import { parseScoringConfig } from "@/lib/scoring-config";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const [
      { data: deelnemers },
      { data: results },
      { data: configData },
      { data: racesData },
    ] = await Promise.all([
      supabase.from("deelnemers").select("*"),
      supabase.from("race_results").select("*"),
      supabase.from("config").select("*").eq("id", 1).single(),
      supabase.from("races").select("*").order("sort_order").order("id"),
    ]);

    const config: SeasonConfig = {
      currentWeek:           configData?.current_week            ?? DEFAULT_CONFIG.currentWeek,
      isSecondPeriodStarted: configData?.is_second_period_started ?? false,
      secondPeriodStartWeek: configData?.second_period_start_week ?? 12,
      seasonEnded:           configData?.season_ended             ?? false,
    };

    const scoringCfg = parseScoringConfig(configData ?? {});

    const EXCLUDED = ["", "vrij"];
    const races = (racesData ?? []).filter(
      (r) => !EXCLUDED.includes(r.name.trim().toLowerCase())
    );

    const d = deelnemers ?? [];
    const r = results ?? [];

    const klassement    = computeKlassement(d, r, config, races, scoringCfg);
    const regelmatigheid = computeRegelmatigheid(d, r, config.currentWeek, scoringCfg);
    const teamSTA        = computeTeamScores(d, klassement, "STA", scoringCfg);
    const teamMixed      = computeTeamScores(d, klassement, "MIXED", scoringCfg);

    const buffer = exportKlassementToExcel(klassement, regelmatigheid, teamSTA, teamMixed, races);

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="klassement.xlsx"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}