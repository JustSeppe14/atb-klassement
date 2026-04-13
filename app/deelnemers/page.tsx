"use client";

import React, { useEffect, useState } from "react";
import {
  Trash2,
  Search,
  Edit2,
  History,
  ChevronDown,
  ChevronUp,
  Upload,
  Download,
  RefreshCw,
  UserPlus,
} from "lucide-react";

import Toast from "@/components/Toast";
import { Deelnemer, normalizeKlasse } from "@/lib/utils";
import * as XLSX from "xlsx";

interface KlasseSwitch {
  id: number;
  bib: number;
  old_klasse: string;
  new_klasse: string;
  from_week: number | null;
  changed_at: string;
}

export default function DeelnemersPage() {
  const [deelnemers, setDeelnemers] = useState<Deelnemer[]>([]);
  const [switches, setSwitches] = useState<KlasseSwitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<any>(null);

  const [expandedBib, setExpandedBib] = useState<number | null>(null);
  const [editingBib, setEditingBib] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<Deelnemer>>({ categorie: "STA" });

  useEffect(() => {
    reload();
  }, []);

  const reload = async () => {
    setLoading(true);
    try {
      const [dRes, sRes] = await Promise.all([
        fetch("/api/deelnemers"),
        fetch("/api/klasse-history"),
      ]);

      setDeelnemers((await dRes.json()) ?? []);
      setSwitches((await sRes.json()) ?? []);
    } finally {
      setLoading(false);
    }
  };

  const switchesByBib = new Map<number, KlasseSwitch[]>();
  for (const sw of switches) {
    const list = switchesByBib.get(sw.bib) ?? [];
    list.push(sw);
    switchesByBib.set(sw.bib, list);
  }

  const handleExport = () => {
    const data = deelnemers.map((d) => ({
      Nr: d.bib,
      Naam: d.naam,
      Klasse: d.klasse,
      Cat: d.categorie,
      Team: d.team ?? "-",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Deelnemers");
    XLSX.writeFile(wb, "deelnemers.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fd = new FormData();
    fd.append("file", file);

    await fetch("/api/deelnemers", { method: "POST", body: fd });
    await reload();
  };

  const handleSync = async () => {
    await fetch("/api/sync-deelnemers", { method: "POST" });
    setToast({ message: "✓ Gesynchroniseerd", type: "success" });
    await reload();
  };

  const handleSave = async () => {
    if (!form.bib || !form.naam || !form.klasse) {
      setToast({ message: "Vul alle velden in", type: "error" });
      return;
    }

    const payload = {
      ...form,
      klasse: normalizeKlasse(form.klasse!),
    };

    await fetch("/api/deelnemers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setEditingBib(null);
    await reload();
  };

  const handleDelete = async (bib: number) => {
    if (!confirm("Verwijderen?")) return;

    await fetch("/api/deelnemers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bib }),
    });

    await reload();
  };

  const filtered = deelnemers.filter(
    (d) =>
      search === "" ||
      d.naam.toLowerCase().includes(search.toLowerCase()) ||
      String(d.bib).includes(search) ||
      d.klasse.toLowerCase().includes(search.toLowerCase()) ||
      d.team?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>
          Deelnemers <span style={{ color: "var(--accent)" }}>{deelnemers.length}</span>
        </h1>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-secondary" onClick={handleExport}>
            <Download size={14} /> Export
          </button>

          <label className="btn-secondary" style={{ cursor: "pointer" }}>
            <Upload size={14} /> Import
            <input type="file" accept=".xlsx,.xls" hidden onChange={handleFileUpload} />
          </label>

          <button className="btn-secondary" onClick={handleSync}>
            <RefreshCw size={14} /> Sync
          </button>

          <button
            className="btn-primary"
            onClick={() => {
              setExpandedBib(null);
              setEditingBib(null);
              setForm({ categorie: "STA" });
            }}
          >
            <UserPlus size={14} /> Toevoegen
          </button>
        </div>
      </div>

      <div style={{ position: "relative", marginBottom: 16 }}>
        <Search
          size={14}
          style={{
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-muted)",
          }}
        />
        <input
          className="input"
          placeholder="Zoeken..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: 30 }}
        />
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 40 }}>Laden...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nr</th>
                <th>Naam</th>
                <th>Klasse</th>
                <th>Cat</th>
                <th>Team</th>
                <th style={{ textAlign: "right" }}>Acties</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((d) => {
                const isOpen = expandedBib === d.bib;
                const isEdit = editingBib === d.bib;
                const hist = switchesByBib.get(d.bib) ?? [];

                return (
                  <React.Fragment key={d.bib}>
                    <tr>
                      <td style={{ color: "var(--accent)", fontWeight: 700 }}>{d.bib}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          {d.naam}
                         <button
  onClick={() => setExpandedBib(isOpen ? null : d.bib)}
  style={{
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 11,
    padding: "1px 6px",
    display: "flex",
    gap: 4,
    alignItems: "center",
    cursor: "pointer",
    color: "var(--accent)",
  }}
>
  <History size={10} />
  {hist.length}
  {isOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
</button>
                        </div>
                      </td>
                      <td>{d.klasse}</td>
                      <td>{d.categorie}</td>
                      <td>{d.team ?? "-"}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          onClick={() => {
                            setEditingBib(d.bib);
                            setExpandedBib(d.bib);
                            setForm(d);
                          }}
                          style={{ color: "#facc15", background: "none", border: "none", marginRight: 6 }}
                        >
                          <Edit2 size={16} />
                        </button>

                        <button
                          onClick={() => handleDelete(d.bib)}
                          style={{ color: "#ef4444", background: "none", border: "none" }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr>
                        <td colSpan={6}>
                          <div style={{ padding: 12, background: "var(--surface-2)" }}>

                            {/* ✅ EDIT FORM (FIXED SPACING) */}
                            {isEdit && (
                              <div
  className="card"
  style={{
    padding: 12,
    display: "flex",
    gap: 10,
    width: "100%",
    alignItems: "center",
    flexWrap: "wrap",
  }}
>
                               <input
  className="input"
  style={{ flex: 2, minWidth: 160 }}
  value={form.naam ?? ""}
  onChange={(e) =>
    setForm((f) => ({ ...f, naam: e.target.value }))
  }
/>

                               <select
  className="input"
  style={{ flex: 1, minWidth: 120 }}
  value={form.klasse ?? ""}
  onChange={(e) =>
    setForm((f) => ({
      ...f,
      klasse: e.target.value as Deelnemer["klasse"],
    }))
  }
>
                                  <option value="">Klasse</option>
                                  <option value="A">A</option>
                                  <option value="A40+">A40+</option>
                                  <option value="B">B</option>
                                  <option value="B50+">B50+</option>
                                  <option value="C">C</option>
                                  <option value="D">D</option>
                                  <option value="E">E</option>
                                </select>

                                <select
  className="input"
  style={{ flex: 1, minWidth: 120 }}
  value={form.categorie ?? "STA"}
  onChange={(e) =>
    setForm((f) => ({
      ...f,
      categorie: e.target.value as Deelnemer["categorie"],
    }))
  }
>
                                  <option value="STA">STA</option>
                                  <option value="SEN">SEN</option>
                                  <option value="DAM">DAM</option>
                                </select>

                                <input
  className="input"
  style={{ flex: 1, minWidth: 120 }}
  value={form.team ?? ""}
  onChange={(e) =>
    setForm((f) => ({ ...f, team: e.target.value }))
  }
/>

                                <div style={{ display: "flex", alignItems: "center" }}>
  <button className="btn-primary" onClick={handleSave}>
    Opslaan
  </button>
</div>
                              </div>
                            )}

                            {/* HISTORY */}
                            {hist.length > 0 ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {hist.map((sw) => (
                                  <div key={sw.id} style={{ fontSize: 13 }}>
                                    {sw.old_klasse} → {sw.new_klasse}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                Geen klassewissels
                              </div>
                            )}

                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}