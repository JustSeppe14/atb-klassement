import * as XLSX from "xlsx";
import { Deelnemer, KlassementRow, Race, normalizeKlasse, RaceResult, ParsedResult } from "./utils";


// --- PARSE FINISH RESULTS FILE ---
export function parseFinishFile(buffer: ArrayBuffer): ParsedResult[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, {
    defval: null,
  });

  const results: ParsedResult[] = [];
  for (const row of rows) {
    const bibRaw = parseInt(
      String(row["bib"] ?? row["BIB"] ?? row["Bib"] ?? "")
    );
    const plaats = parseInt(
      String(row["pl"] ?? row["PL"] ?? row["Pl"] ?? row["plaats"] ?? row["Plaats"] ?? "")
    );
    const naam =
      String(row["naam"] ?? row["NAAM"] ?? row["Naam"] ?? "").trim() || null;

    const bib = isNaN(bibRaw) ? null : bibRaw;
    if (!isNaN(plaats) && (bib !== null || naam !== null)) {
      results.push({ bib, naam, plaats });
    }
  }
  return results;
}

// --- PARSE DEELNEMERS FILE ---
export function parseDeelnemersFile(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
  });

  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => {
      const val = String(cell).toLowerCase();
      return val.includes("nr") || val.includes("naam");
    })
  );

  if (headerIndex === -1) return [];

  const headers = rows[headerIndex].map((h) => String(h).toLowerCase().trim());
  const dataRows = rows.slice(headerIndex + 1);

  return dataRows
    .map((row) => {
      if (!row || row.length === 0 || row.every(cell => !cell)) return null;

      const get = (names: string[]) => {
        const idx = headers.findIndex((h) =>
          names.some(name => h === name || h.includes(name))
        );
        return idx !== -1 ? row[idx] : "";
      };

      const naam = String(get(["naam"]) || "").trim();
      if (!naam) return null;

      const bibRaw = get(["nr", "nummer"]);
      const bib = typeof bibRaw === "number"
        ? bibRaw
        : parseInt(String(bibRaw).replace(/\D/g, "")) || 0;

      let klasse = String(get(["klasse", "cat"]) || "").trim().toUpperCase();
      const klasseMatch = klasse.match(/^([A-Z])\s*\+?\s*(\d+)J?$/);
      if (klasseMatch) klasse = `${klasseMatch[1]}${klasseMatch[2]}+`;

      let categorie = String(get(["cat", "categorie"]) || "").trim().toUpperCase();
      if (!["STA", "SEN", "DAM"].includes(categorie)) {
        if (categorie.startsWith("S")) categorie = "SEN";
        else if (categorie.startsWith("D")) categorie = "DAM";
        else categorie = "STA";
      }

      const team = String(get(["ploeg", "team"]) || "").trim();

      return { bib, naam, klasse, categorie, team: team || null } as Deelnemer;
    })
    .filter((d): d is Deelnemer => d !== null);
}

// --- EXPORT KLASSEMENT TO EXCEL ---
export interface RegelmatigheidRow {
  bib: number;
  naam: string;
  klasse: string;
  aantalDeelnames: number;
  punten: number;
}
 
export interface TeamRow {
  team: string;
  punten: number;
  riders: string[];
}
 
