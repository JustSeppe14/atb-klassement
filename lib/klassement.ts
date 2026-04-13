// lib/klassement.ts

import {
  Deelnemer,
  Race,
  RaceResult,
  KlassementRow,
  SeasonConfig,
  normalizeKlasse,
  Categorie,
} from "./utils";
import { ScoringConfig, DEFAULT_SCORING_CONFIG } from "./scoring-config";

// ---------------------------------------------------------------------------
// KlasseSwitch — a single recorded klasse change for one rider
// ---------------------------------------------------------------------------
export interface KlasseSwitch {
  bib: number;
  old_klasse: string;
  new_klasse: string;
  /** sort_order of the first race in the new klasse. Null = not yet linked to a race. */
  from_week: number | null;
}

// ---------------------------------------------------------------------------
// computeKlassement
// ---------------------------------------------------------------------------
export function computeKlassement(
  deelnemers: Deelnemer[],
  allResults: RaceResult[],
  config: SeasonConfig,
  races: Race[],
  scoringCfg: ScoringConfig = DEFAULT_SCORING_CONFIG,
  klasseSwitches: KlasseSwitch[] = []
): KlassementRow[] {
  const { isSecondPeriodStarted, secondPeriodStartWeek } = config;
  const { maxPoints, capFinishPosition, bestPct, klasseSwitchPoints } = scoringCfg;
  const bestFraction = bestPct / 100;

  const raceByOrder = new Map<number, string>(
    races.map((r, idx) => [r.sort_order > 0 ? r.sort_order : idx + 1, r.name])
  );
  const getRaceName = (weekNum: number) => raceByOrder.get(weekNum) ?? String(weekNum);

  const normalized = deelnemers.map((d) => ({
    ...d,
    klasse: normalizeKlasse(d.klasse),
  }));

  // Build a lookup: for each (bib, week) → what klasse should this rider be scored in?
  // Logic:
  //   - Start with the rider's EARLIEST known klasse (= current klasse if no history,
  //     or the oldest old_klasse from history)
  //   - Each switch in history bumps the effective klasse from that from_week onwards
  //   - If from_week is null, we fall back to comparing with the stored snapshot
  //     on the race_result row (existing behaviour)
  //
  // switchesByBib: bib → sorted list of { from_week, new_klasse }
  const switchesByBib = new Map<number, { from_week: number; new_klasse: string }[]>();
  for (const sw of klasseSwitches) {
    if (sw.from_week == null) continue; // not linked to a race yet — handled via snapshot fallback
    const list = switchesByBib.get(sw.bib) ?? [];
    list.push({ from_week: sw.from_week, new_klasse: normalizeKlasse(sw.new_klasse) });
    switchesByBib.set(sw.bib, list);
  }
  // Sort each rider's switches ascending by from_week
  for (const [bib, list] of switchesByBib.entries()) {
    switchesByBib.set(bib, list.sort((a, b) => a.from_week - b.from_week));
  }

  // Current (final) klasse per bib
  const currentKlasseByBib = new Map<number, string>(
    normalized.map((d) => [d.bib, d.klasse])
  );

  /**
   * Returns the klasse a rider should be scored in for a given race week,
   * based on history (if available) or the stored snapshot on the result row.
   */
  function effectiveKlasseForWeek(
    bib: number,
    week: number,
    snapshotKlasse: string | null | undefined
  ): string {
    const currentKlasse = currentKlasseByBib.get(bib);

    // If we have explicit history with from_week set, use it
    const switches = switchesByBib.get(bib);
    if (switches && switches.length > 0) {
      // Walk backwards: find the latest switch whose from_week <= this week
      let activeKlasse: string | undefined;
      for (const sw of switches) {
        if (sw.from_week <= week) {
          activeKlasse = sw.new_klasse;
        }
      }
      if (activeKlasse) return activeKlasse;
      // week is before any switch → rider was in their ORIGINAL klasse
      // Original = old_klasse of the first switch that applies to this bib
      const firstSwitch = klasseSwitches
        .filter((s) => s.bib === bib && s.from_week != null)
        .sort((a, b) => (a.from_week ?? 0) - (b.from_week ?? 0))[0];
      if (firstSwitch) return normalizeKlasse(firstSwitch.old_klasse);
    }

    // Fallback: use the snapshot stored on the race_result row
    if (snapshotKlasse) return normalizeKlasse(snapshotKlasse);

    // Final fallback: current klasse
    return currentKlasse ?? "";
  }

  const resultsByWeek = new Map<number, RaceResult[]>();
  for (const r of allResults) {
    if (!resultsByWeek.has(r.week)) resultsByWeek.set(r.week, []);
    resultsByWeek.get(r.week)!.push(r);
  }

  const weeksWithResults = [...resultsByWeek.keys()].sort((a, b) => a - b);

  const pointsMap = new Map<number, Record<string, number>>();
  for (const d of normalized) pointsMap.set(d.bib, {});

  for (const week of weeksWithResults) {
    const raceName = getRaceName(week);
    const weekResults = resultsByWeek.get(week) ?? [];

    // Determine effective klasse per result and flag switched riders
    const normalResults: RaceResult[] = [];
    const switchedBibs = new Set<number>();

    for (const r of weekResults) {
      const currentKlasse = currentKlasseByBib.get(r.bib);
      const raceKlasse = effectiveKlasseForWeek(r.bib, week, r.klasse);

      if (currentKlasse && raceKlasse !== currentKlasse) {
        // Rider raced in an old klasse this week → fixed penalty points
        switchedBibs.add(r.bib);
        pointsMap.get(r.bib)![raceName] = klasseSwitchPoints;
      } else {
        normalResults.push(r);
      }
    }

    // Score normal results within each klasse group
    const klasseMap = new Map<string, Deelnemer[]>();
    for (const d of normalized) {
      if (!klasseMap.has(d.klasse)) klasseMap.set(d.klasse, []);
      klasseMap.get(d.klasse)!.push(d);
    }

    for (const [, klasseDeelnemers] of klasseMap.entries()) {
      const klasseBibs = new Set(
        klasseDeelnemers.map((d) => d.bib).filter((bib) => !switchedBibs.has(bib))
      );
      const klasseResults = normalResults
        .filter((r) => klasseBibs.has(r.bib))
        .sort((a, b) => a.plaats - b.plaats);

      const bibPoints = new Map<number, number>();
      klasseResults.forEach((r, idx) => {
        const rank = idx + 1;
        bibPoints.set(r.bib, rank <= capFinishPosition ? rank : capFinishPosition);
      });

      for (const d of klasseDeelnemers) {
        if (switchedBibs.has(d.bib)) continue;
        const pts = bibPoints.get(d.bib) ?? maxPoints;
        pointsMap.get(d.bib)![raceName] = pts;
      }
    }
  }

  function sumBestPct(points: number[]): number {
    if (!points.length) return 0;
    const sorted = [...points].sort((a, b) => a - b);
    const count = Math.ceil(points.length * bestFraction);
    return sorted.slice(0, count).reduce((sum, p) => sum + p, 0);
  }

  function countPodiums(weekPoints: Record<string, number>) {
    return Object.values(weekPoints).filter((p) => p <= 3).length;
  }

  const rows: KlassementRow[] = normalized.map((d) => {
    const weekPoints = pointsMap.get(d.bib) ?? {};

    for (const week of weeksWithResults) {
      const raceName = getRaceName(week);
      if (weekPoints[raceName] === undefined) weekPoints[raceName] = maxPoints;
    }

    const allPointValues = weeksWithResults.map(
      (w) => weekPoints[getRaceName(w)] ?? maxPoints
    );

    const firstPeriodValues = isSecondPeriodStarted
      ? weeksWithResults
          .filter((w) => w < secondPeriodStartWeek)
          .map((w) => weekPoints[getRaceName(w)] ?? maxPoints)
      : allPointValues;

    const secondPeriodValues = isSecondPeriodStarted
      ? weeksWithResults
          .filter((w) => w >= secondPeriodStartWeek)
          .map((w) => weekPoints[getRaceName(w)] ?? maxPoints)
      : [];

    return {
      bib: d.bib,
      naam: d.naam,
      klasse: d.klasse,
      categorie: d.categorie,
      team: d.team,
      weekPoints,
      eerstePeriode: sumBestPct(firstPeriodValues),
      tweedePeriode: sumBestPct(secondPeriodValues),
      totaal: sumBestPct([...firstPeriodValues, ...secondPeriodValues]),
      plaatsKlasse: 0,
    };
  });

  const klasseMap = new Map<string, KlassementRow[]>();
  for (const row of rows) {
    if (!klasseMap.has(row.klasse)) klasseMap.set(row.klasse, []);
    klasseMap.get(row.klasse)!.push(row);
  }

  for (const [, klasseRows] of klasseMap.entries()) {
    klasseRows.sort((a, b) => {
      if (a.totaal !== b.totaal) return a.totaal - b.totaal;
      const aPodium = countPodiums(a.weekPoints);
      const bPodium = countPodiums(b.weekPoints);
      if (aPodium !== bPodium) return bPodium - aPodium;
      return a.bib - b.bib;
    });
    klasseRows.forEach((r, idx) => { r.plaatsKlasse = idx + 1; });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// computeRegelmatigheid
// ---------------------------------------------------------------------------
export function computeRegelmatigheid(
  deelnemers: Deelnemer[],
  allResults: RaceResult[],
  totalRacesHeld: number,
  scoringCfg: ScoringConfig = DEFAULT_SCORING_CONFIG
): { bib: number; naam: string; klasse: string; aantalDeelnames: number; punten: number }[] {
  const { regAbsentPoints, regCapFinish } = scoringCfg;

  const riderResultsMap = new Map<number, number[]>();
  for (const r of allResults) {
    const ranks = riderResultsMap.get(r.bib) ?? [];
    const score = r.plaats >= regCapFinish ? regCapFinish : r.plaats;
    ranks.push(score);
    riderResultsMap.set(r.bib, ranks);
  }

  return deelnemers
    .map((d) => {
      const actualRanks = riderResultsMap.get(d.bib) ?? [];
      const aantalDeelnames = actualRanks.length;
      const missingCount = totalRacesHeld - aantalDeelnames;
      const allScores = [
        ...actualRanks,
        ...Array(missingCount).fill(regAbsentPoints),
      ];

      let finalPunten = 0;
      if (allScores.length > 0) {
        const totalSum = allScores.reduce((a, b) => a + b, 0);
        const worstResult = Math.max(...allScores);
        finalPunten = totalSum - worstResult;
      }

      return {
        bib: d.bib,
        naam: d.naam,
        klasse: normalizeKlasse(d.klasse),
        aantalDeelnames,
        punten: finalPunten,
      };
    })
    .sort((a, b) => {
      if (a.punten !== b.punten) return a.punten - b.punten;
      return b.aantalDeelnames - a.aantalDeelnames;
    });
}

// ---------------------------------------------------------------------------
// computeTeamScores
// ---------------------------------------------------------------------------
export function computeTeamScores(
  deelnemers: Deelnemer[],
  klassement: KlassementRow[],
  mode: "STA" | "MIXED",
  scoringCfg: ScoringConfig = DEFAULT_SCORING_CONFIG
): { team: string; punten: number; riders: string[] }[] {
  const { maxPoints, teamStaSlots, teamMixedSlots } = scoringCfg;
  const slots = mode === "STA" ? teamStaSlots : teamMixedSlots;

  const validDeelnemers = deelnemers.filter(
    (d): d is Deelnemer & { team: string } =>
      typeof d.team === "string" &&
      d.team.trim() !== "" &&
      d.team !== "0"
  );

  const teamMap = new Map<
    string,
    { riders: { naam: string; punten: number; categorie: Categorie }[] }
  >();

  const bibsWithResults = new Set(
    klassement
      .filter((r) => Object.values(r.weekPoints).some((p) => p < maxPoints))
      .map((r) => r.bib)
  );

  for (const d of validDeelnemers) {
    const row = klassement.find((r) => r.bib === d.bib);
    if (!row) continue;
    if (!bibsWithResults.has(d.bib)) continue;

    const punten = row.totaal ?? maxPoints;
    if (!teamMap.has(d.team)) teamMap.set(d.team, { riders: [] });
    teamMap.get(d.team)!.riders.push({ naam: d.naam, punten, categorie: d.categorie });
  }

  const result = [...teamMap.entries()].map(([team, { riders }]) => {
    const selectedRiders: { naam: string; punten: number }[] = [];

    for (const slot of slots) {
      const eligible = riders
        .filter((r) => slot.cat === null || r.categorie === slot.cat)
        .sort((a, b) => a.punten - b.punten)
        .slice(0, slot.count);
      selectedRiders.push(...eligible.map(({ naam, punten }) => ({ naam, punten })));
    }

    const totalPunten = selectedRiders.reduce((sum, r) => sum + r.punten, 0);
    return { team, punten: totalPunten, riders: selectedRiders.map((r) => r.naam) };
  });

  return result.sort((a, b) => a.punten - b.punten);
}