# Port the ATB-Cross workbook scoring rules into atb-klassement

> Implementation plan, derived from `2026_08_na_BOOM.xlsm`. Lower points = better everywhere.

## Context

The official 2026 ATB-Cross standings are produced by `2026_08_na_BOOM.xlsm`. `atb-klassement` was built to replace that workbook, but its scoring engine (`lib/klassement.ts`) implements an approximation: it has no DNF concept, no per-race "counts toward the standings" flag, no per-race fixed points, a different best-N rule, a single season-wide participation threshold instead of the workbook's per-period qualification, and a regelmatigheid that re-derives points from raw `plaats` instead of reusing the klassement points.

This plan brings the engine in line with the workbook spec so the app reproduces the workbook's numbers exactly. Scope for **phase 1** is gaps 1–7 and 10 from the spec (the SK klassement engine, the SR regelmatigheid, config, and the klasse list). Teams (gaps 8, 9) and the OG promotion/relegation module (gap 12) are specified at the end as **phase 2** and are not implemented now.

Outcome: `computeKlassement` / `computeRegelmatigheid` produce the same values as SK and SR for the 2026 season, with all tunables coming from config rather than defaults, and a vitest suite pinning the rules.

**Stack note.** A move off Next.js to TanStack Start, possibly with a separately hosted backend, is under consideration but is *not* part of this plan. So the engine is deliberately built stack-agnostic (§0): pure TypeScript, no Next, no Supabase, no I/O. Whatever the app becomes, it imports the same package. Appendix B sketches the backend options so that decision can be made later without touching this work.

### Decisions taken
- **VET**: follow the workbook and produce a merged SEN+VET standing, but *keep* the existing separate `plaatsVET` ranking as an extra view the workbook does not have.
- **Klasse list**: `KLASSE_ORDER = ["A","B","C","D","E"]`. No `F`. Existing klasse values are kept as they are — no data remap. `A40+` / `B50+` come out of the order list; their aliases fold onto the base klasse so legacy rows still sort sensibly.
- **Tests**: add vitest (the repo has none today).
- **Packaging**: the engine becomes a standalone framework-free module (§0), so a later TanStack Start / separate-backend move does not require re-porting it.

---

## 0. Isolate the engine first

Before any rule changes, move the scoring code into a self-contained folder with no framework imports — `lib/scoring/` (or `packages/scoring/` if you want a real workspace later):

```
lib/scoring/
  types.ts          Race, Deelnemer, RaceResult, KlassementRow, KlasseSwitch, Categorie, KLASSE_ORDER
  config.ts         ScoringConfig + DEFAULT_SCORING_CONFIG  (from lib/scoring-config.ts, minus the DB mappers)
  points.ts         per-race per-rider point map  (§3)
  klassement.ts     SK  (§4)
  regelmatigheid.ts SR  (§5)
  index.ts          public surface
  __tests__/
```

Rules for this folder: no `next/*`, no `@supabase/*`, no `process.env`, no `fs`, no date-of-"now" — the caller passes `racesHeld` and race dates in. Everything is a pure function of (deelnemers, races, results, config).

What stays outside it: `parseScoringConfig` / `scoringConfigToDb` (DB-shaped, keep in `lib/scoring-config.ts`), `lib/excel.ts`, `lib/supabase.ts`, the API routes and the components. They import from `lib/scoring`.

This is a mechanical move; do it as its own commit so the rule rewrites that follow show up as real diffs. Everything in §§1–7 below then happens inside this folder, except where a file path outside it is named explicitly.

## 1. Data model + schema

Types move from `lib/utils.ts` into `lib/scoring/types.ts` (§0); `lib/utils.ts` re-exports them so existing imports keep compiling.

- `RaceResult`: add `dnf?: boolean`, `strafpunten?: number | null`.
- `Race`: add `counts_for_klassement?: boolean` (default true) and `fixed_points?: number | null`.
- `CLASS_NAME_ALIASES` (`lib/utils.ts:12-23`): map `"A40+"`, `"A + 40j"`, … → `"A"` and `"B50+"`, `"B + 50j"`, … → `"B"`.
- Export a single `KLASSE_ORDER = ["A","B","C","D","E"]` and **delete the four local copies**: `lib/klassement.ts:293`, `KlassementTab.tsx:5`, `DamKlassementTab.tsx:9`, `lib/excel.ts:188`.
- `KlassementRow`: add `startsPeriode1: number`, `startsPeriode2: number` (SK columns J/K — needed by the UI and by phase 2), and `plaatsSENVET?: number`.

