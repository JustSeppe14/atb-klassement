"use client";
import { useState, useEffect } from "react";
import { Save } from "lucide-react";
import Toast from "@/components/Toast";
import { SeasonConfig, DEFAULT_CONFIG, RACE_NAMES } from "@/lib/utils";

export default function InstellingenPage() {
  const [config, setConfig] = useState<SeasonConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then((data) => {
      if (data && !data.error) setConfig(data);
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
    if (res.ok) {
      setToast({ message: "✓ Instellingen opgeslagen", type: "success" });
    } else {
      setToast({ message: "Fout bij opslaan", type: "error" });
    }
    setSaving(false);
  };

  if (loading) return <div style={{ color: "var(--text-muted)", padding: 40, fontFamily: "'Barlow Condensed', sans-serif" }}>Laden...</div>;

  return (
    <div style={{ maxWidth: 540 }}>
      <h1 style={{ fontSize: 32, marginBottom: 6 }}>Instellingen</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 32, fontSize: 14 }}>
        Seizoensconfiguratie en periodes.
      </p>

      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, marginBottom: 20, color: "var(--accent)" }}>Seizoensstatus</div>

        {/* Current week */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
            Huidige week
          </label>
          <select className="input" style={{ width: "100%" }} value={config.currentWeek} onChange={(e) => setConfig((c) => ({ ...c, currentWeek: parseInt(e.target.value) }))}>
            {Object.entries(RACE_NAMES).map(([num, name]) => (
              <option key={num} value={num}>Week {num} — {name}</option>
            ))}
          </select>
        </div>

        {/* Second period */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <div
              onClick={() => setConfig((c) => ({ ...c, isSecondPeriodStarted: !c.isSecondPeriodStarted }))}
              style={{
                width: 44, height: 24, borderRadius: 12, background: config.isSecondPeriodStarted ? "var(--accent)" : "var(--border)",
                position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
              }}
            >
              <div style={{
                position: "absolute", top: 3, left: config.isSecondPeriodStarted ? 23 : 3,
                width: 18, height: 18, borderRadius: 9, background: "#fff",
                transition: "left 0.2s",
              }} />
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
            Start 2e periode (week)
          </label>
          <select className="input" style={{ width: "100%" }} value={config.secondPeriodStartWeek} onChange={(e) => setConfig((c) => ({ ...c, secondPeriodStartWeek: parseInt(e.target.value) }))}>
            {Object.entries(RACE_NAMES).map(([num, name]) => (
              <option key={num} value={num}>Week {num} — {name}</option>
            ))}
          </select>
        </div>

        {/* Season ended */}
        <div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <div
              onClick={() => setConfig((c) => ({ ...c, seasonEnded: !c.seasonEnded }))}
              style={{
                width: 44, height: 24, borderRadius: 12, background: config.seasonEnded ? "var(--red)" : "var(--border)",
                position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
              }}
            >
              <div style={{
                position: "absolute", top: 3, left: config.seasonEnded ? 23 : 3,
                width: 18, height: 18, borderRadius: 9, background: "#fff",
                transition: "left 0.2s",
              }} />
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>Seizoen beëindigd</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Activeert podiumweergave en eindeseizoen rapporten</div>
            </div>
          </label>
        </div>
      </div>

      <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ width: "100%", padding: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <Save size={16} />
        {saving ? "Opslaan..." : "Instellingen opslaan"}
      </button>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
