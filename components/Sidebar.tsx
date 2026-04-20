"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, Upload, Users, Mail, Settings, 
  Download, Trophy, LogOut, LogIn 
} from "lucide-react";
import { logout } from "@/app/actions/auth";

// Define all possible links
const allNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, protected: false },
  { href: "/upload", label: "Uitslag uploaden", icon: Upload, protected: true },
  { href: "/deelnemers", label: "Deelnemers", icon: Users, protected: true },
  {href: '/startlijst', label: "Startlijst", icon: Users, protected: true},
  { href: "/email", label: "E-mail versturen", icon: Mail, protected: true },
  { href: "/instellingen", label: "Instellingen", icon: Settings, protected: true },
];

export default function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();

  // Filter items: show if not protected OR if user is admin
  const visibleNav = allNavItems.filter(item => !item.protected || isAdmin);

  return (
    <aside style={{
      width: "var(--side-bar-width)", height: "100vh", background: "var(--surface)",
      borderRight: "1px solid var(--border)", display: "flex",
      flexDirection: "column", padding: "0 0 24px 0", flexShrink: 0,
    }}>
      {/* Logo Section */}
      <div style={{ padding: "28px 20px 24px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: "var(--accent)", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}>
            <Trophy size={20} color="#0f1117" />
          </div>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text)" }}>ATB</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.08em", textTransform: "uppercase" }}>Klassement</div>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={{ flex: 1, padding: "16px 12px" }}>
        {visibleNav.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== "/" && path.startsWith(href));
          return (
            <Link key={href} href={href} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 6, marginBottom: 2,
              background: active ? "rgba(232,162,23,0.12)" : "transparent",
              color: active ? "var(--accent)" : "var(--text-muted)",
              textDecoration: "none", fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700, fontSize: 14, letterSpacing: "0.06em",
              textTransform: "uppercase", transition: "all 0.15s",
              borderLeft: active ? "3px solid var(--accent)" : "3px solid transparent",
            }}>
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Actions (Excel & Auth) */}
        {isAdmin && (<a href="/api/download-excel" style={{ textDecoration: "none" }}>
          <button className="btn-secondary" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Download size={14} />
            Download Excel
          </button>
        </a>)}
        

        
      
    </aside>
  );
}