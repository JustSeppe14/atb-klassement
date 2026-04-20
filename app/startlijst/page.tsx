"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { jsPDF } from "jspdf";

type RegEntry = {
  bib: number;
  naam: string;
  klasse: string;
  aantalDeelnames: number;
  punten: number;
};

const getPoolKey = (klasse: string) => {
  if (klasse === "A40+") return "A";
  return klasse;
};

function buildStartlist(data: RegEntry[]) {
  if (!Array.isArray(data) || data.length === 0) return [];

  const poolMap = new Map<string, RegEntry[]>();

  for (const entry of data) {
    const pool = getPoolKey(entry.klasse);
    if (!poolMap.has(pool)) poolMap.set(pool, []);
    poolMap.get(pool)!.push(entry);
  }

  const klasseOrder = ["A", "B", "C", "D", "E"];
  const sortedPools = [...poolMap.entries()].sort(([a], [b]) => {
    const ai = klasseOrder.indexOf(a);
    const bi = klasseOrder.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const rows: (RegEntry & { startNr: number; pool: string; regRank: number })[] = [];

  for (const [pool, entries] of sortedPools) {
    const sorted = [...entries].sort((a, b) => {
      if (a.punten !== b.punten) return a.punten - b.punten;
      return b.aantalDeelnames - a.aantalDeelnames;
    });
    sorted.forEach((e, idx) => {
      rows.push({ ...e, startNr: idx + 1, pool, regRank: idx + 1 });
    });
  }

  return rows;
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// PDF generation
// ---------------------------------------------------------------------------
async function generatePDF(
  rows: ReturnType<typeof buildStartlist>,
  raceName: string,
  raceDate: string,
  logoDataUrl: string | null
): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const marginL = 14;
  const marginR = 14;
  const contentW = pageW - marginL - marginR;

  const accentColor: [number, number, number] = [220, 38, 38];
  const darkColor: [number, number, number] = [15, 15, 20];
  const mutedColor: [number, number, number] = [120, 120, 130];
  const lightBg: [number, number, number] = [245, 245, 248];
  const white: [number, number, number] = [255, 255, 255];

  const headerH = logoDataUrl ? 48 : 36;

  const cols = [
    { label: "#", key: "startNr", w: 14, align: "center" as const },
    { label: "Nr.", key: "bib", w: 14, align: "center" as const },
    { label: "Naam", key: "naam", w: 100, align: "left" as const },
    { label: "Klasse", key: "klasse", w: 22, align: "center" as const },
    { label: "Reg. Rank", key: "regRank", w: 22, align: "center" as const },
  ];

  const colX: number[] = [];
  let cx = marginL;
  for (const col of cols) {
    colX.push(cx);
    cx += col.w;
  }

  const rowH = 7.5;

  // Get unique pools in order
  const pools: string[] = [];
  for (const row of rows) {
    if (!pools.includes(row.pool)) pools.push(row.pool);
  }

  const drawHeader = (pool: string) => {
    doc.setFillColor(...darkColor);
    doc.rect(0, 0, pageW, headerH, "F");
    doc.setFillColor(...accentColor);
    doc.rect(0, headerH - 3, pageW, 3, "F");

    if (logoDataUrl) {
      try {
        const ext = logoDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
        doc.addImage(logoDataUrl, ext, pageW - 46, 4, 32, 32);
      } catch (e) {
        console.warn("Logo kon niet worden toegevoegd:", e);
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...white);
    doc.text(`STARTLIJST KLASSE ${pool}`, marginL, 16);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(200, 200, 210);
    doc.text(raceName || "Wedstrijd", marginL, 26);
    doc.text(raceDate || "", marginL, 32);
  };

  const drawColHeaders = (y: number) => {
    doc.setFillColor(...accentColor);
    doc.rect(marginL, y, contentW, rowH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...white);
    cols.forEach((col, i) => {
      const tx = col.align === "center" ? colX[i] + col.w / 2 : colX[i] + 2;
      doc.text(col.label, tx, y + 5, { align: col.align });
    });
  };

  let isFirstPool = true;

  for (const pool of pools) {
    const poolRows = rows.filter((r) => r.pool === pool);

    if (!isFirstPool) doc.addPage();
    isFirstPool = false;

    drawHeader(pool);

    let y = headerH + 4;
    drawColHeaders(y);
    y += rowH;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);

    poolRows.forEach((row, rowIndex) => {
      if (y > pageH - 14) {
        doc.addPage();
        y = 10;
        drawColHeaders(y);
        y += rowH;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
      }

      const isEven = rowIndex % 2 === 0;
      doc.setFillColor(...(isEven ? lightBg : white));
      doc.rect(marginL, y, contentW, rowH, "F");
      doc.setTextColor(...darkColor);

      const values: Record<string, string> = {
        startNr: String(row.startNr),
        bib: String(row.bib),
        naam: row.naam,
        klasse: row.klasse,
        regRank: String(row.regRank),
      };

      cols.forEach((col, i) => {
        const val = values[col.key] ?? "";
        const tx = col.align === "center" ? colX[i] + col.w / 2 : colX[i] + 2;
        const maxChars = Math.floor(col.w / 1.8);
        const display = val.length > maxChars ? val.slice(0, maxChars - 1) + "…" : val;
        doc.text(display, tx, y + 5, { align: col.align });
      });

      doc.setDrawColor(220, 220, 225);
      doc.setLineWidth(0.1);
      doc.line(marginL, y + rowH, marginL + contentW, y + rowH);
      y += rowH;
    });
  }

  // Footer on every page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(...darkColor);
    doc.rect(0, pageH - 10, pageW, 10, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...mutedColor);
    doc.text(`Pagina ${p} / ${totalPages}`, pageW / 2, pageH - 3.5, { align: "center" });
    doc.text(`Gegenereerd op ${new Date().toLocaleDateString("nl-BE")}`, marginL, pageH - 3.5);
  }

  return doc.output("blob");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function StartlistPage() {
  const [regelmatigheid, setRegelmatigheid] = useState<RegEntry[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const [raceName, setRaceName] = useState("Wedstrijd");
  const [raceDate, setRaceDate] = useState(
    new Date().toLocaleDateString("nl-BE", { day: "2-digit", month: "long", year: "numeric" })
  );
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoName, setLogoName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setDataLoading(true);
      setFetchError(null);
      try {
        const res = await fetch("/api/klassement");
        if (!res.ok) throw new Error(`API antwoordde met ${res.status}`);
        const json = await res.json();
        if (!Array.isArray(json.regelmatigheid)) {
          throw new Error("Onverwacht API-formaat: regelmatigheid ontbreekt");
        }
        setRegelmatigheid(json.regelmatigheid);
      } catch (e: any) {
        setFetchError(e.message ?? "Onbekende fout");
      } finally {
        setDataLoading(false);
      }
    })();
  }, []);

  const rows = buildStartlist(regelmatigheid);

  const regenerate = useCallback(async () => {
    if (rows.length === 0) return;
    setPdfLoading(true);
    try {
      const blob = await generatePDF(rows, raceName, raceDate, logoDataUrl);
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));
    } catch (e) {
      console.error(e);
    } finally {
      setPdfLoading(false);
    }
  }, [rows, raceName, raceDate, logoDataUrl]);

  useEffect(() => {
    if (!dataLoading && rows.length > 0) regenerate();
  }, [dataLoading]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataURL(file);
      setLogoDataUrl(dataUrl);
      setLogoName(file.name);
    } catch {
      console.error("Logo kon niet worden geladen");
    }
  };

  const removeLogo = () => {
    setLogoDataUrl(null);
    setLogoName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `startlijst-${raceName.replace(/\s+/g, "-").toLowerCase()}.pdf`;
    a.click();
  };

  if (dataLoading) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
        Gegevens laden…
      </div>
    );
  }

  if (fetchError) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "var(--accent)" }}>
        Fout bij laden: {fetchError}
      </div>
    );
  }

  const pools = [...new Set(rows.map((r) => r.pool))];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Controls */}
      <div
        className="card"
        style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end", padding: "20px 24px" }}
      >
        {/* Race name */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 200px" }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
            Wedstrijdnaam
          </label>
          <input
            value={raceName}
            onChange={(e) => setRaceName(e.target.value)}
            style={{
              padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border, #ddd)",
              fontSize: 14, fontWeight: 600, background: "var(--surface, #fff)",
              color: "var(--text)", outline: "none",
            }}
          />
        </div>

        {/* Date */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 160px" }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
            Datum
          </label>
          <input
            value={raceDate}
            onChange={(e) => setRaceDate(e.target.value)}
            style={{
              padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border, #ddd)",
              fontSize: 14, background: "var(--surface, #fff)", color: "var(--text)", outline: "none",
            }}
          />
        </div>

        {/* Logo upload */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 200px" }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
            Logo (optioneel)
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={handleLogoUpload}
              style={{ display: "none" }}
              id="logo-upload"
            />
            <label
              htmlFor="logo-upload"
              className="btn-secondary"
              style={{
                padding: "8px 14px", fontSize: 13, borderRadius: 6, fontWeight: 700,
                cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              {logoName ? "↺ Vervangen" : "↑ Upload logo"}
            </label>
            {logoName && (
              <>
                <span style={{
                  fontSize: 12, color: "var(--text-muted)", overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120,
                }}>
                  {logoName}
                </span>
                <button
                  onClick={removeLogo}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--accent)", fontSize: 16, lineHeight: 1, padding: 0,
                  }}
                  title="Logo verwijderen"
                >
                  ✕
                </button>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={regenerate}
            disabled={pdfLoading}
            className="btn-secondary"
            style={{ padding: "9px 18px", fontSize: 13, borderRadius: 6, fontWeight: 700 }}
          >
            {pdfLoading ? "Bezig…" : "↻ Vernieuwen"}
          </button>
          <button
            onClick={handleDownload}
            disabled={!pdfUrl || pdfLoading}
            className="btn-primary"
            style={{ padding: "9px 18px", fontSize: 13, borderRadius: 6, fontWeight: 700 }}
          >
            ↓ Download PDF
          </button>
        </div>
      </div>

      {/* Per-class rider counts */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {pools.map((pool) => {
          const count = rows.filter((r) => r.pool === pool).length;
          return (
            <div key={pool} className="card" style={{ padding: "10px 18px", display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, color: "var(--accent)" }}>
                {pool}
              </span>
              <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>
                {count} renners
              </span>
            </div>
          );
        })}
        <div className="card" style={{ padding: "10px 18px", display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontWeight: 800, fontSize: 18 }}>Totaal</span>
          <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>
            {rows.length} renners
          </span>
        </div>
      </div>

      {/* PDF Preview */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{
          padding: "12px 20px", borderBottom: "1px solid var(--border, #eee)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
            PDF Voorbeeld
          </span>
          {pdfLoading && <span style={{ fontSize: 11, color: "var(--accent)" }}>Genereren…</span>}
        </div>
        {pdfUrl ? (
          <iframe
            src={pdfUrl}
            style={{ width: "100%", height: 700, border: "none", display: "block" }}
            title="Startlijst PDF preview"
          />
        ) : (
          <div style={{
            height: 300, display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--text-muted)", fontSize: 14,
          }}>
            {pdfLoading ? "PDF wordt gegenereerd…" : "Klik op Vernieuwen om een voorbeeld te laden."}
          </div>
        )}
      </div>
    </div>
  );
}