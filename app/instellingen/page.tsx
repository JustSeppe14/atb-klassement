"use client";
import { useState, useEffect } from "react";
import { Save, Plus, Trash2 } from "lucide-react";
import Toast from "@/components/Toast";
import { SeasonConfig, DEFAULT_CONFIG, Race } from "@/lib/utils";

export default function InstellingenPage() {
  const [config, setConfig] = useState<SeasonConfig>(DEFAULT_CONFIG);
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
      if (configData && !configData.error) setConfig(configData);
      setRaces(racesData ?? []);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setToast(res.ok
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
      setRaces((prev) => [...prev, json].sort((a, b) => {
        if (a.date && b.date) return a.date.localeCompare(b.date);
        if (a.date) return -1;
        if (b.date) return 1;
        return a.sort_order - b.sort_order;
      }));
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
    if (!confirm(`Verwijder "${race.name}"? Bestaande uitslagen voor deze wedstrijd blijven bewaard.`)) return;
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

  if (loading) return <div style={{ color: "var(--text-muted)", padding: 40, fontFamily: "'Barlow Condensed', sans-serif" }}>Laden...</div>;

  return (
    <div style={{ maxWidth: 540 }}>
      <h1 style={{ fontSize: 32, marginBottom: 6 }}>Instellingen</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 32, fontSize: 14 }}>
        Seizoensconfiguratie, periodes en wedstrijden.
      </p>

      {/* Season config */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, marginBottom: 20, color: "var(--accent)" }}>Seizoensstatus</div>

        {/* Current week */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
            Huidige wedstrijd
          </label>
          <select className="input" style={{ width: "100%" }} value={config.currentWeek} onChange={(e) => setConfig((c) => ({ ...c, currentWeek: parseInt(e.target.value) }))}>
            {races.map((r) => (
              <option key={r.id} value={r.sort_order}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Second period toggle */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <div
              onClick={() => setConfig((c) => ({ ...c, isSecondPeriodStarted: !c.isSecondPeriodStarted }))}
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

        {/* Second period start week */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
            Start 2e periode (wedstrijd)
          </label>
          <select className="input" style={{ width: "100%" }} value={config.secondPeriodStartWeek} onChange={(e) => setConfig((c) => ({ ...c, secondPeriodStartWeek: parseInt(e.target.value) }))}>
            {races.map((r) => (
              <option key={r.id} value={r.sort_order}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Season ended */}
        <div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <div
              onClick={() => setConfig((c) => ({ ...c, seasonEnded: !c.seasonEnded }))}
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

      <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ width: "100%", padding: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 32 }}>
        <Save size={16} />
        {saving ? "Opslaan..." : "Instellingen opslaan"}
      </button>

      {/* Race management */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, marginBottom: 20, color: "var(--accent)" }}>
          Wedstrijden <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({races.length})</span>
        </div>

        {/* Race list */}
        <div style={{ marginBottom: 16 }}>
          {races.length === 0 && (
            <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0" }}>Nog geen wedstrijden toegevoegd.</div>
          )}
          {races.map((race, idx) => (
            <div key={race.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 0", borderBottom: idx < races.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, color: "var(--text-muted)", minWidth: 20 }}>
                  {idx + 1}.
                </span>
                <span style={{ fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{race.name}</span>
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

        {/* Add race */}
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