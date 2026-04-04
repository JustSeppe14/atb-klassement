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

  // Normalize klasse on all deelnemers
  const normalized = deelnemers.map((d) => ({
    ...d,
    klasse: normalizeKlasse(d.klasse),
  }));

  // Group results by week
  const resultsByWeek = new Map<number, RaceResult[]>();
  for (const r of allResults) {
    if (!resultsByWeek.has(r.week)) resultsByWeek.set(r.week, []);
    resultsByWeek.get(r.week)!.push(r);
  }

  // Get all weeks that have results
  const weeksWithResults = [...resultsByWeek.keys()].sort((a, b) => a - b);

  // Build a map: bib -> { raceName -> points }
  const pointsMap = new Map<number, Record<string, number>>();

  for (const deelnemer of normalized) {
    pointsMap.set(deelnemer.bib, {});
  }

  for (const week of weeksWithResults) {
    const raceName = getRaceName(week);
    const weekResults = resultsByWeek.get(week) ?? [];

    // Group deelnemers by klasse
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

      // Assign rank-based points within class
      const bibPoints = new Map<number, number>();
      klasseResults.forEach((r, idx) => {
        const rank = idx + 1;
        bibPoints.set(r.bib, rank < 60 ? rank : 60);
      });

      // Assign points (MAX_POINTS for DNS/DNF)
      for (const d of klasseDeelnemers) {
        const pts = bibPoints.get(d.bib) ?? MAX_POINTS;
        const existing = pointsMap.get(d.bib) ?? {};
        existing[raceName] = pts;
        pointsMap.set(d.bib, existing);
      }
    }
  }

  // Build rows
  const rows: KlassementRow[] = normalized.map((d) => {
    const weekPoints = pointsMap.get(d.bib) ?? {};

    // Fill in MAX_POINTS for weeks that have results but rider didn't participate
    for (const week of weeksWithResults) {
      const raceName = getRaceName(week);
      if (weekPoints[raceName] === undefined) {
        weekPoints[raceName] = MAX_POINTS;
      }
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
      totaal: sumBest50Percent(allPointValues),
      eerstePeriode: sumBest50Percent(firstPeriodValues),
      tweedePeriode: sumBest50Percent(secondPeriodValues),
      plaatsKlasse: 0, // filled below
    };
  });

  // Compute class rankings
  const klasseGroups = new Map<string, KlassementRow[]>();
  for (const row of rows) {
    if (!klasseGroups.has(row.klasse)) klasseGroups.set(row.klasse, []);
    klasseGroups.get(row.klasse)!.push(row);
  }

  for (const [, group] of klasseGroups.entries()) {
    group.sort((a, b) => a.totaal - b.totaal);
    group.forEach((row, idx) => {
      row.plaatsKlasse = idx + 1;
    });
  }

  // Compute category rankings (STA, SEN, DAM) per klasse
  for (const [, group] of klasseGroups.entries()) {
    const sorted = [...group].sort((a, b) => a.totaal - b.totaal);
    const catCounters: Record<string, number> = { STA: 1, SEN: 1, DAM: 1 };
    for (const row of sorted) {
      const cat = row.categorie as string;
      if (cat in catCounters) {
        if (cat === "STA") row.plaatsSTA = catCounters[cat]++;
        if (cat === "SEN") row.plaatsSEN = catCounters[cat]++;
        if (cat === "DAM") row.plaatsDAM = catCounters[cat]++;
      }
    }
  }

  // Final sort: by klasse then totaal
  return rows.sort((a, b) =>
    a.klasse !== b.klasse
      ? a.klasse.localeCompare(b.klasse)
      : a.totaal - b.totaal
  );
}

export function computeRegelmatigheid(
  deelnemers: Deelnemer[],
  allResults: RaceResult[]
): { bib: number; naam: string; klasse: string; aantalDeelnames: number; punten: number }[] {
  const normalized = deelnemers.map((d) => ({
    ...d,
    klasse: normalizeKlasse(d.klasse),
  }));

  const participationMap = new Map<number, number>(); // bib -> count
  for (const r of allResults) {
    participationMap.set(r.bib, (participationMap.get(r.bib) ?? 0) + 1);
  }

  return normalized
    .map((d) => ({
      bib: d.bib,
      naam: d.naam,
      klasse: d.klasse,
      aantalDeelnames: participationMap.get(d.bib) ?? 0,
      punten: participationMap.get(d.bib) ?? 0,
    }))
    .sort((a, b) => b.punten - a.punten);
}

export function computeTeamKlassement(
  deelnemers: Deelnemer[],
  klassement: KlassementRow[],
  categorie?: Categorie
): { team: string; punten: number; riders: string[] }[] {
  const filtered = categorie
    ? klassement.filter((r) => r.categorie === categorie)
    : klassement;

  const teamMap = new Map<string, { punten: number; riders: string[] }>();

  for (const row of filtered) {
    const d = deelnemers.find((d) => d.bib === row.bib);
    const team = d?.team ?? row.team ?? "Geen team";
    if (!team || team.trim() === "") continue;

    if (!teamMap.has(team)) teamMap.set(team, { punten: 0, riders: [] });
    const entry = teamMap.get(team)!;
    entry.punten += row.totaal;
    entry.riders.push(row.naam);
  }

  return [...teamMap.entries()]
    .map(([team, v]) => ({ team, ...v }))
    .sort((a, b) => a.punten - b.punten);
}
