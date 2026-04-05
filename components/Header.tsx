"use client";
import { User, LogIn, LogOut } from "lucide-react";
import Link from "next/link";
import { logout } from "@/app/actions/auth";

export default function Header({ isAdmin }: { isAdmin: boolean }) {
  return (
    <header style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      padding: "16px 32px",
      background: "var(--surface)",
      borderBottom: "1px solid var(--border)",
      height: "64px",
      flexShrink: 0
    }}>
  
      {/* Auth Section */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {isAdmin ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Admin User</div>
              <div style={{ fontSize: 11, color: "var(--accent)" }}>Ingelogd</div>
            </div>
            <div style={{ 
              width: 32, height: 32, borderRadius: "50%", 
              background: "var(--border)", display: "flex", 
              alignItems: "center", justifyContent: "center" 
            }}>
              <User size={18} color="var(--text-muted)" />
            </div>
            <form action={logout}>
              <button type="submit" style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-muted)", display: "flex", alignItems: "center"
              }}>
                <LogOut size={18} />
              </button>
            </form>
          </div>
        ) : (
          <Link href="/login" style={{
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 6,
            background: "var(--accent)",
            color: "#0f1117",
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 800,
            fontSize: 13,
            textTransform: "uppercase"
          }}>
            <LogIn size={16} />
            Inloggen
          </Link>
        )}
      </div>
    </header>
  );
}