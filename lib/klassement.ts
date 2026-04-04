import {
  Deelnemer,
  RaceResult,
  KlassementRow,
  SeasonConfig,
  MAX_POINTS,
  RACE_NAMES,
  normalizeKlasse,
  sumBest50Percent,
  getRaceName,
  Categorie,
} from "./utils";

export function computeKlassement(
  deelnemers: Deelnemer[],
  allResults: RaceResult[],
  config: SeasonConfig
): KlassementRow[] {
  const { currentWeek, isSecondPeriodStarted, secondPeriodStartWeek } = config;

  // Helper: normalize klasse
  const normalized = deelnemers.map((d) => ({
    ...d,
    klasse: normalizeKlasse(d.klasse),
  }));

  // Helper: punten per week per bib
  const resultsByWeek = new Map<number, RaceResult[]>();
  for (const r of allResults) {
    if (!resultsByWeek.has(r.week)) resultsByWeek.set(r.week, []);
    resultsByWeek.get(r.week)!.push(r);
  }

  const weeksWithResults = [...resultsByWeek.keys()].sort((a, b) => a - b);

  const pointsMap = new Map<number, Record<string, number>>();
  for (const d of normalized) pointsMap.set(d.bib, {});

  // Bereken punten per deelnemer per week
  for (const week of weeksWithResults) {
    const raceName = getRaceName(week);
    const weekResults = resultsByWeek.get(week) ?? [];

    // Per klasse
    const klasseMap = new Map<string, Deelnemer[]>();
    for (const d of normalized) {
      if (!klasseMap.has(d.klasse)) klasseMap.set(d.klasse, []);
      klasseMap.get(d.klasse)!.push(d);
    }

    for (const [, klasseDeelnemers] of klasseMap.entries()) {
      const klasseBibs = new Set(klasseDeelnemers.map((d) => d.bib));
      const klasseResults = weekResults
        .filter((r) => klasseBibs.has(r.bib))
        .sort((a, b) => a.plaats - b.plaats);

      const bibPoints = new Map<number, number>();
      klasseResults.forEach((r, idx) => {
        const rank = idx + 1;
        bibPoints.set(r.bib, rank <= 60 ? rank : 60);
      });

      for (const d of klasseDeelnemers) {
        const pts = bibPoints.get(d.bib) ?? MAX_POINTS; // DNS/DNF = max
        pointsMap.get(d.bib)![raceName] = pts;
      }
    }
  }

  // Helper: som van beste 60%
  function sumBest60Percent(points: number[]): number {
    if (!points.length) return 0;
    const sorted = [...points].sort((a, b) => a - b); // laagste punten = beste
    const count = Math.ceil(points.length * 0.6);
    return sorted.slice(0, count).reduce((sum, p) => sum + p, 0);
  }

  function countPodiums(weekPoints: Record<string, number>) {
    return Object.values(weekPoints).filter((p) => p <= 3).length;
  }

  // Bouw klassement rows
  let rows: KlassementRow[] = normalized.map((d) => {
    const weekPoints = pointsMap.get(d.bib) ?? {};

    // Vul MAX_POINTS voor niet-deelname
    for (const week of weeksWithResults) {
      const raceName = getRaceName(week);
      if (weekPoints[raceName] === undefined) weekPoints[raceName] = MAX_POINTS;
    }

    const allPointValues = weeksWithResults.map(
      (w) => weekPoints[getRaceName(w)] ?? MAX_POINTS
    );

    const firstPeriodValues = isSecondPeriodStarted
      ? weeksWithResults
          .filter((w) => w < secondPeriodStartWeek)
          .map((w) => weekPoints[getRaceName(w)] ?? MAX_POINTS)
      : allPointValues;

    const secondPeriodValues = isSecondPeriodStarted
      ? weeksWithResults
          .filter((w) => w >= secondPeriodStartWeek)
          .map((w) => weekPoints[getRaceName(w)] ?? MAX_POINTS)
      : [];

    return {
      bib: d.bib,
      naam: d.naam,
      klasse: d.klasse,
      categorie: d.categorie,
      team: d.team,
      weekPoints,
      eerstePeriode: sumBest60Percent(firstPeriodValues),
      tweedePeriode: sumBest60Percent(secondPeriodValues),
      totaal: sumBest60Percent([...firstPeriodValues, ...secondPeriodValues]),
      plaatsKlasse: 0, // wordt per klasse gevuld
    };
  });

  // ✅ Rangschikking en plaats per klasse
  const klasseMap = new Map<string, KlassementRow[]>();
  for (const row of rows) {
    if (!klasseMap.has(row.klasse)) klasseMap.set(row.klasse, []);
    klasseMap.get(row.klasse)!.push(row);
  }

  for (const [, klasseRows] of klasseMap.entries()) {
    // Sorteer op totaal → podium → bib
    klasseRows.sort((a, b) => {
      if (a.totaal !== b.totaal) return a.totaal - b.totaal;
      const aPodium = countPodiums(a.weekPoints);
      const bPodium = countPodiums(b.weekPoints);
      if (aPodium !== bPodium) return bPodium - aPodium;
      return a.bib - b.bib;
    });

    // Plaats binnen de klasse
    klasseRows.forEach((r, idx) => {
      r.plaatsKlasse = idx + 1;
    });
  }

  return rows;
}
export function computeRegelmatigheid(
  deelnemers: Deelnemer[],
  allResults: RaceResult[],
  totalRacesHeld: number 
): { bib: number; naam: string; klasse: string; aantalDeelnames: number; punten: number }[] {
  
  const MAX_POINTS_ABSENT = 80;
  const CAP_POINTS_FINISH = 60;

  // 1. Group all "plaats" results by rider (bib)
  const riderResultsMap = new Map<number, number[]>();

  for (const r of allResults) {
    const ranks = riderResultsMap.get(r.bib) ?? [];
    
    // CAP LOGIC: If rank is 61, it becomes 60.
    const score = r.plaats >= CAP_POINTS_FINISH ? CAP_POINTS_FINISH : r.plaats;
    
    ranks.push(score);
    riderResultsMap.set(r.bib, ranks);
  }

  return deelnemers.map((d) => {
    const actualRanks = riderResultsMap.get(d.bib) ?? [];
    const aantalDeelnames = actualRanks.length;

    // 2. Fill missing races with 80 points
    const missingCount = totalRacesHeld - aantalDeelnames;
    const allScores = [...actualRanks, ...Array(missingCount).fill(MAX_POINTS_ABSENT)];

    // 3. sum_without_worst logic
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
  // 4. SORT: Lowest total points = 1st place in standings
  .sort((a, b) => {
    if (a.punten !== b.punten) {
      return a.punten - b.punten; 
    }
    // Tie-breaker: person with more starts ranks higher
    return b.aantalDeelnames - a.aantalDeelnames;
  });
}



export function computeTeamScores(
  deelnemers: Deelnemer[],
  klassement: KlassementRow[],
  mode: "STA" | "MIXED",
  maxPoints = 60
): { team: string; punten: number; riders: string[] }[] {
  // Filter valid teams
  const validDeelnemers = deelnemers.filter(
    (d): d is Deelnemer & { team: string } =>
      typeof d.team === "string" &&
      d.team.trim() !== "" &&
      d.team !== "0"
  );

  // Aggregate riders per team
  const teamMap = new Map<
    string,
    { riders: { naam: string; punten: number; categorie: Categorie }[] }
  >();

  for (const d of validDeelnemers) {
    // Filter STA if mode is STA
    if (mode === "STA" && d.categorie !== "STA") continue;

    const row = klassement.find((r) => r.bib === d.bib);
    if (!row) continue;

    // Exclude riders who never participated (totaal === MAX_POINTS = 80)
    if (row.totaal >= MAX_POINTS) continue;

    const punten = row.totaal ?? maxPoints;
    const team = d.team;

    if (!teamMap.has(team)) teamMap.set(team, { riders: [] });
    teamMap.get(team)!.riders.push({
      naam: d.naam,
      punten,
      categorie: d.categorie,
    });
  }

  // Compute total points per team
  const result = [...teamMap.entries()].map(([team, { riders }]) => {
    let selectedRiders: { naam: string; punten: number }[] = [];

    if (mode === "STA") {
      // Take top 4 STA riders
      selectedRiders = riders
        .sort((a, b) => a.punten - b.punten)
        .slice(0, 4)
        .map(({ naam, punten }) => ({ naam, punten }));
    } else if (mode === "MIXED") {
      // Daguitslag: 2 STA, 1 SEN, 1 VET/DAM
      const staRiders = riders
        .filter((r) => r.categorie === "STA")
        .sort((a, b) => a.punten - b.punten)
        .slice(0, 2);
      const senRiders = riders
        .filter((r) => r.categorie === "SEN")
        .sort((a, b) => a.punten - b.punten)
        .slice(0, 1);
      const vetRiders = riders
        .filter((r) => r.categorie === "VET" || r.categorie === "DAM")
        .sort((a, b) => a.punten - b.punten)
        .slice(0, 1);

      selectedRiders = [...staRiders, ...senRiders, ...vetRiders].map(
        ({ naam, punten }) => ({ naam, punten })
      );
    }

    const totalPunten = selectedRiders.reduce((sum, r) => sum + r.punten, 0);

    return {
      team,
      punten: totalPunten,
      riders: selectedRiders.map((r) => r.naam),
    };
  });

  // Sort ascending by punten
  return result.sort((a, b) => a.punten - b.punten);
}