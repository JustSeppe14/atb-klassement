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
// KlasseSwitch — one recorded klasse change for a rider
// ---------------------------------------------------------------------------
export interface KlasseSwitch {
  bib: number;
  old_klasse: string;
  new_klasse: string;
  /** sort_order of the FIRST race in the new klasse. Always set automatically. */
  from_week: number;
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
  const { maxPoints, capFinishPosition, bestPct, klasseSwitchPoints, minRacesFirstHalf, minRacesSecondHalf, minRacesTotal } = scoringCfg;
  const bestFraction = bestPct / 100;

  const raceByOrder = new Map<number, string>(
    races.map((r, idx) => [r.sort_order > 0 ? r.sort_order : idx + 1, r.name])
  );
  const getRaceName = (weekNum: number) => raceByOrder.get(weekNum) ?? String(weekNum);

  const normalized = deelnemers.map((d) => ({
    ...d,
    klasse: normalizeKlasse(d.klasse),
  }));

  const currentKlasseByBib = new Map<number, string>(
    normalized.map((d) => [d.bib, d.klasse])
  );

  // ---- Build switch timeline ----
  const switchTimelineByBib = new Map<number, { from_week: number; klasse: string }[]>();

  for (const sw of klasseSwitches) {
    const timeline = switchTimelineByBib.get(sw.bib) ?? [];
    timeline.push({ from_week: sw.from_week, klasse: normalizeKlasse(sw.new_klasse) });
    switchTimelineByBib.set(sw.bib, timeline);
  }

  for (const [bib, timeline] of switchTimelineByBib.entries()) {
    switchTimelineByBib.set(
      bib,
      timeline.sort((a, b) => a.from_week - b.from_week)
    );
  }

  const originalKlasseByBib = new Map<number, string>();
  for (const sw of klasseSwitches) {
    if (!originalKlasseByBib.has(sw.bib)) {
      originalKlasseByBib.set(sw.bib, normalizeKlasse(sw.old_klasse));
    }
  }

  function klasseForWeek(bib: number, week: number): string {
    const timeline = switchTimelineByBib.get(bib);

    if (!timeline || timeline.length === 0) {
      return currentKlasseByBib.get(bib) ?? "";
    }

    let active: string | undefined;
    for (const entry of timeline) {
      if (entry.from_week <= week) active = entry.klasse;
    }

    if (active) return active;

    return originalKlasseByBib.get(bib) ?? currentKlasseByBib.get(bib) ?? "";
  }

  // ---- Group results per week ----
  const resultsByWeek = new Map<number, RaceResult[]>();
  for (const r of allResults) {
    if (!resultsByWeek.has(r.week)) resultsByWeek.set(r.week, []);
    resultsByWeek.get(r.week)!.push(r);
  }

  const weeksWithResults = [...resultsByWeek.keys()].sort((a, b) => a - b);

  const pointsMap = new Map<number, Record<string, number>>();
  for (const d of normalized) pointsMap.set(d.bib, {});

  // ---- MAIN LOOP ----
  for (const week of weeksWithResults) {
    const raceName = getRaceName(week);
    const weekResults = resultsByWeek.get(week) ?? [];

    // Determine which bibs are switchers this week (racing in old klasse)
    const switcherBibs = new Set(
      weekResults
        .filter((r) => {
          const currentKlasse = currentKlasseByBib.get(r.bib);
          const raceKlasse = klasseForWeek(r.bib, week);
          return currentKlasse && raceKlasse !== currentKlasse;
        })
        .map((r) => r.bib)
    );

    // Assign flat switch points to switchers
    for (const r of weekResults) {
      if (switcherBibs.has(r.bib)) {
        pointsMap.get(r.bib)![raceName] = klasseSwitchPoints;
      }
    }

    // ---- Score per CURRENT klasse ----
    const klasseMap = new Map<string, Deelnemer[]>();
    for (const d of normalized) {
      if (!klasseMap.has(d.klasse)) klasseMap.set(d.klasse, []);
      klasseMap.get(d.klasse)!.push(d);
    }

    for (const [klasseKey, klasseDeelnemers] of klasseMap.entries()) {
      // Include ALL riders who raced in this klasse this week (by their klasse
      // at race time), so switchers still occupy their rank slot and don't
      // compress the positions of riders behind them.
      const allKlasseResults = weekResults
        .filter((r) => klasseForWeek(r.bib, week) === klasseKey)
        .sort((a, b) => a.plaats - b.plaats);

      const bibPoints = new Map<number, number>();
      let rank = 0;
      for (const r of allKlasseResults) {
        rank++; // always increment to preserve position slots
        if (switcherBibs.has(r.bib)) continue; // flat points already assigned
        bibPoints.set(r.bib, rank <= capFinishPosition ? rank : capFinishPosition);
      }

      for (const d of klasseDeelnemers) {
        if (pointsMap.get(d.bib)![raceName] !== undefined) continue;
        pointsMap.get(d.bib)![raceName] = bibPoints.get(d.bib) ?? maxPoints;
      }
    }
  }

