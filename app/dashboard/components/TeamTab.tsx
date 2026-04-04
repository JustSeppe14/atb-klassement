"use client";
import { DashboardData } from "../page";

export default function TeamTab({ data }: { data: DashboardData }) {
  
  const renderTeamGroup = (label: string, rows: any[], color: string) => {
    if (!rows) return null;

    // Filter out individuals and sort by total points descending
    const displayRows = rows
      .filter((row) => 
        row.team && 
        row.team.toLowerCase() !== "geen team" && 
        row.team.toLowerCase() !== "individueel"
      )
      .sort((a, b) => b.punten - a.punten);

    return (
      <div className="card">
        <div style={{ 
          padding: "14px 16px", 
          borderBottom: "1px solid var(--border)", 
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 800, 
          fontSize: 16, 
          color 
        }}>
          {label}
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Team</th>
              <th style={{ textAlign: "right" }}>Totaal Punten</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={row.team}>
                <td style={{ fontWeight: 700, opacity: 0.5 }}>{i + 1}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{row.team}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {row.riders.slice(0, 3).join(", ")}
                    {row.riders.length > 3 ? ` +${row.riders.length - 3}` : ""}
                  </div>
                </td>
                <td style={{ textAlign: "right", fontWeight: 700, color }}>
                  {row.punten}
                </td>
              </tr>
            ))}
            {displayRows.length === 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>
                  Geen teams geconfigureerd.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ 
      display: "grid", 
      gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", 
      gap: 20,
      marginTop: 8 
    }}>
      {renderTeamGroup("STA Teams", data.teamSTA, "var(--blue)")}
      {renderTeamGroup("Mixed Teams", data.teamMixed, "var(--orange)")}
    </div>
  );
}