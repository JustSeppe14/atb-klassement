"use client";
import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { UserPlus, Trash2, Upload, Search, Edit2, X, Download, RefreshCw, History, ChevronDown, ChevronUp } from "lucide-react";
import Toast from "@/components/Toast";
import { Deelnemer, normalizeKlasse } from "@/lib/utils";
import * as XLSX from "xlsx";

interface KlasseSwitch {
  id: number;
  bib: number;
  old_klasse: string;
  new_klasse: string;
  from_week: number;
  changed_at: string;
}

export default function DeelnemersPage() {
  const [deelnemers, setDeelnemers] = useState<Deelnemer[]>([]);
  const [switches, setSwitches] = useState<KlasseSwitch[]>([]);
  const [races, setRaces] = useState<{ id: number; name: string; sort_order: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [expandedBibs, setExpandedBibs] = useState<Set<number>>(new Set());

  const [showForm, setShowForm] = useState(false);
  const [editingBib, setEditingBib] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<Deelnemer>>({ categorie: "STA" });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, sRes, rRes] = await Promise.all([
        fetch("/api/deelnemers"),
        fetch("/api/klasse-history"),
        fetch("/api/races"),
      ]);
      setDeelnemers((await dRes.json()) ?? []);
      setSwitches((await sRes.json()) ?? []);
      setRaces((await rRes.json()) ?? []);
    } catch (err) {
      console.error("Fetch error", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const switchesByBib = new Map<number, KlasseSwitch[]>();
  for (const sw of switches) {
    const list = switchesByBib.get(sw.bib) ?? [];
    list.push(sw);
    switchesByBib.set(sw.bib, list);
  }

  const resetForm = () => { setShowForm(false); setEditingBib(null); setForm({ categorie: "STA" }); };

  const handleEdit = (d: Deelnemer) => {
    setForm(d);
    setEditingBib(d.bib);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleExport = () => {
    if (deelnemers.length === 0) { setToast({ message: "Geen deelnemers om te exporteren", type: "error" }); return; }
    const exportData = deelnemers.map(d => ({ Startnummer: d.bib, Naam: d.naam, Klasse: d.klasse, Categorie: d.categorie, Team: d.team || "-" }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Deelnemers");
    XLSX.writeFile(wb, `Deelnemerslijst_${new Date().toISOString().split("T")[0]}.xlsx`);
    setToast({ message: "✓ Excel bestand gedownload", type: "success" });
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync-deelnemers", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        const switchMsg = json.switches > 0
          ? ` · ${json.switches} klassewissels automatisch verwerkt`
          : "";
        setToast({ message: `✓ ${json.count} deelnemers gesynchroniseerd${switchMsg}`, type: "success" });
        fetchAll();
      } else {
        setToast({ message: json.error ?? "Synchronisatie mislukt", type: "error" });
      }
    } catch {
      setToast({ message: "Netwerkfout bij synchroniseren", type: "error" });
    } finally {
      setSyncing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/deelnemers", { method: "POST", body: fd });
    const json = await res.json();
    if (res.ok) { setToast({ message: `✓ ${json.count} deelnemers geladen`, type: "success" }); fetchAll(); }
    else setToast({ message: json.error, type: "error" });
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!form.bib || !form.naam || !form.klasse) {
      setToast({ message: "Vul startnummer, naam en klasse in", type: "error" }); return;
    }
    setSaving(true);
    const payload = { ...form, klasse: normalizeKlasse(form.klasse!) };
    const res = await fetch("/api/deelnemers", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    if (res.ok) {
      setToast({ message: editingBib ? "✓ Deelnemer bijgewerkt" : "✓ Deelnemer opgeslagen", type: "success" });
      resetForm(); fetchAll();
    } else {
      const json = await res.json();
      setToast({ message: json.error, type: "error" });
    }
    setSaving(false);
  };

  const handleDelete = async (bib: number) => {
    if (!confirm(`Verwijder deelnemer ${bib}?`)) return;
    const res = await fetch("/api/deelnemers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bib }) });
    if (res.ok) { setToast({ message: "Deelnemer verwijderd", type: "success" }); fetchAll(); }
  };

  const handleDeleteSwitch = async (switchId: number) => {
    if (!confirm("Verwijder deze klassewisseling? De punten worden teruggezet naar de originele berekening.")) return;
    const res = await fetch("/api/klasse-history", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: switchId }) });
    if (res.ok) { setToast({ message: "Klassewisseling ongedaan gemaakt", type: "success" }); fetchAll(); }
    else setToast({ message: "Fout bij verwijderen", type: "error" });
  };

  const toggleExpand = (bib: number) => {
    setExpandedBibs(prev => {
      const next = new Set(prev);
      next.has(bib) ? next.delete(bib) : next.add(bib);
      return next;
    });
  };

  const raceName = (sortOrder: number) =>
    races.find((r) => r.sort_order === sortOrder)?.name ?? `Week ${sortOrder}`;

  const filtered = deelnemers.filter(
    (d) => search === "" ||
      d.naam.toLowerCase().includes(search.toLowerCase()) ||
      String(d.bib).includes(search) ||
      d.klasse.toLowerCase().includes(search.toLowerCase()) ||
      d.team?.toLowerCase().includes(search.toLowerCase())
  );

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
    color: "var(--text-muted)", marginBottom: 6,
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 32, margin: 0 }}>
            Deelnemers<span style={{ color: "var(--accent)" }}> {deelnemers.length}</span>
          </h1>
          <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
            Beheer de deelnemerslijst
            {switches.length > 0 && (
              <span style={{ marginLeft: 10, background: "var(--accent)", color: "#fff", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                {switches.length} klassewissels
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-secondary" onClick={handleExport} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Download size={14} /> Export Excel
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleFileUpload} />
          <button className="btn-secondary" onClick={() => fileRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Upload size={14} /> Excel importeren
          </button>
          <button className="btn-secondary" onClick={handleSync} disabled={syncing} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <RefreshCw size={14} style={{ animation: syncing ? "spin 1s linear infinite" : "none" }} />
            {syncing ? "Synchroniseren..." : "Google Sheets sync"}
          </button>
          <button className="btn-primary" onClick={() => { if (showForm && editingBib) resetForm(); setShowForm(!showForm); }} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <UserPlus size={14} /> Toevoegen
          </button>
        </div>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="card" style={{ padding: 20, marginBottom: 20, borderLeft: editingBib ? "4px solid var(--accent)" : "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16 }}>
              {editingBib ? `Deelnemer ${editingBib} bewerken` : "Nieuwe deelnemer"}
            </div>
            <button onClick={resetForm} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={18} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
            {[
              { key: "bib", label: "Startnummer", type: "number", placeholder: "101", disabled: !!editingBib },
              { key: "naam", label: "Naam", type: "text", placeholder: "Jan Janssen" },
              { key: "klasse", label: "Klasse", type: "text", placeholder: "A40+" },
              { key: "team", label: "Team", type: "text", placeholder: "Team naam" },
            ].map(({ key, label, type, placeholder, disabled }) => (
              <div key={key}>
                <label style={labelStyle}>{label}</label>
                <input
                  className="input" type={type} placeholder={placeholder}
                  style={{ width: "100%", opacity: disabled ? 0.6 : 1 }} disabled={disabled}
                  value={String(form[key as keyof Deelnemer] ?? "")}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: type === "number" ? parseInt(e.target.value) || "" : e.target.value }))}
                />
              </div>
            ))}
            <div>
              <label style={labelStyle}>Categorie</label>
              <select className="input" style={{ width: "100%" }} value={form.categorie ?? "STA"} onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value as Deelnemer["categorie"] }))}>
                <option value="STA">STA</option>
                <option value="SEN">SEN</option>
                <option value="DAM">DAM</option>
              </select>
            </div>
          </div>
          {editingBib && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, padding: "8px 12px", background: "var(--surface-2)", borderRadius: 6 }}>
              💡 Klassewijziging wordt automatisch verwerkt: alle vorige uitslagen krijgen 50 punten, nieuwe uitslagen tellen in de nieuwe klasse.
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Opslaan..." : editingBib ? "Bijwerken" : "Opslaan"}</button>
            <button className="btn-secondary" onClick={resetForm}>Annuleren</button>
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
        <input className="input" placeholder="Zoek op naam, nummer, klasse of team..." style={{ width: "100%", paddingLeft: 36 }} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <div className="card" style={{ overflowX: "auto" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontFamily: "'Barlow Condensed', sans-serif" }}>Laden...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nr.</th><th>Naam</th><th>Klasse</th><th>Cat.</th><th>Team</th><th style={{ textAlign: "right" }}>Acties</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const bibSwitches = (switchesByBib.get(d.bib) ?? []).sort((a, b) => a.from_week - b.from_week);
                const isExpanded = expandedBibs.has(d.bib);

                return (
                  <Fragment key={d.bib}>
                    {/* Main row */}
                    <tr className={d.categorie === "DAM" ? "row-dam" : ""}>
                      <td style={{ fontWeight: 700, color: "var(--accent)" }}>{d.bib}</td>
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {d.naam}
                          {/* History badge — always visible */}
                          <button
                            onClick={() => toggleExpand(d.bib)}
                            title={bibSwitches.length > 0 ? "Klassewissels bekijken" : "Geen klassewissels"}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              background: bibSwitches.length > 0 ? "rgba(232,162,23,0.12)" : "var(--surface-2)",
                              border: bibSwitches.length > 0 ? "1px solid rgba(232,162,23,0.3)" : "1px solid var(--border)",
                              borderRadius: 10, padding: "1px 7px", cursor: "pointer",
                              fontSize: 11, fontWeight: 700,
                              color: bibSwitches.length > 0 ? "var(--accent)" : "var(--text-muted)",
                            }}
                          >
                            <History size={10} />
                            {bibSwitches.length}
                            {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                          </button>
                        </div>
                      </td>
                      <td style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13 }}>{d.klasse}</td>
                      <td><span className={`badge badge-${d.categorie.toLowerCase()}`}>{d.categorie}</span></td>
                      <td style={{ color: "var(--text-muted)" }}>{d.team ?? "—"}</td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          <button onClick={() => handleEdit(d)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 6, borderRadius: 4 }}>
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(d.bib)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 6, borderRadius: 4, transition: "color 0.15s" }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--red)")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Klasse history panel */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} style={{ padding: 0, background: "var(--surface-2)" }}>
                          <div style={{ padding: "12px 20px 14px 48px" }}>
                            <div style={{
                              fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                              letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)",
                              marginBottom: 8, display: "flex", alignItems: "center", gap: 6,
                            }}>
                              <History size={11} /> Klassewissels — uitslagen vóór de wissel tellen als 50 punten
                            </div>

                            {bibSwitches.length === 0 ? (
                              <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", padding: "6px 0" }}>
                                Geen klassewissels geregistreerd voor deze deelnemer.
                              </div>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {bibSwitches.map((sw) => (
                                  <div key={sw.id} style={{
                                    display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                                    background: "var(--surface)", border: "1px solid var(--border)",
                                    borderRadius: 8, padding: "7px 12px",
                                  }}>
                                    {/* Old → New klasse */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 160 }}>
                                      <span style={{
                                        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 13,
                                        color: "var(--text-muted)", background: "var(--surface-2)", padding: "2px 8px", borderRadius: 4,
                                      }}>
                                        {sw.old_klasse}
                                      </span>
                                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>→</span>
                                      <span style={{
                                        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 13,
                                        color: "var(--accent)", background: "var(--surface-2)", padding: "2px 8px", borderRadius: 4,
                                      }}>
                                        {sw.new_klasse}
                                      </span>
                                    </div>

                                    {/* From race */}
                                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                      Nieuwe klasse vanaf: <strong style={{ color: "var(--text)" }}>{raceName(sw.from_week)}</strong>
                                    </div>

                                    {/* Detected on date */}
                                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
                                      Gedetecteerd op {new Date(sw.changed_at).toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" })}
                                    </div>

                                    {/* Undo */}
                                    <button
                                      onClick={() => handleDeleteSwitch(sw.id)}
                                      title="Klassewisseling ongedaan maken"
                                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, borderRadius: 4, flexShrink: 0 }}
                                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--red)")}
                                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>
                  {search ? "Geen resultaten gevonden" : "Nog geen deelnemers. Importeer een Excel-bestand."}
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}