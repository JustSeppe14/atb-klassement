"use client";
import { useState, useEffect } from "react";
import { Save, Plus, Trash2 } from "lucide-react";
import Toast from "@/components/Toast";
import { SeasonConfig, DEFAULT_CONFIG, Race } from "@/lib/utils";
import { ScoringConfig, DEFAULT_SCORING_CONFIG, TeamSlot } from "@/lib/scoring-config";

const CATEGORIES = ["ANY", "STA", "SEN", "DAM", "VET"] as const;

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  marginBottom: 8,
};

const sectionTitle: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 800,
  fontSize: 16,
  marginBottom: 20,
  color: "var(--accent)",
};

const groupHeaderStyle: React.CSSProperties = {
  fontSize: 20,
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 20,
  paddingBottom: 8,
  borderBottom: "1px solid var(--border)",
  color: "var(--text-main)",
};

const fieldGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
  marginBottom: 20,
};

const sideBySideGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
  gap: 24,
  alignItems: "stretch", // Ensures children (cards) take full height
};

const cardFlexStyle: React.CSSProperties = {
  padding: 24,
  display: "flex",
  flexDirection: "column",
  height: "100%", // Ensures card fills grid cell
};

export default function InstellingenPage() {
  const [config, setConfig] = useState<SeasonConfig>(DEFAULT_CONFIG);
  const [scoring, setScoring] = useState<ScoringConfig>(DEFAULT_SCORING_CONFIG);
  const [races, setRaces] = useState<Race[]>([]);
  const [newRaceName, setNewRaceName] = useState("");
  const [newRaceDate, setNewRaceDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingRace, setAddingRace] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/config").then((r) => r.json()),
      fetch("/api/races").then((r) => r.json()),
    ]).then(([configData, racesData]) => {
      if (configData && !configData.error) {
        setConfig({
          currentWeek: configData.currentWeek ?? DEFAULT_CONFIG.currentWeek,
          isSecondPeriodStarted: configData.isSecondPeriodStarted ?? false,
          secondPeriodStartWeek: configData.secondPeriodStartWeek ?? 12,
          seasonEnded: configData.seasonEnded ?? false,
        });
        setScoring({
          maxPoints: configData.maxPoints ?? DEFAULT_SCORING_CONFIG.maxPoints,
          capFinishPosition: configData.capFinishPosition ?? DEFAULT_SCORING_CONFIG.capFinishPosition,
          bestPct: configData.bestPct ?? DEFAULT_SCORING_CONFIG.bestPct,
          regAbsentPoints: configData.regAbsentPoints ?? DEFAULT_SCORING_CONFIG.regAbsentPoints,
          regCapFinish: configData.regCapFinish ?? DEFAULT_SCORING_CONFIG.regCapFinish,
          maxWeeks: configData.maxWeeks ?? DEFAULT_SCORING_CONFIG.maxWeeks,
          klasseSwitchPoints: configData.klasseSwitchPoints ?? DEFAULT_SCORING_CONFIG.klasseSwitchPoints,
          teamStaSlots: configData.teamStaSlots ?? DEFAULT_SCORING_CONFIG.teamStaSlots,
          teamMixedSlots: configData.teamMixedSlots ?? DEFAULT_SCORING_CONFIG.teamMixedSlots,
        });
      }
      setRaces(racesData ?? []);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...config, ...scoring }),
    });
    setToast(
      res.ok
        ? { message: "✓ Instellingen opgeslagen", type: "success" }
        : { message: "Fout bij opslaan", type: "error" }
    );
    setSaving(false);
  };

  const handleAddRace = async () => {
    const name = newRaceName.trim();
    if (!name) return;
    setAddingRace(true);
    const res = await fetch("/api/races", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, date: newRaceDate || null }),
    });
    const json = await res.json();
    if (res.ok) {
      setRaces((prev) =>
        [...prev, json].sort((a, b) => {
          if (a.date && b.date) return a.date.localeCompare(b.date);
          if (a.date) return -1;
          if (b.date) return 1;
          return a.sort_order - b.sort_order;
        })
      );
      setNewRaceName("");
      setNewRaceDate("");
      setToast({ message: `✓ "${json.name}" toegevoegd`, type: "success" });
    } else {
      setToast({ message: json.error ?? "Fout bij toevoegen", type: "error" });
    }
    setAddingRace(false);
  };

  const handleUpdateDate = async (race: Race, date: string) => {
    const res = await fetch("/api/races", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: race.id, date: date || null }),
    });
    const json = await res.json();
    if (res.ok) {
      setRaces((prev) =>
        prev
          .map((r) => (r.id === race.id ? { ...r, date: json.date } : r))
          .sort((a, b) => {
            if (a.date && b.date) return a.date.localeCompare(b.date);
            if (a.date) return -1;
            if (b.date) return 1;
            return a.sort_order - b.sort_order;
          })
      );
    }
  };

  const handleDeleteRace = async (race: Race) => {
    if (!confirm(`Verwijder "${race.name}"?`)) return;
    const res = await fetch("/api/races", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: race.id }),
    });
    if (res.ok) {
      setRaces((prev) => prev.filter((r) => r.id !== race.id));
      setToast({ message: `"${race.name}" verwijderd`, type: "success" });
    }
  };

  const setNum = (key: keyof ScoringConfig, raw: string) => {
    const val = parseInt(raw);
    if (!isNaN(val) && val > 0) setScoring((s) => ({ ...s, [key]: val }));
  };

  const updateSlot = (mode: "STA" | "MIXED", idx: number, patch: Partial<TeamSlot>) => {
    const key = mode === "STA" ? "teamStaSlots" : "teamMixedSlots";
    setScoring((s) => ({
      ...s,
      [key]: s[key].map((sl, i) => (i === idx ? { ...sl, ...patch } : sl)),
    }));
  };

  const addSlot = (mode: "STA" | "MIXED") => {
    const key = mode === "STA" ? "teamStaSlots" : "teamMixedSlots";
    setScoring((s) => ({ ...s, [key]: [...s[key], { cat: "STA" as const, count: 1 }] }));
  };

  const removeSlot = (mode: "STA" | "MIXED", idx: number) => {
    const key = mode === "STA" ? "teamStaSlots" : "teamMixedSlots";
    setScoring((s) => ({ ...s, [key]: s[key].filter((_, i) => i !== idx) }));
  };

  const toggle = (field: keyof SeasonConfig) => setConfig((c) => ({ ...c, [field]: !c[field] }));

  if (loading) {
  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column",
      alignItems: "center", 
      justifyContent: "center", 
      minHeight: "80vh", // Centers vertically within most of the viewport
      gap: 16 
    }}>
      <div className="spinner" />
      <div style={{ 
        color: "var(--text-muted)", 
        fontFamily: "'Barlow Condensed', sans-serif",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        fontSize: 14,
        fontWeight: 600
      }}>
        Laden...
      </div>
    </div>
  );
}

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px 120px 20px" }}>
      <header style={{ marginBottom: 40, marginTop: 20 }}>
        <h1 style={{ fontSize: 32, marginBottom: 6 }}>Instellingen</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Seizoensconfiguratie en puntensysteem beheer.</p>
      </header>

      {/* ── SECTIE 1: STATUS & KALENDER ── */}
      <section style={{ marginBottom: 60 }}>
        <h2 style={groupHeaderStyle}>Seizoen & Kalender</h2>
        <div style={sideBySideGrid}>
          <div className="card" style={cardFlexStyle}>
            <div style={sectionTitle}>Huidige Status</div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Actieve Wedstrijd</label>
              <select className="input" style={{ width: "100%" }} value={config.currentWeek} onChange={(e) => setConfig((c) => ({ ...c, currentWeek: parseInt(e.target.value) }))}>
                {races.map((r) => (<option key={r.id} value={r.sort_order}>{r.name}</option>))}
              </select>
            </div>
            <div style={{ display: "grid", gap: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                <div onClick={() => toggle("isSecondPeriodStarted")} style={{ width: 44, height: 24, borderRadius: 12, background: config.isSecondPeriodStarted ? "var(--accent)" : "var(--border)", position: "relative", transition: "0.2s" }}>
                  <div style={{ position: "absolute", top: 3, left: config.isSecondPeriodStarted ? 23 : 3, width: 18, height: 18, borderRadius: 9, background: "#fff", transition: "0.2s" }} />
                </div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>2e periode geactiveerd</div>
              </label>
              <div style={{ paddingLeft: 56 }}>
                <label style={labelStyle}>Startpunt 2e periode</label>
                <select className="input" style={{ width: "100%" }} disabled={!config.isSecondPeriodStarted} value={config.secondPeriodStartWeek} onChange={(e) => setConfig((c) => ({ ...c, secondPeriodStartWeek: parseInt(e.target.value) }))}>
                  {races.map((r) => (<option key={r.id} value={r.sort_order}>{r.name}</option>))}
                </select>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                <div onClick={() => toggle("seasonEnded")} style={{ width: 44, height: 24, borderRadius: 12, background: config.seasonEnded ? "var(--red)" : "var(--border)", position: "relative", transition: "0.2s" }}>
                  <div style={{ position: "absolute", top: 3, left: config.seasonEnded ? 23 : 3, width: 18, height: 18, borderRadius: 9, background: "#fff", transition: "0.2s" }} />
                </div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Seizoen Afgesloten</div>
              </label>
            </div>
          </div>

          <div className="card" style={cardFlexStyle}>
            <div style={sectionTitle}>Wedstrijdkalender ({races.length})</div>
            <div style={{ flex: 1, marginBottom: 20, maxHeight: 300, overflowY: "auto", paddingRight: 8 }}>
              {races.map((race, idx) => (
                <div key={race.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, color: "var(--text-muted)", width: 20 }}>{idx + 1}.</span>
                  <span style={{ fontWeight: 600, flex: 1 }}>{race.name}</span>
                  <input type="date" className="input" style={{ width: 130, fontSize: 12, padding: "4px 8px" }} value={race.date ?? ""} onChange={(e) => handleUpdateDate(race, e.target.value)} />
                  <button onClick={() => handleDeleteRace(race)} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="input" style={{ flex: 1 }} placeholder="Nieuwe wedstrijd..." value={newRaceName} onChange={(e) => setNewRaceName(e.target.value)} />
              <button className="btn-primary" onClick={handleAddRace} disabled={addingRace || !newRaceName.trim()} style={{ padding: "0 16px" }}><Plus size={16} /></button>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTIE 2: PUNTENSYSTEEM ── */}
      <section style={{ marginBottom: 60 }}>
        <h2 style={groupHeaderStyle}>Puntensysteem</h2>
        <div style={sideBySideGrid}>
          <div className="card" style={cardFlexStyle}>
            <div style={sectionTitle}>Klassement (Snelheid)</div>
            <div style={fieldGrid}>
              <div>
                <label style={labelStyle}>DNF/DNS Punten</label>
                <input type="number" className="input" style={{ width: "100%" }} value={scoring.maxPoints} onChange={(e) => setNum("maxPoints", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Max Rank Cap</label>
                <input type="number" className="input" style={{ width: "100%" }} value={scoring.capFinishPosition} onChange={(e) => setNum("capFinishPosition", e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: "auto" }}>
              <label style={labelStyle}>Schrapresultaten (%)</label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input type="number" className="input" style={{ width: 80 }} value={scoring.bestPct} onChange={(e) => setNum("bestPct", e.target.value)} />
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>% telt mee voor einduitslag</span>
              </div>
            </div>
          </div>

          <div className="card" style={cardFlexStyle}>
            <div style={sectionTitle}>Regelmatigheid</div>
            <div style={fieldGrid}>
              <div>
                <label style={labelStyle}>Afwezig Punten</label>
                <input type="number" className="input" style={{ width: "100%" }} value={scoring.regAbsentPoints} onChange={(e) => setNum("regAbsentPoints", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Finish Cap</label>
                <input type="number" className="input" style={{ width: "100%" }} value={scoring.regCapFinish} onChange={(e) => setNum("regCapFinish", e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: "auto" }}>
              <label style={labelStyle}>Klassewissel Compensatie</label>
              <input type="number" className="input" style={{ width: "100%" }} value={scoring.klasseSwitchPoints} onChange={(e) => setNum("klasseSwitchPoints", e.target.value)} />
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTIE 3: TEAMS ── */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={groupHeaderStyle}>Team Configuraties</h2>
        <div style={sideBySideGrid}>
          {(["STA", "MIXED"] as const).map((mode) => {
            const slots = mode === "STA" ? scoring.teamStaSlots : scoring.teamMixedSlots;
            return (
              <div key={mode} className="card" style={cardFlexStyle}>
                <div style={sectionTitle}>Team {mode}</div>
                <div style={{ flex: 1 }}>
                  {slots.map((slot, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <select className="input" style={{ flex: 1 }} value={slot.cat ?? "ANY"} onChange={(e) => updateSlot(mode, idx, { cat: e.target.value === "ANY" ? null : e.target.value as TeamSlot["cat"] })}>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c === "ANY" ? "Alle categorieën" : c}</option>)}
                      </select>
                      <input type="number" className="input" style={{ width: 70 }} value={slot.count} onChange={(e) => updateSlot(mode, idx, { count: parseInt(e.target.value) || 1 })} />
                      <button onClick={() => removeSlot(mode, idx)} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
                <button onClick={() => addSlot(mode)} className="btn-secondary" style={{ width: "100%", marginTop: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 8, border: "1px dashed var(--border)", background: "none", color: "var(--text-muted)", borderRadius: 6, cursor: "pointer" }}>
                  <Plus size={14} /> Slot toevoegen
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── STICKY SAVE BAR ── */}
      <div style={{ position: "fixed", bottom: 0, left: "var(--side-bar-width)", right: 0, padding: "24px 0", background: "linear-gradient(transparent, var(--bg) 40%)", display: "flex", justifyContent: "center", zIndex: 100 }}>
        <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ width: "100%", maxWidth: 500, padding: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 -10px 40px rgba(0,0,0,0.2)" }}>
          <Save size={20} />
          {saving ? "Opslaan..." : "Alle wijzigingen opslaan"}
        </button>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}