export function exportKlassementToExcel(
  rows: KlassementRow[],
  regelmatigheid: RegelmatigheidRow[] = [],
  teamSTA: TeamRow[] = [],
  teamMixed: TeamRow[] = [],
  races: Race[] = [],
  allResults: RaceResult[] = [],       // needed for raw finish positions in regelmatigheid sheet
  maxPoints: number = 80,              // pass scoringCfg.maxPoints
  secondPeriodStartWeek: number = 0    // pass config.secondPeriodStartWeek; 0 = not started
): Buffer {
  const wb = XLSX.utils.book_new();
 
  const allRaceNames = races.map((r) => r.name);
 
  // ── Period split ──────────────────────────────────────────────────────────
  const eersteRaces = races.filter(
    (r) => secondPeriodStartWeek === 0 || r.sort_order < secondPeriodStartWeek
  );
  const tweedeRaces = races.filter(
    (r) => secondPeriodStartWeek > 0 && r.sort_order >= secondPeriodStartWeek
  );
 
  function countParticipated(row: KlassementRow, raceSubset: Race[]): number {
    return raceSubset.filter((r) => {
      const pts = row.weekPoints[r.name];
      return pts !== undefined && pts < maxPoints;
    }).length;
  }
 
  // ── Tiebreak helper ───────────────────────────────────────────────────────
  function countPodiums(wp: Record<string, number>) {
    return Object.values(wp).filter((p) => p <= 3).length;
  }
 
  // ── Global ranking (klassement) ───────────────────────────────────────────
  const globalSorted = [...rows].sort((a, b) => {
    if (a.totaal !== b.totaal) return a.totaal - b.totaal;
    const ap = countPodiums(a.weekPoints);
    const bp = countPodiums(b.weekPoints);
    if (ap !== bp) return bp - ap;
    return a.bib - b.bib;
  });
  const globalRankMap = new Map<number, number>();
  globalSorted.forEach((r, idx) => globalRankMap.set(r.bib, idx + 1));
 
  // ── Per-class per-categorie ranking ───────────────────────────────────────
  const klasseCategMap = new Map<string, Map<string, KlassementRow[]>>();
  for (const row of rows) {
    if (!klasseCategMap.has(row.klasse))
      klasseCategMap.set(row.klasse, new Map());
    const cm = klasseCategMap.get(row.klasse)!;
    if (!cm.has(row.categorie)) cm.set(row.categorie, []);
    cm.get(row.categorie)!.push(row);
  }
  for (const cm of klasseCategMap.values()) {
    for (const [cat, catRows] of cm.entries()) {
      cm.set(
        cat,
        [...catRows].sort((a, b) => {
          if (a.totaal !== b.totaal) return a.totaal - b.totaal;
          const ap = countPodiums(a.weekPoints);
          const bp = countPodiums(b.weekPoints);
          if (ap !== bp) return bp - ap;
          return a.bib - b.bib;
        })
      );
    }
  }
  const categRankMap = new Map<number, { STA?: number; SEN?: number; DAM?: number }>();
  for (const cm of klasseCategMap.values()) {
    for (const [cat, catRows] of cm.entries()) {
      catRows.forEach((r, idx) => {
        if (!categRankMap.has(r.bib)) categRankMap.set(r.bib, {});
        const entry = categRankMap.get(r.bib)!;
        if (cat === "STA") entry.STA = idx + 1;
        else if (cat === "SEN") entry.SEN = idx + 1;
        else if (cat === "DAM") entry.DAM = idx + 1;
      });
    }
  }
 
  // ── Klasse sort order ─────────────────────────────────────────────────────
  const klasseOrder = ["A", "A40+", "B", "B50+", "C", "D", "E"];
  const klasseSortIndex = (k: string) => {
    const i = klasseOrder.indexOf(k);
    return i === -1 ? 999 : i;
  };
 
  const sortedRows = [...rows].sort((a, b) => {
    const ki = klasseSortIndex(a.klasse) - klasseSortIndex(b.klasse);
    if (ki !== 0) return ki;
    return a.plaatsKlasse - b.plaatsKlasse;
  });
 
  // ── Shared base columns builder ───────────────────────────────────────────
  function buildBaseColumns(
    row: KlassementRow,
    plaatsOverride: number | string
  ): Record<string, unknown> {
    const catRanks = categRankMap.get(row.bib) ?? {};
    return {
      "Plaats":             plaatsOverride,
      "Nr.":                row.bib,
      "Naam":               row.naam,
      "Klasse":             row.klasse,
      "Plaats klasse":      row.plaatsKlasse,
      "Cat.":               row.categorie,
      "Plaats STA":         catRanks.STA ?? "",
      "Plaats SEN":         catRanks.SEN ?? "",
      "Plaats DAM":         catRanks.DAM ?? "",
      "Aantal voor verlof": countParticipated(row, eersteRaces),
      "Aantal na verlof":   countParticipated(row, tweedeRaces),
    };
  }
 
  // ── KLASSEMENT sheet ──────────────────────────────────────────────────────
  const klassementData = sortedRows.map((row) => {
    const base = buildBaseColumns(row, globalRankMap.get(row.bib) ?? "");
    base["1e Periode"] = row.eerstePeriode;
    base["2e Periode"] = row.tweedePeriode;
    base["Totaal"]     = row.totaal;
    for (const raceName of allRaceNames) {
      if (row.weekPoints[raceName] !== undefined) {
        base[raceName] = row.weekPoints[raceName];
      }
    }
    return base;
  });
 
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(klassementData),
    "KLASSEMENT"
  );
 
  // ── REGELMATIGHEID sheet ──────────────────────────────────────────────────
  // Build raw finish position lookup: bib → (sort_order → plaats)
  const rawResultsByBib = new Map<number, Map<number, number>>();
  for (const r of allResults) {
    if (!rawResultsByBib.has(r.bib)) rawResultsByBib.set(r.bib, new Map());
    rawResultsByBib.get(r.bib)!.set(r.week, r.plaats);
  }
 
  // Score: sum of all races (DNS = maxPoints) minus single worst
  function regelmatigheidScore(bib: number): number {
    const resultMap = rawResultsByBib.get(bib) ?? new Map();
    const scores = races.map((r) => resultMap.get(r.sort_order) ?? maxPoints);
    if (scores.length === 0) return 0;
    const total = scores.reduce((a, b) => a + b, 0);
    const worst = Math.max(...scores);
    return total - worst;
  }
 
  // Regelmatigheid-specific global ranking (lower = better, more participations breaks ties)
  const regSorted = [...rows].sort((a, b) => {
    const sa = regelmatigheidScore(a.bib);
    const sb = regelmatigheidScore(b.bib);
    if (sa !== sb) return sa - sb;
    const pa = (rawResultsByBib.get(a.bib) ?? new Map()).size;
    const pb = (rawResultsByBib.get(b.bib) ?? new Map()).size;
    if (pa !== pb) return pb - pa;
    return a.bib - b.bib;
  });
  const regRankMap = new Map<number, number>();
  regSorted.forEach((r, idx) => regRankMap.set(r.bib, idx + 1));
 
  const regelmatigheidData = sortedRows.map((row) => {
    const base = buildBaseColumns(row, regRankMap.get(row.bib) ?? "");
    base["Strafpunten"]  = "";  // always empty, manual override column
    base["Totaal punten"] = regelmatigheidScore(row.bib);
 
    const resultMap = rawResultsByBib.get(row.bib) ?? new Map();
    for (const race of races) {
      // raw finish position; DNS shows as maxPoints (80)
      base[race.name] = resultMap.get(race.sort_order) ?? maxPoints;
    }
 
    return base;
  });
 
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(regelmatigheidData),
    "REGELMATIGHEID"
  );
 
  // ── STA TEAMS sheet ───────────────────────────────────────────────────────
  if (teamSTA.length > 0) {
    const staData = teamSTA
      .filter((t) => t.team && !["geen team", "individueel"].includes(t.team.toLowerCase()))
      .map((row, idx) => ({ "#": idx + 1, "Team": row.team, "Punten": row.punten }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(staData), "STA TEAMS");
  }
 
  // ── MIXED TEAMS sheet ─────────────────────────────────────────────────────
  if (teamMixed.length > 0) {
    const mixedData = teamMixed
      .filter((t) => t.team && !["geen team", "individueel"].includes(t.team.toLowerCase()))
      .map((row, idx) => ({ "#": idx + 1, "Team": row.team, "Punten": row.punten }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mixedData), "MIXED TEAMS");
  }
 
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}