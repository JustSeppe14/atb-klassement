"use client";
import { useEffect, useState, useCallback } from "react";
import { KlassementRow, RACE_NAMES, getRaceName } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

interface KlassementData {
  klassement: KlassementRow[];
  config: { currentWeek: number; isSecondPeriodStarted: boolean };
}

function getRankClass(rank: number) {
  if (rank === 1) return "rank-1";
  if (rank === 2) return "rank-2";
  if (rank === 3) return "rank-3";
  return "";
}

export default function DashboardPage() {
  const [data, setData] = useState<KlassementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeKlasse, setActiveKlasse] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"klassement" | "regelmatigheid" | "team">("klassement");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/klassement");
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const klasses = data
    ? ["all", ...Array.from(new Set(data.klassement.map((r) => r.klasse))).sort()]
    : [];

  const filtered =
    data?.klassement.filter((r) => activeKlasse === "all" || r.klasse === activeKlasse) ?? [];

  // Get race names that have data
  const raceWeeks = data
    ? Array.from(
        new Set(
          data.klassement.flatMap((r) => Object.keys(r.weekPoints))
        )
      ).filter((name) => Object.values(RACE_NAMES).includes(name))
    : [];

  const currentWeek = data?.config.currentWeek ?? 0;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 32, margin: 0, color: "var(--text)" }}>
            Klassement <span style={{ color: "var(--accent)" }}>2026</span>
          </h1>
          <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
            {currentWeek > 0 ? `Week ${currentWeek} — ${getRaceName(currentWeek)}` : "Nog geen wedstrijden"}
          </div>
        </div>
        <button className="btn-secondary" onClick={fetchData} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Vernieuwen
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {(["klassement", "regelmatigheid", "team"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
              fontSize: 14, letterSpacing: "0.06em", textTransform: "uppercase",
              padding: "10px 16px", color: activeTab === tab ? "var(--accent)" : "var(--text-muted)",
              borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -1, transition: "color 0.15s",
            }}
          >
            {tab === "klassement" ? "Klassement" : tab === "regelmatigheid" ? "Regelmatigheid" : "Teams"}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ color: "var(--text-muted)", padding: 40, textAlign: "center", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16 }}>
          Laden...
        </div>
      )}

      {!loading && data && activeTab === "klassement" && (
        <>
          {/* Klasse filter tabs */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {klasses.map((k) => (
              <button
                key={k}
                onClick={() => setActiveKlasse(k)}
                className={activeKlasse === k ? "btn-primary" : "btn-secondary"}
                style={{ padding: "6px 14px", fontSize: 12 }}
              >
                {k === "all" ? "Alle klassen" : k}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="card" style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nr.</th>
                  <th>Naam</th>
                  <th>Klasse</th>
                  <th>Cat.</th>
                  {data.config.isSecondPeriodStarted && <th>1e Per.</th>}
                  {data.config.isSecondPeriodStarted && <th>2e Per.</th>}
                  <th>Totaal</th>
                  {raceWeeks.map((race) => (
                    <th key={race} style={{ color: "var(--accent)", opacity: 0.8 }}>{race}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.bib} className={row.categorie === "DAM" ? "row-dam" : ""}>
                    <td className={getRankClass(row.plaatsKlasse)}>
                      {row.plaatsKlasse === 1 ? "🥇" : row.plaatsKlasse === 2 ? "🥈" : row.plaatsKlasse === 3 ? "🥉" : row.plaatsKlasse}
                    </td>
                    <td style={{ color: "var(--text-muted)" }}>{row.bib}</td>
                    <td style={{ fontWeight: 600 }}>{row.naam}</td>
                    <td>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, color: "var(--accent)" }}>
                        {row.klasse}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${row.categorie.toLowerCase()}`}>{row.categorie}</span>
                    </td>
                    {data.config.isSecondPeriodStarted && (
                      <td style={{ color: "var(--text-muted)" }}>{row.eerstePeriode}</td>
                    )}
                    {data.config.isSecondPeriodStarted && (
                      <td style={{ color: "var(--text-muted)" }}>{row.tweedePeriode}</td>
                    )}
                    <td style={{ fontWeight: 700, color: "var(--accent)" }}>{row.totaal}</td>
                    {raceWeeks.map((race) => {
                      const pts = row.weekPoints[race];
                      return (
                        <td key={race} style={{
                          color: pts === undefined ? "var(--text-muted)" :
                            pts <= 3 ? "var(--green)" :
                            pts >= 80 ? "var(--red)" : "var(--text)",
                        }}>
                          {pts ?? "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={20} style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>
                    Geen data. Upload eerst een uitslag.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && data && activeTab === "regelmatigheid" && (
        <RegelmatigheidTab data={(data as unknown as { regelmatigheid: { bib: number; naam: string; klasse: string; aantalDeelnames: number; punten: number }[] }).regelmatigheid} />
      )}

      {!loading && data && activeTab === "team" && (
        <TeamTab data={data as unknown as { teamSTA: { team: string; punten: number; riders: string[] }[]; teamDAM: { team: string; punten: number; riders: string[] }[] }} />
      )}
    </div>
  );
}

function RegelmatigheidTab({ data }: { data: { bib: number; naam: string; klasse: string; aantalDeelnames: number; punten: number }[] }) {
  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Nr.</th>
            <th>Naam</th>
            <th>Klasse</th>
            <th>Deelnames</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((row, i) => (
            <tr key={row.bib}>
              <td className={getRankClass(i + 1)}>{i + 1}</td>
              <td style={{ color: "var(--text-muted)" }}>{row.bib}</td>
              <td style={{ fontWeight: 600 }}>{row.naam}</td>
              <td style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, color: "var(--accent)" }}>{row.klasse}</td>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: Math.min(row.aantalDeelnames * 10, 120), height: 6, background: "var(--accent)", borderRadius: 3, opacity: 0.7 }} />
                  <span style={{ fontWeight: 700 }}>{row.aantalDeelnames}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TeamTab({ data }: { data: { teamSTA: { team: string; punten: number; riders: string[] }[]; teamDAM: { team: string; punten: number; riders: string[] }[] } }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      {[{ label: "STA Teams", rows: data?.teamSTA, color: "var(--blue)" }, { label: "DAM Teams", rows: data?.teamDAM, color: "var(--dam-pink)" }].map(({ label, rows, color }) => (
        <div key={label} className="card">
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, color }}>
            {label}
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Team</th>
                <th>Punten</th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((row, i) => (
                <tr key={row.team}>
                  <td className={getRankClass(i + 1)}>{i + 1}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{row.team}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{row.riders.slice(0, 3).join(", ")}{row.riders.length > 3 ? ` +${row.riders.length - 3}` : ""}</div>
                  </td>
                  <td style={{ fontWeight: 700, color }}>{row.punten}</td>
                </tr>
              ))}
              {(!rows || rows.length === 0) && (
                <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--text-muted)", padding: 24 }}>Geen team data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
