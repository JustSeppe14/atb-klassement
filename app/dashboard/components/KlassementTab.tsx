"use client";
import { useState } from "react";

import { DashboardData } from "../page";

export default function KlassementTab({ data }: { data: DashboardData }) {
  const [filter, setFilter] = useState("all");
  const [selectedWeek, setSelectedWeek] = useState<string>("overview");

  // Alle unieke klasses + filter opties (remove "dames")
  const klasses = ["all", ...Array.from(new Set(data.klassement.map((r) => r.klasse))).sort()];

  // Volgorde van klasses
  const klasseOrder = ["A", "A40+", "B", "B50+", "C", "D", "E"];
  const klasseRankMap = new Map(klasseOrder.map((k, i) => [k, i]));

  // Filter en sorteer rijders
  const filtered = data.klassement
    .filter((r) => {
      if (filter === "all") return true;
      return r.klasse === filter;
    })
    .sort((a, b) => {
      const klasseA = klasseRankMap.get(a.klasse) ?? 999;
      const klasseB = klasseRankMap.get(b.klasse) ?? 999;
      if (klasseA !== klasseB) return klasseA - klasseB;
      return a.plaatsKlasse - b.plaatsKlasse;
    });

  // Alle unieke race weken
  const raceWeeks = Array.from(
    new Set(data.klassement.flatMap((r) => Object.keys(r.weekPoints)))
  );

  const renderWeekColumn = (row: any, week: string) => {
    const pts = row.weekPoints[week];
    return <td key={week} style={{ opacity: pts ? 1 : 0.3 }}>{pts ?? "—"}</td>;
  };

  return (
    <>
      {/* Filters & week select */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        {/* Klasse filter */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {klasses.map((k) => (
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

        {/* Week selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Weergave:</span>
          <select 
            value={selectedWeek} 
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="btn-secondary"
            style={{ padding: "6px 12px", fontSize: 12, borderRadius: 4, cursor: "pointer" }}
          >
            <option value="overview">Overzicht (Alle Weken)</option>
            {raceWeeks.map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Klassement tabel */}
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nr.</th>
              <th>Naam</th>
              <th>Klasse</th>
              {selectedWeek === "overview" && data.config.isSecondPeriodStarted && <th>1e</th>}
              {selectedWeek === "overview" && data.config.isSecondPeriodStarted && <th>2e</th>}
              <th style={{ color: "var(--accent)" }}>Totaal</th>
              {selectedWeek === "overview" ? (
                raceWeeks.map(w => <th key={w} style={{ opacity: 0.6 }}>{w}</th>)
              ) : (
                <th style={{ background: "var(--accent-low)", color: "var(--accent)" }}>Punten: {selectedWeek}</th>
              )}
            </tr>
          </thead>

          <tbody>
            {filtered.map((row) => (
              <tr key={row.bib}>
                {/* Plaats met top 3 emoji */}
                <td>
                  {row.plaatsKlasse === 1 ? "🥇" : row.plaatsKlasse === 2 ? "🥈" : row.plaatsKlasse === 3 ? "🥉" : row.plaatsKlasse}
                </td>
                {/* Nummer in roze als het een dame is */}
                <td style={{ color: row.categorie === "DAM" ? "var(--dam-pink)" : "var(--text-muted)" }}>
                  {row.bib}
                </td>
                <td style={{ fontWeight: 600 }}>{row.naam}</td>
                <td style={{ fontWeight: 700, fontSize: 11, color: "var(--accent)" }}>
                  {row.klasse}
                </td>

                {selectedWeek === "overview" && data.config.isSecondPeriodStarted && <td>{row.eerstePeriode}</td>}
                {selectedWeek === "overview" && data.config.isSecondPeriodStarted && <td>{row.tweedePeriode}</td>}

                <td style={{ fontWeight: 800, color: "var(--accent)" }}>{row.totaal}</td>

                {selectedWeek === "overview" 
                  ? raceWeeks.map((w) => renderWeekColumn(row, w)) 
                  : <td style={{ fontWeight: 700, background: "rgba(var(--accent-rgb), 0.05)" }}>{row.weekPoints[selectedWeek] ?? "Niet gestart"}</td>
                }
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}