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
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
  });

  // 🔍 zoek header
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) =>
      String(cell).toLowerCase().includes("nummer")
    )
  );

  if (headerIndex === -1) return [];

  const headers = rows[headerIndex].map((h) =>
    String(h).toLowerCase().trim()
  );

  const dataRows = rows.slice(headerIndex + 1);

  return dataRows
    .map((row) => {
      if (!row || row.length === 0) return null;

      const get = (name: string) => {
        const idx = headers.findIndex((h) => h.includes(name));
        return idx !== -1 ? row[idx] : "";
      };

      const naam = String(get("naam") || "").trim();
      if (!naam) return null;

      const bibRaw = get("nummer");

      const bib =
        typeof bibRaw === "number"
          ? bibRaw
          : parseInt(String(bibRaw).replace(/\D/g, "")) || 0;

      const klasse = String(get("klasse") || "").trim().toUpperCase();

      let categorie = String(get("cat") || "").trim().toUpperCase();
      if (!["STA", "SEN", "DAM"].includes(categorie)) {
        categorie = "STA";
      }

      const team = String(get("team") || "").trim();

      return {
        bib,
        naam,
        klasse,
        categorie,
        team: team || null,
      };
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
