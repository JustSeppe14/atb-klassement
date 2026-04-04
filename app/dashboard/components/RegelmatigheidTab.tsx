"use client";
import { useState } from "react";
import { DashboardData } from "../page";

type RegEntry = DashboardData["regelmatigheid"][0];

export default function RegelmatigheidTab({ data }: { data: RegEntry[] }) {
  const [filter, setFilter] = useState("all");

  const klasses = ["all", ...Array.from(new Set(data.map((r) => r.klasse))).sort()];

  // Filter and Sort Logic:
  // 1. Primary Sort: Lowest Points (Sum of Ranks) = Position 1
  // 2. Secondary Sort: More Participations = Tie-breaker for equal points
  const sortedData = [...data]
    .filter((r) => filter === "all" || r.klasse === filter)
    .sort((a, b) => {
      if (a.punten !== b.punten) {
        return a.punten - b.punten; // Sequential: 10 points beats 50 points
      }
      return b.aantalDeelnames - a.aantalDeelnames; // More races = better rank if points tied
    });

  return (
    <>
      {/* Category Selection */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {klasses.map((k) => (
          <button 
            key={k} 
            onClick={() => setFilter(k)} 
            className={filter === k ? "btn-primary" : "btn-secondary"} 
            style={{ padding: "8px 16px", fontSize: 12, borderRadius: "6px" }}
          >
            {k === "all" ? "Alle Categorieën" : k}
          </button>
        ))}
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>Pos.</th>
              <th style={{ width: 60 }}>Nr.</th>
              <th>Deelnemer</th>
              <th>Klasse</th>
              <th style={{ textAlign: "center" }}>Gereden</th>
              <th style={{ textAlign: "right", paddingRight: 24, color: "var(--accent)" }}>
                Punten Totaal
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, i) => (
              <tr key={row.bib}>
                <td style={{ fontWeight: 800, color: "var(--text-muted)" }}>
                  {i + 1}.
                </td>
                <td style={{ color: "var(--text-muted)" }}>{row.bib}</td>
                <td style={{ fontWeight: 600 }}>{row.naam}</td>
                <td>
                  <span style={{ 
                    fontFamily: "'Barlow Condensed', sans-serif", 
                    fontWeight: 700, 
                    fontSize: 11, 
                    color: "var(--accent)",
                    textTransform: "uppercase"
                  }}>
                    {row.klasse}
                  </span>
                </td>
                <td style={{ textAlign: "center" }}>
                  <span style={{ 
                    fontSize: 12, 
                    fontWeight: 600, 
                    color: "var(--text-muted)",
                    backgroundColor: "rgba(0,0,0,0.05)",
                    padding: "2px 8px",
                    borderRadius: "4px"
                  }}>
                    {row.aantalDeelnames}x
                  </span>
                </td>
                <td style={{ 
                  textAlign: "right", 
                  fontWeight: 900, 
                  paddingRight: 24, 
                  color: "var(--accent)",
                  fontSize: 16
                }}>
                  {row.punten}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Logic Breakdown Footer */}
      <div style={{ 
        marginTop: 16, 
        padding: "16px", 
        backgroundColor: "rgba(var(--accent-rgb), 0.05)", 
        borderRadius: "8px",
        borderLeft: "4px solid var(--accent)",
        fontSize: 11, 
        color: "var(--text-muted)", 
        lineHeight: "1.6"
      }}>
        <div style={{ fontWeight: 800, color: "var(--text)", marginBottom: 4, textTransform: "uppercase" }}>
          Hoe dit klassement werkt:
        </div>
        1. Punten = Behaalde plaats per wedstrijd (1e = 1pt, 2e = 2pt, etc).<br />
        2. Gefinisht buiten de top 60 = <strong>60 punten</strong>.<br />
        3. Niet deelnemen = <strong>80 punten</strong>.<br />
        4. Het <strong>slechtste resultaat</strong> is reeds uit je totaal verwijderd.<br />
        5. De renner met het <strong>laagste</strong> puntenaantal wint.
      </div>
    </>
  );
}