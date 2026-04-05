"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { UserPlus, Trash2, Upload, Search, Edit2, X, Download } from "lucide-react";
import Toast from "@/components/Toast";
import { Deelnemer, normalizeKlasse } from "@/lib/utils";
import * as XLSX from "xlsx"; // Import for exporting

export default function DeelnemersPage() {
  const [deelnemers, setDeelnemers] = useState<Deelnemer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingBib, setEditingBib] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<Deelnemer>>({ categorie: "STA" });
  const [saving, setSaving] = useState(false);
  
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchDeelnemers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/deelnemers");
      const json = await res.json();
      setDeelnemers(json ?? []);
    } catch (err) {
      console.error("Fetch error", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDeelnemers(); }, [fetchDeelnemers]);

  const resetForm = () => {
    setShowForm(false);
    setEditingBib(null);
    setForm({ categorie: "STA" });
  };

  const handleEdit = (d: Deelnemer) => {
    setForm(d);
    setEditingBib(d.bib);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // --- EXPORT FUNCTION ---
  const handleExport = () => {
    if (deelnemers.length === 0) {
      setToast({ message: "Geen deelnemers om te exporteren", type: "error" });
      return;
    }

    // Map data to clean headers for Excel
    const exportData = deelnemers.map(d => ({
      Startnummer: d.bib,
      Naam: d.naam,
      Klasse: d.klasse,
      Categorie: d.categorie,
      Team: d.team || "-"
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Deelnemers");
    
    // Generate file and trigger download
    XLSX.writeFile(workbook, `Deelnemerslijst_${new Date().toISOString().split('T')[0]}.xlsx`);
    setToast({ message: "✓ Excel bestand gedownload", type: "success" });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/deelnemers", { method: "POST", body: fd });
    const json = await res.json();
    if (res.ok) {
      setToast({ message: `✓ ${json.count} deelnemers geladen`, type: "success" });
      fetchDeelnemers();
    } else {
      setToast({ message: json.error, type: "error" });
    }
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!form.bib || !form.naam || !form.klasse) {
      setToast({ message: "Vul startnummer, naam en klasse in", type: "error" });
      return;
    }
    setSaving(true);
    const payload = { ...form, klasse: normalizeKlasse(form.klasse!) };
    
    const res = await fetch("/api/deelnemers", { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify(payload) 
    });

    if (res.ok) {
      setToast({ 
        message: editingBib ? "✓ Deelnemer bijgewerkt" : "✓ Deelnemer opgeslagen", 
        type: "success" 
      });
      resetForm();
      fetchDeelnemers();
    } else {
      const json = await res.json();
      setToast({ message: json.error, type: "error" });
    }
    setSaving(false);
  };

  const handleDelete = async (bib: number) => {
    if (!confirm(`Verwijder deelnemer ${bib}?`)) return;
    const res = await fetch("/api/deelnemers", { 
      method: "DELETE", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ bib }) 
    });
    if (res.ok) {
      setToast({ message: "Deelnemer verwijderd", type: "success" });
      fetchDeelnemers();
    }
  };

  const filtered = deelnemers.filter((d) =>
    search === "" ||
    d.naam.toLowerCase().includes(search.toLowerCase()) ||
    String(d.bib).includes(search) ||
    d.klasse.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 32, margin: 0 }}>Deelnemers<span style={{ color: "var(--accent)" }}> {deelnemers.length}</span></h1>
          <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>Beheer de deelnemerslijst</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-secondary" onClick={handleExport} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Download size={14} /> Export Excel
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleFileUpload} />
          <button className="btn-secondary" onClick={() => fileRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Upload size={14} /> Excel importeren
          </button>
          <button className="btn-primary" onClick={() => { if(showForm && editingBib) resetForm(); setShowForm(!showForm); }} style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
             <button onClick={resetForm} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18}/></button>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
            {[
              { key: "bib", label: "Startnummer", type: "number", placeholder: "101", disabled: !!editingBib },
              { key: "naam", label: "Naam", type: "text", placeholder: "Jan Janssen" },
              { key: "klasse", label: "Klasse", type: "text", placeholder: "A40+" },
              { key: "team", label: "Team", type: "text", placeholder: "Team naam" },
            ].map(({ key, label, type, placeholder, disabled }) => (
              <div key={key}>
                <label style={{ display: "block", fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>{label}</label>
                <input 
                  className="input" 
                  type={type} 
                  placeholder={placeholder} 
                  style={{ width: "100%", opacity: disabled ? 0.6 : 1 }}
                  disabled={disabled}
                  value={String(form[key as keyof Deelnemer] ?? "")}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: type === "number" ? parseInt(e.target.value) || "" : e.target.value }))}
                />
              </div>
            ))}
            <div>
              <label style={{ display: "block", fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>Categorie</label>
              <select className="input" style={{ width: "100%" }} value={form.categorie ?? "STA"} onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value as Deelnemer["categorie"] }))}>
                <option value="STA">STA</option>
                <option value="SEN">SEN</option>
                <option value="DAM">DAM</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Opslaan..." : editingBib ? "Bijwerken" : "Opslaan"}
            </button>
            <button className="btn-secondary" onClick={resetForm}>Annuleren</button>
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
        <input className="input" placeholder="Zoek op naam, nummer of klasse..." style={{ width: "100%", paddingLeft: 36 }} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <div className="card" style={{ overflowX: "auto" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontFamily: "'Barlow Condensed', sans-serif" }}>Laden...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nr.</th>
                <th>Naam</th>
                <th>Klasse</th>
                <th>Cat.</th>
                <th>Team</th>
                <th style={{ textAlign: 'right' }}>Acties</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.bib} className={d.categorie === "DAM" ? "row-dam" : ""}>
                  <td style={{ fontWeight: 700, color: "var(--accent)" }}>{d.bib}</td>
                  <td style={{ fontWeight: 600 }}>{d.naam}</td>
                  <td style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13 }}>{d.klasse}</td>
                  <td><span className={`badge badge-${d.categorie.toLowerCase()}`}>{d.categorie}</span></td>
                  <td style={{ color: "var(--text-muted)" }}>{d.team ?? "—"}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: "flex", gap: 4, justifyContent: 'flex-end' }}>
                        <button 
                            onClick={() => handleEdit(d)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 6, borderRadius: 4 }}
                        >
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
              ))}
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