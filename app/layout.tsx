import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { cookies } from "next/headers";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "ATB Klassement",
  description: "ATB puntentelling & klassement beheer",
};



export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const isLoggedIn = cookieStore.has("auth-token");

  return (
    <html lang="nl">
      <body
      suppressHydrationWarning={true} style={{ 
        display: "flex", 
        height: "100vh", 
        overflow: "hidden", 
        margin: 0,
        background: "var(--background)" 
        
      }}>
        {/* Sidebar remains fixed on the left */}
        <Sidebar isAdmin={isLoggedIn} />

        {/* Main wrapper: Vertical flex to stack Header and Content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
          <Header isAdmin={isLoggedIn} />
          
          <main style={{ 
            flex: 1, 
            padding: "32px", 
            overflowY: "auto", // Only this area scrolls
            background: "var(--background)" 
          }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
