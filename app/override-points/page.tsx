"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, FileSpreadsheet, CheckCircle, Info } from "lucide-react";
import Toast from "@/components/Toast";
import { Race } from "@/lib/utils";

export default function OverridePointsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [races, setRaces] = useState<Race[]>([]);
  const [week, setWeek] = useState<number>(0);
  const [customPoints, setCustomPoints] = useState<string>("20");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [lastResult, setLastResult] = useState<{
    raceName: string;
    overrideCount: number;
    dnsCount: number;
    points: number;
    warnings: string[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/races")
      .then((r) => r.json())
      .then((data) => {
        setRaces(data ?? []);
        if (data?.length > 0) setWeek(data[0].sort_order);
      });
  }, []);

  const selectedRace = races.find((r) => r.sort_order === week);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }, []);

  const parsedPoints = parseInt(customPoints);
  const pointsValid = !isNaN(parsedPoints) && parsedPoints >= 0;

  const handleSubmit = async () => {
    if (!file || !week || !pointsValid) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("week", String(week));
      fd.append("customPoints", String(parsedPoints));
      const res = await fetch("/api/override-points", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setLastResult({
        raceName: selectedRace?.name ?? String(week),
        overrideCount: json.overrideCount,
        dnsCount: json.dnsCount,
        points: parsedPoints,
        warnings: json.warnings ?? [],
      });
      setToast({
        message: `✓ ${json.overrideCount} rijder(s) krijgen ${parsedPoints} punten voor ${selectedRace?.name ?? `week ${week}`}`,
        type: "success",
      });
      setFile(null);
    } catch (err: unknown) {
      setToast({ message: err instanceof Error ? err.message : "Fout bij uploaden", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ fontSize: 32, marginBottom: 6 }}>
        Punten <span style={{ color: "var(--accent)" }}>Overschrijven</span>
      </h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 32, fontSize: 14 }}>
        Upload het standaard uitslagenbestand. Alle rijders in het bestand krijgen dezelfde
        aangepaste puntwaarde. Rijders{" "}
        <strong style={{ color: "var(--text)" }}>niet</strong> in het bestand krijgen automatisch{" "}
        <strong style={{ color: "var(--text)" }}>80 DNS-punten</strong>.
      </p>

      {/* Race selector */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <label style={labelStyle}>Wedstrijd</label>
        {races.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
            Geen wedstrijden gevonden. Voeg ze toe via Instellingen.
          </div>
        ) : (
          <select
            className="input"
            style={{ width: "100%" }}
            value={week}
            onChange={(e) => setWeek(parseInt(e.target.value))}
          >
            {races.map((r) => (
              <option key={r.id} value={r.sort_order}>{r.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Custom points input */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <label style={labelStyle}>Punten voor deelnemers in het bestand</label>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <input
            className="input"
            type="number"
            min={0}
            max={79}
            value={customPoints}
            onChange={(e) => setCustomPoints(e.target.value)}
            style={{ width: 90, textAlign: "center", fontSize: 22, fontWeight: 700 }}
          />
          <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
            Elke rijder in het bestand krijgt{" "}
            <strong style={{ color: pointsValid ? "var(--accent)" : "#e05" }}>
              {pointsValid ? parsedPoints : "—"}
            </strong>{" "}
            punten.
            <br />
            Niet-deelnemers krijgen{" "}
            <strong style={{ color: "var(--text)" }}>80</strong> punten (DNS).
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className="card"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          padding: 40, textAlign: "center", cursor: "pointer",
          border: `2px dashed ${dragging ? "var(--accent)" : file ? "var(--green)" : "var(--border)"}`,
          background: dragging ? "rgba(232,162,23,0.05)" : file ? "rgba(76,175,125,0.05)" : "var(--surface)",
          transition: "all 0.2s", marginBottom: 20,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: "none" }}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <>
            <FileSpreadsheet size={40} color="var(--green)" style={{ marginBottom: 12 }} />
            <div style={{ fontWeight: 600, color: "var(--green)", marginBottom: 4 }}>{file.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {(file.size / 1024).toFixed(1)} KB · Klik om te wijzigen
            </div>
          </>
        ) : (
          <>
            <Upload size={40} color="var(--text-muted)" style={{ marginBottom: 12 }} />
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Sleep het uitslagenbestand hierheen</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              of klik om te bladeren · .xlsx, .xls, .csv
            </div>
          </>
        )}
      </div>

      <button
        className="btn-primary"
        onClick={handleSubmit}
        disabled={!file || !week || !pointsValid || loading}
        style={{ width: "100%", padding: "14px", fontSize: 15, marginBottom: 20 }}
      >
        {loading
          ? "Bezig met verwerken..."
          : `Opslaan voor ${selectedRace?.name ?? "..."} — ${pointsValid ? parsedPoints : "?"} punten`}
      </button>

      {/* Success result */}
      {lastResult && (
        <div className="card" style={{ padding: 16, marginBottom: 16, borderColor: "var(--green)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <CheckCircle size={20} color="var(--green)" />
            <div style={{ fontWeight: 600, color: "var(--green)" }}>Opgeslagen</div>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7 }}>
            <div><strong style={{ color: "var(--text)" }}>Wedstrijd:</strong> {lastResult.raceName}</div>
            <div>
              <strong style={{ color: "var(--text)" }}>Deelnemers ({lastResult.points} punten):</strong>{" "}
              {lastResult.overrideCount} rijder(s)
            </div>
            <div>
              <strong style={{ color: "var(--text)" }}>DNS (80 punten):</strong>{" "}
              {lastResult.dnsCount} rijder(s)
            </div>
          </div>
          {lastResult.warnings.length > 0 && (
            <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Waarschuwingen
              </div>
              {lastResult.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 3 }}>⚠ {w}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Format info */}
      <div className="card" style={{ padding: 16, display: "flex", gap: 12 }}>
        <Info size={18} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7 }}>
          <strong style={{ color: "var(--text)" }}>Hetzelfde bestandsformaat als normale uploads:</strong>{" "}
          kolommen{" "}
          <code style={{ background: "var(--surface-2)", padding: "1px 5px", borderRadius: 3 }}>naam</code>{" "}
          en{" "}
          <code style={{ background: "var(--surface-2)", padding: "1px 5px", borderRadius: 3 }}>pl</code>{" "}
          /{" "}
          <code style={{ background: "var(--surface-2)", padding: "1px 5px", borderRadius: 3 }}>plaats</code>.
          De eindpositie in het bestand wordt genegeerd — enkel de namen bepalen wie de aangepaste punten krijgt.
          <br /><br />
          <strong style={{ color: "var(--accent)" }}>Let op:</strong> Dit overschrijft alle bestaande resultaten voor de geselecteerde wedstrijd.
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  marginBottom: 10,
};