"use client";
import { Fragment, useState } from "react";
import { DashboardData } from "../page";

const KLASSE_ORDER = ["A", "A40+", "B", "B50+", "C", "D", "E"];
const klasseRankMap = new Map(KLASSE_ORDER.map((k, i) => [k, i]));

const MAX_PTS = 80;

function countStarts(weekPoints: Record<string, number>, raceNames: string[]): number {
  return raceNames.filter((name) => { const pts = weekPoints[name]; return pts !== undefined && pts < MAX_PTS; }).length;
}

export default function KlassementTab({ data }: { data: DashboardData }) {
  const [filterKlasse, setFilterKlasse] = useState("all");

  const klasses = [
    "all",
    ...Array.from(new Set(data.klassement.map((r) => r.klasse))).sort(
      (a, b) => (klasseRankMap.get(a) ?? 999) - (klasseRankMap.get(b) ?? 999)
    ),
  ];

  const sortedRaces = [...data.races].sort((a, b) => a.sort_order - b.sort_order);

  const secondStart: number = (data.config as any).secondPeriodStartWeek ?? 12;

  const firstPeriodRaceNames = sortedRaces
    .filter((r) => !data.config.isSecondPeriodStarted || r.sort_order < secondStart)
    .map((r) => r.name);

  const secondPeriodRaceNames = data.config.isSecondPeriodStarted
    ? sortedRaces.filter((r) => r.sort_order >= secondStart).map((r) => r.name)
    : [];

  const all = data.klassement.filter(
    (r) => filterKlasse === "all" || r.klasse === filterKlasse
  );

  // Qualified: sorted by klasse order, then by totaal within klasse
  const qualified = all
    .filter((r) => !r.isNietGekwalificeerd)
    .sort((a, b) => {
      const ka = klasseRankMap.get(a.klasse) ?? 999;
      const kb = klasseRankMap.get(b.klasse) ?? 999;
      if (ka !== kb) return ka - kb;
      return a.plaatsKlasse - b.plaatsKlasse;
    });

  // Non-qualified: sorted by klasse order (XA, XB, XC…), then by plaatsKlasse within
  const nonQualified = all
    .filter((r) => r.isNietGekwalificeerd)
    .sort((a, b) => {
      const ka = klasseRankMap.get(a.klasse) ?? 999;
      const kb = klasseRankMap.get(b.klasse) ?? 999;
      if (ka !== kb) return ka - kb;
      return a.plaatsKlasse - b.plaatsKlasse;
    });

  // Final display order: all qualified first, then all non-qualified
  const filtered = [...qualified, ...nonQualified];

  // Plaats STA / SEN / DAM = sequential counter per category in display order
  let staCounter = 0;
  let senCounter = 0;
  let damCounter = 0;
  const plaatsStaMap: Record<number, number> = {};
  const plaatsSenMap: Record<number, number> = {};
  const platsDamMap: Record<number, number> = {};
  for (const row of filtered) {
    if (!row.isNietGekwalificeerd) {
      if (row.categorie === "STA") { staCounter++; plaatsStaMap[row.bib] = staCounter; }
      if (row.categorie === "SEN") { senCounter++; plaatsSenMap[row.bib] = senCounter; }
      if (row.categorie === "DAM") { damCounter++; platsDamMap[row.bib] = damCounter; }
    }
  }

  return (
    <>
      {/* Klasse filter buttons */}
      <div style={{ overflowX: "auto", marginBottom: 16, paddingBottom: 4 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "nowrap", minWidth: "max-content" }}>
        {klasses.map((k) => (
          <button
            key={k}
            onClick={() => setFilterKlasse(k)}
            className={filterKlasse === k ? "btn-primary" : "btn-secondary"}
            style={{ padding: "6px 14px", fontSize: 12 }}
          >
            {k === "all" ? "Alle klassen" : k}
          </button>
        ))}
      </div>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table
          className="data-table"
          style={{ fontSize: 12, borderCollapse: "collapse", width: "100%" }}
        >
          <thead>
            <tr>
              <th style={thStyle}>Plaats</th>
              <th style={thStyle}>Nr.</th>
              <th style={{ ...thStyle, textAlign: "left", minWidth: 140 }}>Naam</th>
              <th style={thStyle}>Klasse</th>
              <th style={{ ...thStyle, lineHeight: 1.3 }}>Plaats<br />klasse</th>
              <th style={thStyle}>Cat.</th>
              <th style={{ ...thStyle, lineHeight: 1.3 }}>Plaats<br />STA</th>
              <th style={{ ...thStyle, lineHeight: 1.3 }}>Plaats<br />SEN</th>
              <th style={{ ...thStyle, lineHeight: 1.3 }}>Plaats<br />DAM</th>
              <th style={{ ...thStyle, lineHeight: 1.3, background: "rgba(var(--accent-rgb,99,102,241),0.08)" }}>
                Aantal voor<br />verlof
              </th>
              <th style={{ ...thStyle, lineHeight: 1.3, background: "rgba(var(--accent-rgb,99,102,241),0.08)" }}>
                Aantal na<br />verlof
              </th>
              <th style={{ ...thStyle, color: "var(--accent)", fontWeight: 800, minWidth: 56 }}>
                Totaal
              </th>
              {sortedRaces.map((race) => (
                <th key={race.id} style={{ ...thStyle, opacity: 0.65, minWidth: 38 }}>
                  {race.name}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filtered.map((row, idx) => {
              const isX = row.isNietGekwalificeerd;
              const plaats = idx + 1; // sequential 1,2,3… across the full list

              // Section header: new klasse group OR transition from qualified → non-qualified
              const prev = filtered[idx - 1];
              const isFirstNonQualified = isX && (!prev || !prev.isNietGekwalificeerd);
              const isNewKlasseInNonQ = isX && prev?.isNietGekwalificeerd && prev.klasse !== row.klasse;
              const showKlasseHeader = isFirstNonQualified || isNewKlasseInNonQ
                || (!isX && (idx === 0 || filtered[idx - 1].klasse !== row.klasse));

              const aantalVoor = countStarts(row.weekPoints, firstPeriodRaceNames);
              const aantalNa   = countStarts(row.weekPoints, secondPeriodRaceNames);

              const headerLabel = isX ? `X${row.klasse}` : `Klasse ${row.klasse}`;
              const showXSectionHeader = isFirstNonQualified; // one "Niet gekwalificeerd" banner

              return (
                <Fragment key={row.bib}>
                  {/* Separator + header between qualified and non-qualified blocks */}
                  {isFirstNonQualified && (
                    <tr>
                      <td
                        colSpan={12 + sortedRaces.length}
                        style={{
                          background: "var(--border)",
                          fontWeight: 800,
                          fontSize: 11,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          padding: "5px 10px",
                          color: "var(--text-muted)",
                          borderTop: "3px solid var(--accent)",
                        }}
                      >
                        Niet gekwalificeerd
                      </td>
                    </tr>
                  )}

                  {/* Klasse group header within qualified block, or X-klasse header in non-qualified block */}
                  {showKlasseHeader && !isFirstNonQualified && (
                    <tr>
                      <td
                        colSpan={12 + sortedRaces.length}
                        style={{
                          background: "var(--border)",
                          fontWeight: 800,
                          fontSize: 11,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          padding: "5px 10px",
                          color: "var(--text-muted)",
                        }}
                      >
                        {headerLabel}
                      </td>
                    </tr>
                  )}

                  <tr style={{ opacity: isX ? 0.55 : 1 }}>
                    {/* Plaats — sequential 1,2,3… */}
                    <td style={{ ...tdCenter, fontWeight: 700 }}>{plaats}</td>

                    {/* Nr. */}
                    <td style={{ ...tdCenter, color: "var(--text-muted)", fontWeight: 700 }}>
                      {row.bib}
                    </td>

                    {/* Naam */}
                    <td style={{ ...tdBase, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {row.naam}
                    </td>

                    {/* Klasse — show XA/XB for non-qualified */}
                    <td style={{ ...tdCenter, fontWeight: 700, fontSize: 11 }}>
                      {isX ? `X${row.klasse}` : row.klasse}
                    </td>

                    {/* Plaats klasse — hide for non-qualified */}
                    <td style={tdCenter}>
                      {isX ? "—" : row.plaatsKlasse}
                    </td>

                    {/* Cat. */}
                    <td style={{ ...tdCenter, fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>
                      {row.categorie}
                    </td>

                    {/* Plaats STA */}
                    <td style={tdCenter}>
                      {!isX && row.categorie === "STA" ? (plaatsStaMap[row.bib] ?? "—") : ""}
                    </td>

                    {/* Plaats SEN */}
                    <td style={tdCenter}>
                      {!isX && row.categorie === "SEN" ? (plaatsSenMap[row.bib] ?? "—") : ""}
                    </td>

                    {/* Plaats DAM */}
                    <td style={tdCenter}>
                      {!isX && row.categorie === "DAM" ? (platsDamMap[row.bib] ?? "—") : ""}
                    </td>

                    {/* Aantal voor verlof */}
                    <td style={{ ...tdCenter, background: "rgba(var(--accent-rgb,99,102,241),0.06)" }}>
                      {isX ? "—" : aantalVoor}
                    </td>

                    {/* Aantal na verlof */}
                    <td style={{ ...tdCenter, background: "rgba(var(--accent-rgb,99,102,241),0.06)" }}>
                      {isX
                        ? "—"
                        : data.config.isSecondPeriodStarted
                        ? aantalNa
                        : "—"}
                    </td>

                    {/* Totaal */}
                    <td style={{ ...tdCenter, fontWeight: 800, color: isX ? "var(--text-muted)" : "var(--accent)" }}>
                      {isX ? "—" : row.totaal}
                    </td>

                    {/* Per-race points */}
                    {sortedRaces.map((race) => {
                      const pts = row.weekPoints[race.name];
                      const hasEntry = pts !== undefined;
                      const isDns = hasEntry && pts === MAX_PTS;
                      return (
                        <td
                          key={race.id}
                          style={{
                            ...tdCenter,
                            opacity: isX ? 0.3 : hasEntry ? (isDns ? 0.4 : 1) : 0.2,
                          }}
                        >
                          {isX ? "—" : hasEntry ? pts : "—"}
                        </td>
                      );
                    })}
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

const tdBase: React.CSSProperties = {
  padding: "6px 8px",
  verticalAlign: "middle",
};

const tdCenter: React.CSSProperties = {
  ...tdBase,
  textAlign: "center",
};

const thStyle: React.CSSProperties = {
  padding: "8px 8px",
  textAlign: "center",
  fontWeight: 700,
  fontSize: 11,
  whiteSpace: "nowrap",
  verticalAlign: "bottom",
};