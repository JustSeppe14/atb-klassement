export const MAX_POINTS = 80;

export const RACE_NAMES: Record<number, string> = {
  1: "Balen",
  2: "Oosterhout",
  3: "Reusel",
  4: "Beverlo",
  5: "Beringen",
  6: "Merksplas",
  7: "Hooge Mierde",
  8: "Meer",
  9: "Dessel",
  10: "Geel",
  11: "Ravels",
  12: "Buul",
  13: "Kessel",
  14: "Gierle",
  15: "Boom",
  16: "Hechtel",
  17: "Diepenbeek",
  18: "Mol",
};

export const CLASS_NAME_ALIASES: Record<string, string> = {
  "A40+": "A40+",
  "A + 40j": "A40+",
  "A +40j": "A40+",
  "A+40j": "A40+",
  "A + 40": "A40+",
  "A+40": "A40+",
  "B + 50j": "B50+",
  "B+50j": "B50+",
  "B + 50": "B50+",
  "B+50": "B50+",
};

export function getRaceName(weekNum: number): string {
  return RACE_NAMES[weekNum] ?? String(weekNum);
}

export function normalizeKlasse(name: string): string {
  if (!name || typeof name !== "string") return name;
  const stripped = name.trim();
  return CLASS_NAME_ALIASES[stripped] ?? stripped;
}

export function getWeekColumns(columns: string[]): Map<number, string> {
  const weekCols = new Map<number, string>();
  for (const col of columns) {
    if (/^\d+$/.test(col)) {
      weekCols.set(parseInt(col), col);
    }
  }
  for (const [weekNum, raceName] of Object.entries(RACE_NAMES)) {
    if (columns.includes(raceName)) {
      weekCols.set(parseInt(weekNum), raceName);
    }
  }
  return new Map([...weekCols.entries()].sort((a, b) => a[0] - b[0]));
}

export function sumBest50Percent(values: (number | null | undefined)[]): number {
  const valid = values.filter((v): v is number => v != null && !isNaN(v));
  if (valid.length === 0) return 0;
  const sorted = [...valid].sort((a, b) => a - b);
  const numToInclude = Math.max(1, Math.floor(sorted.length / 2));
  return sorted.slice(0, numToInclude).reduce((a, b) => a + b, 0);
}

export type Categorie = "STA" | "SEN" | "DAM" | "VET";

export interface Deelnemer {
  id?: number;
  bib: number;
  naam: string;
  klasse: string;
  categorie: Categorie;
  team?: string;
}

export interface RaceResult {
  id?: number;
  week: number;
  bib: number;
  plaats: number;
}

export interface KlassementRow {
  bib: number;
  naam: string;
  klasse: string;
  categorie: Categorie;
  team?: string;
  weekPoints: Record<string, number>; // raceName -> points
  totaal: number;
  eerstePeriode: number;
  tweedePeriode: number;
  plaatsKlasse: number;
  plaatsSTA?: number;
  plaatsSEN?: number;
  plaatsDAM?: number;
  plaatsVET?: number;
}

export interface SeasonConfig {
  currentWeek: number;
  isSecondPeriodStarted: boolean;
  secondPeriodStartWeek: number;
  seasonEnded: boolean;
}

export const DEFAULT_CONFIG: SeasonConfig = {
  currentWeek: 1,
  isSecondPeriodStarted: false,
  secondPeriodStartWeek: 12,
  seasonEnded: false,
};
