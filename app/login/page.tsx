"use client";

import { login } from "@/app/actions/auth";
import { useState } from "react";
import { Trophy, Lock, User as UserIcon, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function clientAction(formData: FormData) {
    setLoading(true);
    setError("");
    const result = await login(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      minHeight: "calc(100vh - 128px)", // Centers it within the scrollable area
    }}>
      <div style={{ 
        width: "100%", 
        maxWidth: "400px", 
        background: "var(--surface)", 
        border: "1px solid var(--border)", 
        borderRadius: "12px",
        padding: "40px",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)"
      }}>
        {/* Header/Logo section */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{
            width: 48, height: 48, borderRadius: 10,
            background: "var(--accent)", display: "flex",
            alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px"
          }}>
            <Trophy size={24} color="#0f1117" />
          </div>
          <h1 style={{ 
            fontFamily: "'Barlow Condensed', sans-serif", 
            fontWeight: 800, 
            fontSize: 24, 
            letterSpacing: "0.05em", 
            textTransform: "uppercase", 
            color: "var(--text)",
            margin: 0
          }}>
            Admin Login
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Beheer het klassement en deelnemers
          </p>
        </div>

        <form action={clientAction} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Username Input */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ 
              fontSize: 11, 
              color: "var(--text-muted)", 
              textTransform: "uppercase", 
              fontWeight: 700, 
              letterSpacing: "0.05em" 
            }}>
              Gebruikersnaam
            </label>
            <div style={{ position: "relative" }}>
              <UserIcon size={16} style={{ position: "absolute", left: 12, top: 12, color: "var(--text-muted)" }} />
              <input 
                name="username" 
                type="text"
                placeholder="admin" 
                style={{ 
                  width: "100%", padding: "10px 12px 10px 40px", borderRadius: 6,
                  background: "var(--background)", border: "1px solid var(--border)",
                  color: "var(--text)", outline: "none", transition: "border-color 0.2s"
                }} 
                required 
              />
            </div>
          </div>

          {/* Password Input */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ 
              fontSize: 11, 
              color: "var(--text-muted)", 
              textTransform: "uppercase", 
              fontWeight: 700, 
              letterSpacing: "0.05em" 
            }}>
              Wachtwoord
            </label>
            <div style={{ position: "relative" }}>
              <Lock size={16} style={{ position: "absolute", left: 12, top: 12, color: "var(--text-muted)" }} />
              <input 
                name="password" 
                type="password"
                placeholder="••••••••" 
                style={{ 
                  width: "100%", padding: "10px 12px 10px 40px", borderRadius: 6,
                  background: "var(--background)", border: "1px solid var(--border)",
                  color: "var(--text)", outline: "none"
                }} 
                required 
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div style={{ 
              display: "flex", alignItems: "center", gap: 8, 
              color: "#ff4d4d", fontSize: 13, background: "rgba(255, 77, 77, 0.1)",
              padding: "10px", borderRadius: 6, border: "1px solid rgba(255, 77, 77, 0.2)"
            }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              background: loading ? "var(--border)" : "var(--accent)", 
              color: "#0f1117", 
              padding: "12px", 
              borderRadius: 6, 
              border: "none",
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 800,
              fontSize: 15,
              textTransform: "uppercase",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "transform 0.1s, opacity 0.2s",
              marginTop: "10px"
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            {loading ? "Bezig met inloggen..." : "Inloggen"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "24px" }}>
          <a href="/" style={{ color: "var(--text-muted)", fontSize: 12, textDecoration: "none" }}>
            ← Terug naar klassement
          </a>
        </div>
      </div>
    </div>
  );
}