`supabase-schema.sql` — extend in the file's existing `alter table … add column if not exists` style:
- `races`: `counts_for_klassement boolean default true`, `fixed_points integer`.
- `race_results`: `dnf boolean default false`, `strafpunten integer default 0`.
- `deelnemers`: widen the `categorie` check at line 12 to include `'VET'` (it is in the TS type and used by the engine, but the DB rejects it today).
- `config`: add the ScoringConfig columns — this file never got them, so add the whole existing set plus the new ones below.

The `"vrij"`/`""` race-name filtering in `app/api/klassement/route.ts:36-39`, `download-excel/route.ts:34-37` and `send-email/route.ts:41-44` is the current stand-in for "doesn't count". Replace it with the real `counts_for_klassement` flag and delete the string matching.

## 2. Config (`lib/scoring-config.ts`)

Add to `ScoringConfig`, `DEFAULT_SCORING_CONFIG`, `parseScoringConfig` and `scoringConfigToDb` (all four move together — they are parallel lists):

| field | column | 2026 value | workbook name |
|---|---|---|---|
| `dnfPoints` | `dnf_points` | 20 | `P_DNF` |
| `klasseSwitchPoints` | *(exists)* | 50 | `P_Opgegaan` |
| `capFinishPosition` | *(exists)* | 60 | `P_Gelijk` |
| `maxPoints` | *(exists)* | 80 | `P_DNS` |
| `bestPct` | *(exists)* | **100** | `Pr_kamp` |
| `firstPeriodRaces` | *(exists)* | 10 | `AW_voor_verlof` |
| `secondPeriodRaces` | *(exists)* | 7 | `AW_na_verlof` |
| `seasonRaces` | `season_races` | 17 | `AW_seizoen` |

`minParticipationPct` is no longer used by the qualification rule (§4) — leave the field in place but stop reading it in `computeKlassement`, and drop its input from `app/instellingen/page.tsx`.

**Fix while here:** `app/api/config/route.ts` POST (lines 41-63) never persists `first_period_races`, `second_period_races` or `min_participation_pct`, even though the settings page sends them. Add them plus every new column, otherwise `Pr_kamp = 100` and the period sizes cannot actually be saved.

## 3. Per-race cell value (SK) — rewrite the main loop in `computeKlassement`

Replace `lib/klassement.ts:106-164`. Precedence, in order, per rider per race:

1. race has `counts_for_klassement = false` → compute the value normally but mark it **non-counting**;
2. rider absent from the race sheet → `maxPoints` (80);
3. rider switched klasse and the switch date is on/after this race → `klasseSwitchPoints` (50);
4. race has `fixed_points` → that value for the whole field;
5. otherwise → the klasse points from the race.

Representation: the workbook stores non-counting values as the text `"80x"`. Do **not** port the string hack. Keep `weekPoints: Record<string, number>` for display and add a parallel `weekCounts: Record<string, boolean>`; sums skip entries where `weekCounts[race] === false`, participation counting does not.

Klasse points within a race (replacing the dense re-rank at lines 151-157):
- rank resets to 1 whenever the ridden klasse changes down the finish order — the existing dense counter per `klasseForWeek` group already does this;
- each subsequent rider is `min(previous + 1, capFinishPosition)`;
- `dnf = true` → `dnfPoints` (20), and the rider does **not** consume a rank slot but is still a participant;
- placeholder day-riders (`DAGRENNER A REEKS`) *do* consume a rank slot. They are result rows with no matching `deelnemer`; the loop must keep incrementing `rank` for them. Today the rank counter iterates `weekResults` so this already works — add a test to lock it in.

Note the existing `klasseSwitchPoints` branch keys off `raceKlasse !== currentKlasse` (line 126). The workbook uses `KlasDat >= race date`. These differ on the boundary race (the first race in the new klasse). Switch to the date comparison via `KlasseSwitch.from_week <= week`, so the first race in the new klasse scores normally.

`override_points` (line 111) stays as the per-rider manual escape hatch and keeps top precedence, above everything.

## 4. Best-N and qualification

Replace `sumBestPct` (`lib/klassement.ts:167-172`):

```
n_period1 = MIN(firstPeriodRaces, ceil(firstPeriodRaces * bestPct/100), racesHeld)
n_period2 = MIN(secondPeriodRaces, ceil(secondPeriodRaces * bestPct/100), racesHeld, racesHeldInPeriod2)
```

