"use client";
import { useState } from "react";
import { DashboardData } from "../page";


export default function DamesKlassementTab({ data }: { data: DashboardData }) {
  const [filter, setFilter] = useState("all");

  const klasseOrder = ["A", "A40+", "B", "B50+", "C", "D", "E"];
  const klasseRankMap = new Map(klasseOrder.map((k, i) => [k, i]));

  // Filter alleen dames
  let dames = data.klassement.filter((r) => r.categorie === "DAM");

  // Klasse filter opties
  const klasseFilters = ["all", ...Array.from(new Set(dames.map((r) => r.klasse))).sort()];

  if (filter !== "all") {
    dames = dames.filter((r) => r.klasse === filter);
  }

  // Groeperen per klasse
  const damesByKlasse: Record<string, typeof dames> = {};
  klasseOrder.forEach((k) => { damesByKlasse[k] = []; });
  dames.forEach((r) => {
    if (!damesByKlasse[r.klasse]) damesByKlasse[r.klasse] = [];
    damesByKlasse[r.klasse].push(r);
  });

  // Sorteer binnen klasse op algemene plaats
  klasseOrder.forEach((k) => {
    damesByKlasse[k].sort((a, b) => a.plaatsKlasse - b.plaatsKlasse);
  });

  const raceWeeks = Array.from(
    new Set(data.klassement.flatMap((r) => Object.keys(r.weekPoints)))
  );

  const renderWeekColumn = (row: any, week: string) => {
    const pts = row.weekPoints[week];
    return <td key={week} style={{ opacity: pts ? 1 : 0.3 }}>{pts ?? "—"}</td>;
  };

  return (
    <>
      {/* Klasse filter */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {klasseFilters.map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={filter === k ? "btn-primary" : "btn-secondary"}
            style={{ padding: "6px 12px", fontSize: 12 }}
          >
            {k === "all" ? "Alle klassen" : k}
          </button>
        ))}
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nr.</th>
              <th>Naam</th>
              <th>Klasse</th>
              {data.config.isSecondPeriodStarted && <th>1e</th>}
              {data.config.isSecondPeriodStarted && <th>2e</th>}
              <th style={{ color: "var(--accent)" }}>Totaal</th>
              {raceWeeks.map(w => <th key={w} style={{ opacity: 0.6 }}>{w}</th>)}
            </tr>
          </thead>
          <tbody>
            {klasseOrder.map((k) => (
              damesByKlasse[k]?.map((row, idx) => (
                <tr key={row.bib}>
                  {/* Podium emoji per damespositie in klasse */}
                  <td>
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>{row.bib}</td>
                  <td style={{ fontWeight: 600, color: "var(--accent-pink)" }}>{row.naam}</td>
                  <td style={{ fontWeight: 700, fontSize: 11, color: "var(--accent-pink)" }}>{row.klasse}</td>
                  {data.config.isSecondPeriodStarted && <td>{row.eerstePeriode}</td>}
                  {data.config.isSecondPeriodStarted && <td>{row.tweedePeriode}</td>}
                  <td style={{ fontWeight: 800, color: "var(--accent)" }}>{row.totaal}</td>
                  {raceWeeks.map((w) => renderWeekColumn(row, w))}
                </tr>
              ))
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}