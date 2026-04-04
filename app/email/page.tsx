"use client";
import { useState } from "react";
import { Send, Plus, X } from "lucide-react";
import Toast from "@/components/Toast";

export default function EmailPage() {
  const [recipients, setRecipients] = useState<string[]>([""]);
  const [subject, setSubject] = useState("ATB Klassement — Week update");
  const [body, setBody] = useState("Beste,\n\nIn bijlage vindt u het klassement van de afgelopen wedstrijd.\n\nMet vriendelijke groeten,\nATB");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const handleSend = async () => {
    const validRecipients = recipients.filter((r) => r.includes("@"));
    if (validRecipients.length === 0) {
      setToast({ message: "Voeg minstens één geldig e-mailadres toe", type: "error" });
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients: validRecipients, subject, body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setToast({ message: `✓ E-mail verstuurd naar ${validRecipients.length} ontvanger(s)`, type: "success" });
    } catch (err: unknown) {
      setToast({ message: err instanceof Error ? err.message : "Fout bij versturen", type: "error" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 32, marginBottom: 6 }}>E-mail <span style={{ color: "var(--accent)" }}>Versturen</span></h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 32, fontSize: 14 }}>
        Stuur het huidige klassement als Excel-bijlage naar de ontvangers.
      </p>

      {/* Recipients */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <label style={{ display: "block", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
          Ontvangers
        </label>
        {recipients.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              className="input"
              type="email"
              placeholder="email@voorbeeld.be"
              style={{ flex: 1 }}
              value={r}
              onChange={(e) => setRecipients((prev) => prev.map((x, j) => j === i ? e.target.value : x))}
            />
            {recipients.length > 1 && (
              <button onClick={() => setRecipients((prev) => prev.filter((_, j) => j !== i))}
                style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", color: "var(--text-muted)", padding: "0 10px", transition: "color 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--red)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        <button className="btn-secondary" onClick={() => setRecipients((p) => [...p, ""])} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 12, marginTop: 4 }}>
          <Plus size={12} /> Ontvanger toevoegen
        </button>
      </div>

      {/* Subject */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <label style={{ display: "block", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
          Onderwerp
        </label>
        <input className="input" style={{ width: "100%" }} value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>

      {/* Body */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <label style={{ display: "block", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
          Bericht
        </label>
        <textarea
          className="input"
          rows={6}
          style={{ width: "100%", resize: "vertical", lineHeight: 1.6 }}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
          Het huidige klassement-Excel wordt automatisch als bijlage toegevoegd.
        </div>
      </div>

      <button className="btn-primary" onClick={handleSend} disabled={sending} style={{ width: "100%", padding: 14, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <Send size={16} />
        {sending ? "Versturen..." : "E-mail versturen"}
      </button>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