Sum the `n` smallest *counting* values in the period. If the period has fewer counting values than `n`, fall back to the plain sum of the whole period (the workbook's `SMALL` error fallback).

`totaal = eerstePeriode + tweedePeriode` — **not** a fresh best-N over the whole season, which is what line 212 does today.

Participation counts (SK columns J/K): a race counts as a start when a real result exists — DNS excluded, DNF included, non-counting races included.

Qualification replaces lines 220-254 entirely. Two independent per-period checks, each only applied once enough races have been held:
- `racesHeld >= n_period1 && startsPeriode1 < n_period1` → disqualified;
- `racesHeld >= n_period2 + firstPeriodRaces && startsPeriode2 < n_period2` → disqualified.

Disqualified → blank total (the UI must render empty, not `0`) and the `X<klasse>` label, sorted to the bottom. `Math.ceil(totalRacesConfigured * minFraction)` at line 242 goes away.

## 5. Regelmatigheid (SR)

`computeRegelmatigheid` (`lib/klassement.ts:353-398`) currently re-derives from raw `plaats` and ignores overrides and klasse switches. Rewrite it to **reuse the same per-race points** computed in §3 — same DNS / opgegaan / fixed-points precedence — with one difference: non-counting races *do* count for SR, so it ignores `weekCounts`.

The cleanest shape: export a shared helper that produces the per-rider per-race point map, and have `computeRegelmatigheid` take that instead of `allResults`. Then:

`totaal = sum(all races) − max(all races) + strafpunten`

Exactly one dropped result regardless of season length. No period split, no qualification rule. `strafpunten` is the manual per-rider column — `lib/excel.ts:274` already emits a `"Strafpunten"` header hardcoded to `""`; wire it to the real field.

`lib/excel.ts:250-257` contains a third re-implementation (`regelmatigheidScore`) over `races.length`. Delete it and call the shared function.

## 6. Call sites

- `app/api/download-excel/route.ts:43-47` and `app/api/send-email/route.ts` omit the `klasseSwitches` argument that `app/api/klassement/route.ts:50-55` passes — so exports already disagree with the dashboard. Extract one `buildStandings()` helper used by all three routes rather than three arg lists to keep in sync.
- `KlassementTab.tsx:63-76` recomputes per-category rankings itself as sequential counters and hardcodes `MAX_PTS = 80` (line 8) and `Plaats = idx + 1` (line 132). Make it consume `plaatsSTA` / `plaatsSENVET` / `plaatsDAM` / `plaats` from the engine and take `maxPoints` from config.
- Non-counting races need a visual marker in the table (the workbook's `x`), driven by `weekCounts`.

## 7. Tests

Add `vitest` + a `"test": "vitest run"` script. The compute functions are pure and take config as an argument, so fixtures are plain literals in `lib/scoring/__tests__/fixtures.ts`.

Cases to pin:
- DNF scores 20, does not consume a rank slot, counts as a start;
- placeholder day-rider consumes a rank slot and shifts everyone behind;
- non-counting race: excluded from SK total, included in SK participation, included in SR;
- `fixed_points` overrides the whole field but loses to `override_points`;
- klasse-switch boundary race scores normally, earlier races score 50;
- rank cap at 60 and DNS at 80;
- best-N with an incomplete period falls back to the plain sum;
- each period's disqualification fires independently and only after enough races;
- `totaal === eerstePeriode + tweedePeriode`;
- SR = sum − worst + strafpunten.

Where possible seed one fixture from real 2026 data and assert against the workbook's own SK output.

## 8. Local Supabase (Docker) + SQL from the command line

The SQL can be run from a command, and everything can be tested locally first. Today the repo has no `supabase/` directory, no CLI and no `.env.local`; it is wired straight to the hosted project via `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (`lib/supabase.ts:3-12`). Docker 28.5.1 is installed; the CLI is not, so use `npx`.

Set up a local stack (the CLI runs Postgres, PostgREST, Auth and Studio in Docker):

```bash
npx supabase init && npx supabase start
```

Convert `supabase-schema.sql` into the CLI's migration folder and add the new columns as a second migration, so the schema stops being a hand-pasted file:

```bash
npx supabase migration new baseline
```

```bash
npx supabase migration new atb_scoring_columns
```

```bash
npx supabase db reset
```

Ad-hoc SQL against the local DB, without Studio and without `psql` on PATH (it isn't installed) — run it inside the CLI's own Postgres container:

```bash
docker exec -i supabase_db_atb-klassement psql -U postgres -d postgres < supabase-schema.sql
```

Point the app at it with a `.env.local` holding the API URL and anon/service keys printed by `supabase start` (add `.env.local` to `.gitignore` — it is not there today). Seed it from a dump of the hosted project (`npx supabase db dump --data-only`) or from the existing Excel import flow so the workbook comparison below runs against real 2026 data.

Once it is verified locally, apply the same migration to the hosted project with `npx supabase db push` (or paste the migration file into the SQL editor) — no hand-editing of the live schema.

## 9. Startlijst download named after the next race

Separate from the scoring port: `app/startlijst/page.tsx` (which already fetches `/api/klassement` at line 309) should offer a "download startlijst" export whose filename and header carry the **next** race — the first `race` whose date is in the future, ordered by `sort_order`, falling back to the last race when the season is over.

**Blocked on input:** the existing startlijst file needs to be supplied so the generated sheet matches its layout, columns and ordering. Once that file exists, this step becomes: add a `startlijst` export in `lib/excel.ts` beside the existing exporters, mirroring that layout, plus a download route/button on the startlijst page. Do not guess the columns — implement it after the file arrives.

## Verification

1. `npm run lint` and `npm run test` clean.
2. Bring up the local stack (§8), run `npx supabase db reset`, and confirm the settings page saves `first_period_races` / `second_period_races` / `bestPct = 100` and that they survive a reload (this is broken today). Only then push the migration to the hosted project.
3. `npm run dev` against the local stack, open `/dashboard`, and compare the klassement, the DAM view and the regelmatigheid tab against the SK and SR sheets of `2026_08_na_BOOM.xlsm` for the 13 races held — spot-check a rider who DNF'd, one who switched klasse mid-season, one disqualified on period 2, and the Oosterhout (race 2, non-counting) column.
4. Download the Excel export and confirm it now matches the dashboard (it does not today, because of the missing arguments in `download-excel`).
5. Startlijst export (§9) — only once the reference file is supplied: download it and diff the columns and ordering against that file, and check the filename carries the next race.

---

## Appendix A — phase 2, not implemented in this plan

- **Teams (gaps 8, 9)** — a complete rewrite of `computeTeamScores` (`lib/klassement.ts:403-454`). The workbook scores teams on *per-race team ranking*, not on the sum of riders' season totals: four slots per race (STA, STA, SEN+VET, best of DAM/VET) filled by lowest matching in-race rank, penalties 500/500/150/150 for unfilled slots, 200 when the whole team is absent, then teams ranked by that race's sum and the ranking *position* is the team's result; those positions then aggregate exactly like SK does for riders. Also fixes the existing bug where a rider matching two slot specs is counted twice, and `TeamTab.tsx:16` sorting descending against "lower is better".
- **Promotion / relegation (gap 12)** — new module. Per rider per race `pct = klasse points / field size in that klasse × 100`; non-counting, blank and DNS excluded; fixed-points races → 25; rank beyond field size → 101. Promotion average = mean of the 2nd–5th best percentages (101 → 25), gated on both periods being qualified; ≤10% promote, ≥80% relegate.

---

## Appendix B — TanStack Start + a separate backend (decision deferred)

Not decided, not part of this plan. §0 is what makes it cheap: the engine is a pure module, so it moves to any of these unchanged.

**Can the backend be fully separate and hosted free?** Yes. Three shapes worth comparing:

| Option | Free? | Cost of the move |
|---|---|---|
| **TanStack Start hosts its own API** (server routes) on Netlify or Cloudflare, keeps Supabase | Yes, one deploy | Smallest. Rewrites the 10 `app/api/*` routes as server routes; keeps `@supabase/supabase-js`, `nodemailer`, `xlsx`, `jspdf`. |
| **Hono on Cloudflare Workers + Neon Postgres** | Yes — no idle spin-down, generous limits | Largest. Workers is not Node: `nodemailer` must become an HTTP mail API (Resend/Postmark), and `@supabase/supabase-js` gives way to Drizzle or plain SQL. Fastest and most durable free tier. |
| **Node API (Fastify/Hono) on Fly.io or Render + Supabase** | Free tiers exist but are the least stable — Render spins down after ~15 min idle (slow first request), Fly/Railway allowances are credit-based | Medium. Real Node, so `nodemailer`/`xlsx`/`jspdf` and the Supabase client all keep working as-is. |

Free-tier catch on the DB side: Supabase free **pauses a project after ~1 week of inactivity** — a real risk for a site that is quiet between race seasons. Neon's free tier scales to zero but resumes automatically, which suits this traffic shape better.

Recommendation for a genuinely separate, genuinely free backend: **Hono on Cloudflare Workers + Neon**, with the frontend as TanStack Start on Cloudflare Pages. If the goal is mainly "get off Next.js", the first row is far less work and equally free.