  // ---- Helpers ----
  function sumBestPct(points: number[], minRaces: number): number {
    const racesCompleted = points.length;
    if(racesCompleted === 0 ) return 0;

    const sorted = [...points].sort((a,b) => a - b);

    if (racesCompleted < minRaces) {
      return sorted.reduce((sum, p) => sum + p, 0);
    }

    const countToKeep = Math.ceil(racesCompleted * bestFraction);
    return sorted.slice(0, countToKeep).reduce((sum, p) => sum + p, 0)
  }

  function countPodiums(weekPoints: Record<string, number>) {
    return Object.values(weekPoints).filter((p) => p <= 3).length;
  }

  // ---- Build rows ----
  const rows: KlassementRow[] = normalized.map((d) => {
    const weekPoints = pointsMap.get(d.bib) ?? {};

    // Filter out 'maxPoints' (absences) to count actual participation
    const getActualPoints = (weeks: number[]) => 
      weeks.map(w => weekPoints[getRaceName(w)]).filter(p => p !== undefined && p < maxPoints);

    const allWeeks = weeksWithResults;
    const firstPeriodWeeks = isSecondPeriodStarted 
        ? allWeeks.filter(w => w < secondPeriodStartWeek) 
        : allWeeks;
    const secondPeriodWeeks = isSecondPeriodStarted 
        ? allWeeks.filter(w => w >= secondPeriodStartWeek) 
        : [];

    // Points arrays including absences (maxPoints) for the math, 
    // but we count actual participations for the threshold.
    const firstPeriodValues = firstPeriodWeeks.map(w => weekPoints[getRaceName(w)] ?? maxPoints);
    const secondPeriodValues = secondPeriodWeeks.map(w => weekPoints[getRaceName(w)] ?? maxPoints);
    const totalValues = [...firstPeriodValues, ...secondPeriodValues];

    const actualRacesFirst = getActualPoints(firstPeriodWeeks).length;
    const actualRacesSecond = getActualPoints(secondPeriodWeeks).length;
    const actualRacesTotal = actualRacesFirst + actualRacesSecond;

    return {
      bib: d.bib,
      naam: d.naam,
      klasse: d.klasse,
      categorie: d.categorie,
      team: d.team,
      weekPoints,
      eerstePeriode: sumBestPct(firstPeriodValues, minRacesFirstHalf),
      tweedePeriode: sumBestPct(secondPeriodValues, minRacesSecondHalf),
      totaal: sumBestPct(totalValues, minRacesTotal),
      plaatsKlasse: 0,
    };
  });

  // ---- Ranking ----
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
      typeof d.team === "string" && d.team.trim() !== "" && d.team !== "0"
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
    if (!row || !bibsWithResults.has(d.bib)) continue;

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
    return {
      team,
      punten: selectedRiders.reduce((sum, r) => sum + r.punten, 0),
      riders: selectedRiders.map((r) => r.naam),
    };
  });

  return result.sort((a, b) => a.punten - b.punten);
}