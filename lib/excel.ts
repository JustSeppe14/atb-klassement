import * as XLSX from "xlsx";
import { Deelnemer, KlassementRow, RACE_NAMES, normalizeKlasse, getRaceName } from "./utils";
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
      results.push({ bib, plaats, week: 0 }); // week filled by caller
    }
  }
  return results;
}

// --- PARSE DEELNEMERS FILE ---
export function parseDeelnemersFile(buffer: ArrayBuffer): Deelnemer[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  // Header is on row 7 (index 6)
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, {
    range: 6,
    defval: null,
  });

  const deelnemers: Deelnemer[] = [];
  for (const row of rows) {
    const bib = parseInt(
      String(row["nummer"] ?? row["Nummer"] ?? row["bib"] ?? row["Nr."] ?? "")
    );
    const naam = String(
      row["naam"] ?? row["Naam"] ?? row["name"] ?? ""
    ).trim().toLowerCase();
    const klasse = normalizeKlasse(
      String(row["klasse"] ?? row["Klasse"] ?? "").trim()
    );
    const categorie = String(
      row["categorie"] ?? row["Categorie"] ?? row["cat"] ?? row["Cat."] ?? ""
    ).trim() as Deelnemer["categorie"];
    const team = String(row["team"] ?? row["Team"] ?? "").trim();

    if (!isNaN(bib) && naam && klasse) {
      deelnemers.push({ bib, naam, klasse, categorie, team: team || undefined });
    }
  }
  return deelnemers;
}

// --- EXPORT KLASSEMENT TO EXCEL ---
export function exportKlassementToExcel(rows: KlassementRow[]): Buffer {
  const wb = XLSX.utils.book_new();

  // Group rows by klasse for separate sheets
  const klasseMap = new Map<string, KlassementRow[]>();
  for (const row of rows) {
    if (!klasseMap.has(row.klasse)) klasseMap.set(row.klasse, []);
    klasseMap.get(row.klasse)!.push(row);
  }

  // Get all race names in order
  const allRaceNames = Object.values(RACE_NAMES);

  // Sheet: KLASSEMENT (all riders)
  const klassementData = rows.map((row) => {
    const base: Record<string, unknown> = {
      "Nr.": row.bib,
      Naam: row.naam,
      Klasse: row.klasse,
      "Cat.": row.categorie,
      Team: row.team ?? "",
      "Plaats Klasse": row.plaatsKlasse,
      "Plaats STA": row.plaatsSTA ?? "",
      "Plaats SEN": row.plaatsSEN ?? "",
      "Plaats DAM": row.plaatsDAM ?? "",
      "1e Periode": row.eerstePeriode,
      "2e Periode": row.tweedePeriode,
      Totaal: row.totaal,
    };
    // Add week columns
    for (const raceName of allRaceNames) {
      if (row.weekPoints[raceName] !== undefined) {
        base[raceName] = row.weekPoints[raceName];
      }
    }
    return base;
  });

  const ws = XLSX.utils.json_to_sheet(klassementData);
  XLSX.utils.book_append_sheet(wb, ws, "KLASSEMENT");

  // Per-klasse sheets
  for (const [klasse, klasseRows] of klasseMap.entries()) {
    const sheetData = klasseRows.map((row) => {
      const base: Record<string, unknown> = {
        "Nr.": row.bib,
        Naam: row.naam,
        "Cat.": row.categorie,
        "Plaats": row.plaatsKlasse,
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

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
