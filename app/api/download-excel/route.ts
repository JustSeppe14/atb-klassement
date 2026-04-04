import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { exportKlassementToExcel } from "@/lib/excel";
import { computeKlassement } from "@/lib/klassement";
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

    const klassement = computeKlassement(
      deelnemers ?? [],
      results ?? [],
      config
    );

    const buffer = exportKlassementToExcel(klassement);
    const week = config.currentWeek;

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="klassement_week_${week}.xlsx"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
