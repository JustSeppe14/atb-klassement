import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getSupabaseAdmin } from "@/lib/supabase";
import { exportKlassementToExcel } from "@/lib/excel";
import { computeKlassement, computeRegelmatigheid, computeTeamScores } from "@/lib/klassement";
import { DEFAULT_CONFIG, SeasonConfig } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const { recipients, subject, body } = await req.json();

    if (!recipients || recipients.length === 0)
      return NextResponse.json({ error: "No recipients" }, { status: 400 });

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
    const regelmatigheid = computeRegelmatigheid(d, r, config.currentWeek);
    const teamSTA = computeTeamScores(d, klassement, "STA");
    const teamMixed = computeTeamScores(d, klassement, "MIXED");

    const excelBuffer = exportKlassementToExcel(klassement, regelmatigheid, teamSTA, teamMixed);

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT ?? "587"),
      secure: false,
      auth: {
        user: process.env.EMAIL_ACCOUNT,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_ACCOUNT,
      to: recipients.join(","),
      subject: subject ?? `ATB Klassement - Week ${config.currentWeek}`,
      text:
        body ??
        `Beste,\n\nIn bijlage vindt u het klassement van week ${config.currentWeek}.\n\nMet vriendelijke groeten,\nATB`,
      attachments: [
        {
          filename: `klassement_week_${config.currentWeek}.xlsx`,
          content: excelBuffer,
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ],
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}