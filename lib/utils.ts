export const MAX_POINTS = 80;

export interface Race {
  id: number;
  name: string;
  date?: string;
  sort_order: number;
}

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

export function normalizeKlasse(name: string): string {
  if (!name || typeof name !== "string") return name;
  const stripped = name.trim();
  return CLASS_NAME_ALIASES[stripped] ?? stripped;
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
  /** Klasse the rider competed in that week. Null/undefined = current klasse. */
  klasse?: string | null;
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