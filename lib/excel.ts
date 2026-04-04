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
export function parseDeelnemersFile(buffer: ArrayBuffer) {
  // Read the workbook from the buffer
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  // Convert sheet to 2D array (header: 1 ensures we get arrays of values)
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
  });

  // 🔍 Search for the header row. 
  // Based on your file, it's looking for "nr" or "naam".
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => {
      const val = String(cell).toLowerCase();
      return val.includes("nr") || val.includes("naam");
    })
  );

  if (headerIndex === -1) return [];

  // Normalize headers for easier indexing
  const headers = rows[headerIndex].map((h) =>
    String(h).toLowerCase().trim()
  );

  const dataRows = rows.slice(headerIndex + 1);

  return dataRows
    .map((row) => {
      // Skip empty rows
      if (!row || row.length === 0 || row.every(cell => !cell)) return null;

      const get = (names: string[]) => {
        const idx = headers.findIndex((h) => 
          names.some(name => h === name || h.includes(name))
        );
        return idx !== -1 ? row[idx] : "";
      };

      // Extract Name (Required)
      const naam = String(get(["naam"]) || "").trim();
      if (!naam) return null;

      // Extract Bib (Nr)
      const bibRaw = get(["nr", "nummer"]);
      const bib = typeof bibRaw === "number"
          ? bibRaw
          : parseInt(String(bibRaw).replace(/\D/g, "")) || 0;

      // Extract Klasse (Map to your needs, using 'cat' if separate class column missing)
      const klasse = String(get(["klasse", "cat"]) || "").trim().toUpperCase();

      // Extract Categorie with strict validation for ('STA', 'SEN', 'DAM')
      let categorie = String(get(["cat", "categorie"]) || "").trim().toUpperCase();
      if (!["STA", "SEN", "DAM"].includes(categorie)) {
        // Fallback or transformation logic if the file uses different codes
        if (categorie.startsWith("S")) categorie = "SEN";
        else if (categorie.startsWith("D")) categorie = "DAM";
        else categorie = "STA"; 
      }

      // Extract Team (Ploeg)
      const team = String(get(["ploeg", "team"]) || "").trim();

      return {
        bib,
        naam,
        klasse,
        categorie,
        team: team || null,
      } as Deelnemer;
    })
    .filter(Boolean);
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
