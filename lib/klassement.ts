import {
  Deelnemer,
  Race,
  RaceResult,
  KlassementRow,
  SeasonConfig,
  MAX_POINTS,
  normalizeKlasse,
  sumBest50Percent,
  Categorie,
} from "./utils";

export function computeKlassement(
  deelnemers: Deelnemer[],
  allResults: RaceResult[],
  config: SeasonConfig,
  races: Race[]
): KlassementRow[] {
  const { isSecondPeriodStarted, secondPeriodStartWeek } = config;

  // Build a map from sort_order (= week number) to race name
  const raceByOrder = new Map<number, string>(
    races.map((r, idx) => [r.sort_order > 0 ? r.sort_order : idx + 1, r.name])
  );

  const getRaceName = (weekNum: number) => raceByOrder.get(weekNum) ?? String(weekNum);

  const normalized = deelnemers.map((d) => ({
    ...d,
    klasse: normalizeKlasse(d.klasse),
  }));

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
        const pts = bibPoints.get(d.bib) ?? MAX_POINTS;
        pointsMap.get(d.bib)![raceName] = pts;
      }
    }
  }

  function sumBest60Percent(points: number[]): number {
    if (!points.length) return 0;
    const sorted = [...points].sort((a, b) => a - b);
    const count = Math.ceil(points.length * 0.6);
    return sorted.slice(0, count).reduce((sum, p) => sum + p, 0);
  }

  function countPodiums(weekPoints: Record<string, number>) {
    return Object.values(weekPoints).filter((p) => p <= 3).length;
  }

  let rows: KlassementRow[] = normalized.map((d) => {
    const weekPoints = pointsMap.get(d.bib) ?? {};

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

export function computeRegelmatigheid(
  deelnemers: Deelnemer[],
  allResults: RaceResult[],
  totalRacesHeld: number
): { bib: number; naam: string; klasse: string; aantalDeelnames: number; punten: number }[] {
  const MAX_POINTS_ABSENT = 80;
  const CAP_POINTS_FINISH = 60;

  const riderResultsMap = new Map<number, number[]>();
  for (const r of allResults) {
    const ranks = riderResultsMap.get(r.bib) ?? [];
    const score = r.plaats >= CAP_POINTS_FINISH ? CAP_POINTS_FINISH : r.plaats;
    ranks.push(score);
    riderResultsMap.set(r.bib, ranks);
  }

  return deelnemers.map((d) => {
    const actualRanks = riderResultsMap.get(d.bib) ?? [];
    const aantalDeelnames = actualRanks.length;
    const missingCount = totalRacesHeld - aantalDeelnames;
    const allScores = [...actualRanks, ...Array(missingCount).fill(MAX_POINTS_ABSENT)];

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
  }).sort((a, b) => {
    if (a.punten !== b.punten) return a.punten - b.punten;
    return b.aantalDeelnames - a.aantalDeelnames;
  });
}

export function computeTeamScores(
  deelnemers: Deelnemer[],
  klassement: KlassementRow[],
  mode: "STA" | "MIXED",
  maxPoints = 60
): { team: string; punten: number; riders: string[] }[] {
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

  for (const d of validDeelnemers) {
    if (mode === "STA" && d.categorie !== "STA") continue;

    const row = klassement.find((r) => r.bib === d.bib);
    if (!row) continue;

    if (row.totaal >= MAX_POINTS) continue;

    const punten = row.totaal ?? maxPoints;
    const team = d.team;

    if (!teamMap.has(team)) teamMap.set(team, { riders: [] });
    teamMap.get(team)!.riders.push({ naam: d.naam, punten, categorie: d.categorie });
  }

  const result = [...teamMap.entries()].map(([team, { riders }]) => {
    let selectedRiders: { naam: string; punten: number }[] = [];

    if (mode === "STA") {
      selectedRiders = riders
        .sort((a, b) => a.punten - b.punten)
        .slice(0, 4)
        .map(({ naam, punten }) => ({ naam, punten }));
    } else if (mode === "MIXED") {
      const staRiders = riders.filter((r) => r.categorie === "STA").sort((a, b) => a.punten - b.punten).slice(0, 2);
      const senRiders = riders.filter((r) => r.categorie === "SEN").sort((a, b) => a.punten - b.punten).slice(0, 1);
      const vetRiders = riders.filter((r) => r.categorie === "VET" || r.categorie === "DAM").sort((a, b) => a.punten - b.punten).slice(0, 1);
      selectedRiders = [...staRiders, ...senRiders, ...vetRiders].map(({ naam, punten }) => ({ naam, punten }));
    }

    const totalPunten = selectedRiders.reduce((sum, r) => sum + r.punten, 0);
    return { team, punten: totalPunten, riders: selectedRiders.map((r) => r.naam) };
  });

  return result.sort((a, b) => a.punten - b.punten);
}