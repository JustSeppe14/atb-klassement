"use client";
import { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { KlassementRow, Race } from "@/lib/utils";
import KlassementTab from "./components/KlassementTab";
import RegelmatigheidTab from "./components/RegelmatigheidTab";
import TeamTab from "./components/TeamTab";
import DamesKlassementTab from "./components/DamKlassementTab";

// Define the shape of our API response
export interface DashboardData {
  klassement: KlassementRow[];
  regelmatigheid: { 
    bib: number; 
    naam: string; 
    klasse: string; 
    aantalDeelnames: number; 
    punten: number 
  }[];
  teamSTA: { team: string; punten: number; riders: string[] }[];
  teamMixed: { team: string; punten: number; riders: string[] }[];
  config: { currentWeek: number; isSecondPeriodStarted: boolean };
  races: Race[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"klassement" | "dames" | "regelmatigheid" | "team">("klassement");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/klassement");
      const json: DashboardData = await res.json();
      setData(json);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const currentYear = new Date().getFullYear();

  useEffect(() => { fetchData(); }, [fetchData]);

  const currentRaceLabel = (() => {
    if (!data?.config.currentWeek || !data?.races) return "Laden...";
    const raceIndex = data.races.findIndex((r) => r.sort_order === data.config.currentWeek);
    if (raceIndex === -1) return "Laden...";
    const race = data.races[raceIndex];
    return `Race ${raceIndex + 1} — ${race.name}`;
  })();

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 32, margin: 0, color: "var(--text)" }}>
            Klassement <span style={{ color: "var(--accent)" }}>{currentYear}</span>
          </h1>
          <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
            {currentRaceLabel}
          </div>
        </div>
        <button className="btn-secondary" onClick={fetchData} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Vernieuwen
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--border)" }}>
        {(["klassement", "dames", "regelmatigheid", "team"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
              fontSize: 14, letterSpacing: "0.06em", textTransform: "uppercase",
              padding: "10px 16px", color: activeTab === tab ? "var(--accent)" : "var(--text-muted)",
              borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -1, transition: "0.2s all",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: "center", padding: 40 }}>Laden...</div>}

      {!loading && data && (
        <>
          {activeTab === "klassement" && <KlassementTab data={data} />}
          {activeTab === "dames" && <DamesKlassementTab data={data} />}
          {activeTab === "regelmatigheid" && <RegelmatigheidTab data={data.regelmatigheid} />}
          {activeTab === "team" && <TeamTab data={data} />}
        </>
      )}
    </div>
  );
}