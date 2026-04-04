"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";
import Toast from "@/components/Toast";
import { Race } from "@/lib/utils";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [races, setRaces] = useState<Race[]>([]);
  const [week, setWeek] = useState<number>(0);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [lastUpload, setLastUpload] = useState<{ week: number; raceName: string; count: number } | null>(null);
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

  const handleSubmit = async () => {
    if (!file || !week) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("week", String(week));
      const res = await fetch("/api/upload-results", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setLastUpload({ week, raceName: selectedRace?.name ?? String(week), count: json.count });
      setToast({ message: `✓ ${json.count} resultaten opgeslagen voor ${selectedRace?.name ?? `week ${week}`}`, type: "success" });
      setFile(null);
    } catch (err: unknown) {
      setToast({ message: err instanceof Error ? err.message : "Fout bij uploaden", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ fontSize: 32, marginBottom: 6 }}>Uitslag <span style={{ color: "var(--accent)" }}>Uploaden</span></h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 32, fontSize: 14 }}>
        Upload het finish-bestand van een wedstrijd. Het bestand moet kolommen bevatten: <code style={{ background: "var(--surface-2)", padding: "1px 6px", borderRadius: 4 }}>bib</code> en <code style={{ background: "var(--surface-2)", padding: "1px 6px", borderRadius: 4 }}>pl</code> (of <code style={{ background: "var(--surface-2)", padding: "1px 6px", borderRadius: 4 }}>plaats</code>).
      </p>

      {/* Race selector */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <label style={{ display: "block", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
          Wedstrijd
        </label>
        {races.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Geen wedstrijden gevonden. Voeg ze toe via Instellingen.</div>
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
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {file ? (
          <>
            <FileSpreadsheet size={40} color="var(--green)" style={{ marginBottom: 12 }} />
            <div style={{ fontWeight: 600, color: "var(--green)", marginBottom: 4 }}>{file.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{(file.size / 1024).toFixed(1)} KB · Klik om te wijzigen</div>
          </>
        ) : (
          <>
            <Upload size={40} color="var(--text-muted)" style={{ marginBottom: 12 }} />
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Sleep het bestand hierheen</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>of klik om te bladeren · .xlsx, .xls, .csv</div>
          </>
        )}
      </div>

      <button className="btn-primary" onClick={handleSubmit} disabled={!file || !week || loading} style={{ width: "100%", padding: "14px", fontSize: 15 }}>
        {loading ? "Bezig met verwerken..." : `Uploaden voor ${selectedRace?.name ?? "..."}`}
      </button>

      {lastUpload && (
        <div className="card" style={{ padding: 16, marginTop: 20, display: "flex", alignItems: "center", gap: 12, borderColor: "var(--green)" }}>
          <CheckCircle size={20} color="var(--green)" />
          <div>
            <div style={{ fontWeight: 600, color: "var(--green)" }}>Laatste upload geslaagd</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {lastUpload.raceName} · {lastUpload.count} resultaten
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 16, marginTop: 20, display: "flex", gap: 12 }}>
        <AlertCircle size={18} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--text)" }}>Verwacht formaat:</strong> Het bestand moet een kolom <code style={{ background: "var(--surface-2)", padding: "1px 5px", borderRadius: 3 }}>bib</code> (startnummer) en een kolom <code style={{ background: "var(--surface-2)", padding: "1px 5px", borderRadius: 3 }}>pl</code> of <code style={{ background: "var(--surface-2)", padding: "1px 5px", borderRadius: 3 }}>plaats</code> (eindpositie) bevatten. Rijders die niet finishten krijgen automatisch 80 punten.
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}