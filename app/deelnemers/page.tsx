"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { UserPlus, Trash2, Upload, Search } from "lucide-react";
import Toast from "@/components/Toast";
import { Deelnemer, normalizeKlasse } from "@/lib/utils";

export default function DeelnemersPage() {
  const [deelnemers, setDeelnemers] = useState<Deelnemer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Deelnemer>>({ categorie: "STA" });
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchDeelnemers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/deelnemers");
    const json = await res.json();
    setDeelnemers(json ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDeelnemers(); }, [fetchDeelnemers]);

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
    const res = await fetch("/api/deelnemers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) {
      setToast({ message: "✓ Deelnemer opgeslagen", type: "success" });
      setShowForm(false);
      setForm({ categorie: "STA" });
      fetchDeelnemers();
    } else {
      const json = await res.json();
      setToast({ message: json.error, type: "error" });
    }
    setSaving(false);
  };

  const handleDelete = async (bib: number) => {
    if (!confirm(`Verwijder deelnemer ${bib}?`)) return;
    const res = await fetch("/api/deelnemers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bib }) });
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
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleFileUpload} />
          <button className="btn-secondary" onClick={() => fileRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Upload size={14} /> Excel importeren
          </button>
          <button className="btn-primary" onClick={() => setShowForm(!showForm)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <UserPlus size={14} /> Toevoegen
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, marginBottom: 16 }}>Nieuwe deelnemer</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
            {[
              { key: "bib", label: "Startnummer", type: "number", placeholder: "101" },
              { key: "naam", label: "Naam", type: "text", placeholder: "Jan Janssen" },
              { key: "klasse", label: "Klasse", type: "text", placeholder: "A40+" },
              { key: "team", label: "Team", type: "text", placeholder: "Team naam" },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label style={{ display: "block", fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>{label}</label>
                <input className="input" type={type} placeholder={placeholder} style={{ width: "100%" }}
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
            <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Opslaan..." : "Opslaan"}</button>
            <button className="btn-secondary" onClick={() => { setShowForm(false); setForm({ categorie: "STA" }); }}>Annuleren</button>
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
                <th></th>
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
                  <td>
                    <button onClick={() => handleDelete(d.bib)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, borderRadius: 4, transition: "color 0.15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--red)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>
                      <Trash2 size={14} />
                    </button>
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
