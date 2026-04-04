import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "ATB Klassement",
  description: "ATB puntentelling & klassement beheer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar />
        <main style={{ flex: 1, padding: "32px", overflowY: "auto", minHeight: "100vh" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
