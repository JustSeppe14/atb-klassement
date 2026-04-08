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

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  marginTop: 4,
};

const fieldGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
  marginBottom: 20,
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
          currentWeek:           configData.currentWeek           ?? DEFAULT_CONFIG.currentWeek,
          isSecondPeriodStarted: configData.isSecondPeriodStarted ?? false,
          secondPeriodStartWeek: configData.secondPeriodStartWeek ?? 12,
          seasonEnded:           configData.seasonEnded           ?? false,
        });
        setScoring({
          maxPoints:         configData.maxPoints         ?? DEFAULT_SCORING_CONFIG.maxPoints,
          capFinishPosition: configData.capFinishPosition ?? DEFAULT_SCORING_CONFIG.capFinishPosition,
          bestPct:           configData.bestPct           ?? DEFAULT_SCORING_CONFIG.bestPct,
          regAbsentPoints:     configData.regAbsentPoints     ?? DEFAULT_SCORING_CONFIG.regAbsentPoints,
          regCapFinish:        configData.regCapFinish        ?? DEFAULT_SCORING_CONFIG.regCapFinish,
          maxWeeks:            configData.maxWeeks            ?? DEFAULT_SCORING_CONFIG.maxWeeks,
          klasseSwitchPoints:  configData.klasseSwitchPoints  ?? DEFAULT_SCORING_CONFIG.klasseSwitchPoints,
          teamStaSlots:      configData.teamStaSlots      ?? DEFAULT_SCORING_CONFIG.teamStaSlots,
          teamMixedSlots:    configData.teamMixedSlots    ?? DEFAULT_SCORING_CONFIG.teamMixedSlots,
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
    if (
      !confirm(
        `Verwijder "${race.name}"? Bestaande uitslagen voor deze wedstrijd blijven bewaard.`
      )
    )
      return;
    const res = await fetch("/api/races", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: race.id }),
    });
    if (res.ok) {
      setRaces((prev) => prev.filter((r) => r.id !== race.id));
      setToast({ message: `"${race.name}" verwijderd`, type: "success" });
    } else {
      setToast({ message: "Fout bij verwijderen", type: "error" });
    }
  };

  // Scoring helpers
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

  const toggle = (field: keyof SeasonConfig) =>
    setConfig((c) => ({ ...c, [field]: !c[field] }));

  if (loading)
    return (
      <div style={{ color: "var(--text-muted)", padding: 40, fontFamily: "'Barlow Condensed', sans-serif" }}>
        Laden...
      </div>
    );

  return (
    <div style={{ maxWidth: 540 }}>
      <h1 style={{ fontSize: 32, marginBottom: 6 }}>Instellingen</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 32, fontSize: 14 }}>
        Seizoensconfiguratie, puntensysteem en wedstrijden.
      </p>

      {/* ── Seizoensstatus ── */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={sectionTitle}>Seizoensstatus</div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Huidige wedstrijd</label>
          <select
            className="input"
            style={{ width: "100%" }}
            value={config.currentWeek}
            onChange={(e) => setConfig((c) => ({ ...c, currentWeek: parseInt(e.target.value) }))}
          >
            {races.map((r) => (
              <option key={r.id} value={r.sort_order}>{r.name}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <div
              onClick={() => toggle("isSecondPeriodStarted")}
              style={{ width: 44, height: 24, borderRadius: 12, background: config.isSecondPeriodStarted ? "var(--accent)" : "var(--border)", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}
            >
              <div style={{ position: "absolute", top: 3, left: config.isSecondPeriodStarted ? 23 : 3, width: 18, height: 18, borderRadius: 9, background: "#fff", transition: "left 0.2s" }} />
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>2e periode gestart</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Activeert aparte periodekolommen in het klassement</div>
            </div>
          </label>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Start 2e periode (wedstrijd)</label>
          <select
            className="input"
            style={{ width: "100%" }}
            value={config.secondPeriodStartWeek}
            onChange={(e) => setConfig((c) => ({ ...c, secondPeriodStartWeek: parseInt(e.target.value) }))}
          >
            {races.map((r) => (
              <option key={r.id} value={r.sort_order}>{r.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <div
              onClick={() => toggle("seasonEnded")}
              style={{ width: 44, height: 24, borderRadius: 12, background: config.seasonEnded ? "var(--red)" : "var(--border)", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}
            >
              <div style={{ position: "absolute", top: 3, left: config.seasonEnded ? 23 : 3, width: 18, height: 18, borderRadius: 9, background: "#fff", transition: "left 0.2s" }} />
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>Seizoen beëindigd</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Activeert podiumweergave en eindeseizoen rapporten</div>
            </div>
          </label>
        </div>
      </div>

      {/* ── Klassement puntensysteem ── */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={sectionTitle}>Klassement — punten</div>

        <div style={fieldGrid}>
          <div>
            <label style={labelStyle}>Niet-gereden punten</label>
            <input
              type="number"
              className="input"
              style={{ width: "100%" }}
              min={1}
              value={scoring.maxPoints}
              onChange={(e) => setNum("maxPoints", e.target.value)}
            />
            <div style={hintStyle}>Punten als rijder niet start</div>
          </div>
          <div>
            <label style={labelStyle}>Cap eindplaats</label>
            <input
              type="number"
              className="input"
              style={{ width: "100%" }}
              min={1}
              value={scoring.capFinishPosition}
              onChange={(e) => setNum("capFinishPosition", e.target.value)}
            />
            <div style={hintStyle}>Rank boven deze waarde wordt afgetopt</div>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Beste % ritten meegeteld</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="number"
              className="input"
              style={{ width: 90 }}
              min={1}
              max={100}
              value={scoring.bestPct}
              onChange={(e) => setNum("bestPct", e.target.value)}
            />
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>%</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              → beste {scoring.bestPct}% van alle ritten telt mee
            </span>
          </div>
        </div>
      </div>

      {/* ── Regelmatigheid ── */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={sectionTitle}>Regelmatigheid — punten</div>

        <div style={fieldGrid}>
          <div>
            <label style={labelStyle}>Afwezige punten</label>
            <input
              type="number"
              className="input"
              style={{ width: "100%" }}
              min={1}
              value={scoring.regAbsentPoints}
              onChange={(e) => setNum("regAbsentPoints", e.target.value)}
            />
            <div style={hintStyle}>Punten voor een niet-gereden rit</div>
          </div>
          <div>
            <label style={labelStyle}>Cap eindplaats</label>
            <input
              type="number"
              className="input"
              style={{ width: "100%" }}
              min={1}
              value={scoring.regCapFinish}
              onChange={(e) => setNum("regCapFinish", e.target.value)}
            />
            <div style={hintStyle}>Max punten voor een gefinisht resultaat</div>
          </div>

          <div>
            <label style={labelStyle}>Klassewisselpunten</label>
            <input
              type="number"
              className="input"
              style={{ width: "100%" }}
              min={1}
              value={scoring.klasseSwitchPoints}
              onChange={(e) => setNum("klasseSwitchPoints", e.target.value)}
            />
            <div style={hintStyle}>Vaste punten voor ritten gereden in de oude klasse na een klassewissel</div>
          </div>
        </div>
      </div>

      {/* ── Teams ── */}
      {(["STA", "MIXED"] as const).map((mode) => {
        const slots = mode === "STA" ? scoring.teamStaSlots : scoring.teamMixedSlots;
        const total = slots.reduce((s, sl) => s + sl.count, 0);
        return (
          <div key={mode} className="card" style={{ padding: 24, marginBottom: 20 }}>
            <div style={sectionTitle}>
              Team {mode === "STA" ? "STA" : "Mixed"}{" "}
              <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({total} rijders)</span>
            </div>

            {slots.map((slot, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <select
                  className="input"
                  style={{ flex: 1 }}
                  value={slot.cat ?? "ANY"}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateSlot(mode, idx, { cat: val === "ANY" ? null : val as TeamSlot["cat"] });
                  }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c === "ANY" ? "Alle categorieën" : c}</option>
                  ))}
                </select>
                <input
                  type="number"
                  className="input"
                  style={{ width: 70 }}
                  min={1}
                  max={20}
                  value={slot.count}
                  onChange={(e) => updateSlot(mode, idx, { count: parseInt(e.target.value) || 1 })}
                />
                <span style={{ fontSize: 13, color: "var(--text-muted)", whiteSpace: "nowrap" }}>rijders</span>
                <button
                  onClick={() => removeSlot(mode, idx)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, borderRadius: 4, transition: "color 0.15s", flexShrink: 0 }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--red)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            <button
              onClick={() => addSlot(mode)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px dashed var(--border)", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13, color: "var(--text-muted)", width: "100%", justifyContent: "center", marginTop: 4 }}
            >
              <Plus size={13} />
              Slot toevoegen
            </button>
          </div>
        );
      })}

      {/* ── Seizoensstructuur ── */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={sectionTitle}>Seizoensstructuur</div>
        <div>
          <label style={labelStyle}>Max aantal wedstrijden per seizoen</label>
          <input
            type="number"
            className="input"
            style={{ width: 120 }}
            min={1}
            max={52}
            value={scoring.maxWeeks}
            onChange={(e) => setNum("maxWeeks", e.target.value)}
          />
        </div>
      </div>

      {/* ── Save button ── */}
      <button
        className="btn-primary"
        onClick={handleSave}
        disabled={saving}
        style={{ width: "100%", padding: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 32 }}
      >
        <Save size={16} />
        {saving ? "Opslaan..." : "Instellingen opslaan"}
      </button>

      {/* ── Wedstrijden ── */}
      <div className="card" style={{ padding: 24 }}>
        <div style={sectionTitle}>
          Wedstrijden{" "}
          <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({races.length})</span>
        </div>

        <div style={{ marginBottom: 16 }}>
          {races.length === 0 && (
            <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0" }}>
              Nog geen wedstrijden toegevoegd.
            </div>
          )}
          {races.map((race, idx) => (
            <div
              key={race.id}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 0", borderBottom: idx < races.length - 1 ? "1px solid var(--border)" : "none" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, color: "var(--text-muted)", minWidth: 20 }}>
                  {idx + 1}.
                </span>
                <span style={{ fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {race.name}
                </span>
              </div>
              <input
                type="date"
                className="input"
                style={{ width: 150, fontSize: 12, padding: "4px 8px" }}
                value={race.date ?? ""}
                onChange={(e) => handleUpdateDate(race, e.target.value)}
              />
              <button
                onClick={() => handleDeleteRace(race)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, borderRadius: 4, transition: "color 0.15s", flexShrink: 0 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--red)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="Naam (bv. Balen)"
            value={newRaceName}
            onChange={(e) => setNewRaceName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddRace()}
          />
          <input
            type="date"
            className="input"
            style={{ width: 150, fontSize: 12 }}
            value={newRaceDate}
            onChange={(e) => setNewRaceDate(e.target.value)}
          />
          <button
            className="btn-primary"
            onClick={handleAddRace}
            disabled={addingRace || !newRaceName.trim()}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 16px" }}
          >
            <Plus size={14} />
            {addingRace ? "..." : "Toevoegen"}
          </button>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}