// lib/scoring-config.ts

export interface TeamSlot {
  cat: "STA" | "SEN" | "DAM" | "VET";
  count: number;
}

export interface ScoringConfig {
  maxPoints: number;          // points when rider does not start          (was hardcoded: 80)
  capFinishPosition: number;  // rank above this is capped to this value   (was hardcoded: 60)
  bestPct: number;            // % of races whose best scores count 0-100  (was hardcoded: 60)
  regAbsentPoints: number;    // regelmatigheid points for absent race      (was hardcoded: 80)
  regCapFinish: number;       // regelmatigheid finish cap                  (was hardcoded: 60)
  maxWeeks: number;           // total races in a full season               (was hardcoded: 20)
  teamStaSlots: TeamSlot[];   // team STA composition
  teamMixedSlots: TeamSlot[]; // team Mixed composition
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  maxPoints: 80,
  capFinishPosition: 60,
  bestPct: 60,
  regAbsentPoints: 80,
  regCapFinish: 60,
  maxWeeks: 20,
  teamStaSlots: [{ cat: "STA", count: 4 }],
  teamMixedSlots: [
    { cat: "STA", count: 2 },
    { cat: "SEN", count: 1 },
    { cat: "DAM", count: 1 },
  ],
};

/** Maps a raw Supabase config row → ScoringConfig */
export function parseScoringConfig(row: Record<string, unknown>): ScoringConfig {
  return {
    maxPoints:         typeof row.max_points          === "number" ? row.max_points          : DEFAULT_SCORING_CONFIG.maxPoints,
    capFinishPosition: typeof row.cap_finish_position === "number" ? row.cap_finish_position : DEFAULT_SCORING_CONFIG.capFinishPosition,
    bestPct:           typeof row.best_pct            === "number" ? row.best_pct            : DEFAULT_SCORING_CONFIG.bestPct,
    regAbsentPoints:   typeof row.reg_absent_points   === "number" ? row.reg_absent_points   : DEFAULT_SCORING_CONFIG.regAbsentPoints,
    regCapFinish:      typeof row.reg_cap_finish      === "number" ? row.reg_cap_finish      : DEFAULT_SCORING_CONFIG.regCapFinish,
    maxWeeks:          typeof row.max_weeks           === "number" ? row.max_weeks           : DEFAULT_SCORING_CONFIG.maxWeeks,
    teamStaSlots:      Array.isArray(row.team_sta_slots)           ? row.team_sta_slots      : DEFAULT_SCORING_CONFIG.teamStaSlots,
    teamMixedSlots:    Array.isArray(row.team_mixed_slots)         ? row.team_mixed_slots    : DEFAULT_SCORING_CONFIG.teamMixedSlots,
  };
}

/** Maps ScoringConfig → snake_case DB columns for upsert */
export function scoringConfigToDb(cfg: ScoringConfig): Record<string, unknown> {
  return {
    max_points:          cfg.maxPoints,
    cap_finish_position: cfg.capFinishPosition,
    best_pct:            cfg.bestPct,
    reg_absent_points:   cfg.regAbsentPoints,
    reg_cap_finish:      cfg.regCapFinish,
    max_weeks:           cfg.maxWeeks,
    team_sta_slots:      cfg.teamStaSlots,
    team_mixed_slots:    cfg.teamMixedSlots,
  };
}