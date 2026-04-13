import * as XLSX from "xlsx";
import { Deelnemer, KlassementRow, Race, normalizeKlasse } from "./utils";
import { RaceResult } from "./utils";

// --- PARSE FINISH RESULTS FILE ---
export function parseFinishFile(buffer: ArrayBuffer): RaceResult[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, {
    defval: null,
  });

  const results: RaceResult[] = [];
  for (const row of rows) {
    const bib = parseInt(String(row["bib"] ?? row["BIB"] ?? row["Bib"] ?? ""));
    const plaats = parseInt(
      String(row["pl"] ?? row["PL"] ?? row["Pl"] ?? row["plaats"] ?? row["Plaats"] ?? "")
    );
    if (!isNaN(bib) && !isNaN(plaats)) {
      results.push({ bib, plaats, week: 0 });
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
  races: Race[] = []
): Buffer {
  const wb = XLSX.utils.book_new();

  // Race names in sort_order
  const allRaceNames = races.map((r) => r.name);

  // Group rows by klasse
  const klasseMap = new Map<string, KlassementRow[]>();
  for (const row of rows) {
    if (!klasseMap.has(row.klasse)) klasseMap.set(row.klasse, []);
    klasseMap.get(row.klasse)!.push(row);
  }

  const klasseOrder = ["A", "A40+", "B", "B50+", "C", "D", "E"];
  const klasseSortIndex = (k: string) => {
    const i = klasseOrder.indexOf(k);
    return i === -1 ? 999 : i;
  };

  // Sheet: KLASSEMENT — sorted by class order, then plaatsKlasse
  const sortedRows = [...rows].sort((a, b) => {
    const ki = klasseSortIndex(a.klasse) - klasseSortIndex(b.klasse);
    if (ki !== 0) return ki;
    return a.plaatsKlasse - b.plaatsKlasse;
  });

  const klassementData = sortedRows.map((row) => {
    const base: Record<string, unknown> = {
      "Nr.": row.bib,
      Naam: row.naam,
      Klasse: row.klasse,
      "Cat.": row.categorie,
      Team: row.team ?? "",
      "Plaats Klasse": row.plaatsKlasse,
      "1e Periode": row.eerstePeriode,
      "2e Periode": row.tweedePeriode,
      Totaal: row.totaal,
    };
    for (const raceName of allRaceNames) {
      if (row.weekPoints[raceName] !== undefined) {
        base[raceName] = row.weekPoints[raceName];
      }
    }
    return base;
  });

  const ws = XLSX.utils.json_to_sheet(klassementData);
  XLSX.utils.book_append_sheet(wb, ws, "KLASSEMENT");

  // Per-klasse sheets — in defined class order
  const sortedKlasses = [...klasseMap.entries()].sort(
    (a, b) => klasseSortIndex(a[0]) - klasseSortIndex(b[0])
  );

  for (const [klasse, klasseRows] of sortedKlasses) {
    const sheetData = [...klasseRows]
      .sort((a, b) => a.plaatsKlasse - b.plaatsKlasse)
      .map((row) => {
        const base: Record<string, unknown> = {
          "Nr.": row.bib,
          Naam: row.naam,
          "Cat.": row.categorie,
          Plaats: row.plaatsKlasse,
          Totaal: row.totaal,
        };
        for (const raceName of allRaceNames) {
          if (row.weekPoints[raceName] !== undefined) {
            base[raceName] = row.weekPoints[raceName];
          }
        }
        return base;
      });
    const sheetName = klasse.replace(/[:\\/?*\[\]]/g, "_").substring(0, 31);
    const ws2 = XLSX.utils.json_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws2, sheetName);
  }

  // Sheet: REGELMATIGHEID
  if (regelmatigheid.length > 0) {
    const regData = regelmatigheid.map((row, idx) => ({
      "Pos.": idx + 1,
      "Nr.": row.bib,
      Naam: row.naam,
      Klasse: row.klasse,
      Punten: row.punten,
    }));
    const wsReg = XLSX.utils.json_to_sheet(regData);
    XLSX.utils.book_append_sheet(wb, wsReg, "REGELMATIGHEID");
  }

  // Sheet: STA TEAMS
  if (teamSTA.length > 0) {
    const staData = teamSTA
      .filter((t) => t.team && t.team.toLowerCase() !== "geen team" && t.team.toLowerCase() !== "individueel")
      .map((row, idx) => ({ "#": idx + 1, Team: row.team, Punten: row.punten }));
    const wsSTA = XLSX.utils.json_to_sheet(staData);
    XLSX.utils.book_append_sheet(wb, wsSTA, "STA TEAMS");
  }

  // Sheet: MIXED TEAMS
  if (teamMixed.length > 0) {
    const mixedData = teamMixed
      .filter((t) => t.team && t.team.toLowerCase() !== "geen team" && t.team.toLowerCase() !== "individueel")
      .map((row, idx) => ({ "#": idx + 1, Team: row.team, Punten: row.punten }));
    const wsMixed = XLSX.utils.json_to_sheet(mixedData);
    XLSX.utils.book_append_sheet(wb, wsMixed, "MIXED TEAMS");
  }

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}