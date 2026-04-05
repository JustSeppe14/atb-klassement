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
      <body style={{ 
        display: "flex", 
        height: "100vh",      // Lock the total height to the viewport
        overflow: "hidden",   // Prevent the whole page from scrolling
        margin: 0             // Remove default browser margins
      }}>
        {/* Sidebar stays fixed because body is height 100vh */}
        <Sidebar />

        {/* Main scrolls internally */}
        <main style={{ 
          flex: 1, 
          padding: "32px", 
          overflowY: "auto",   // Allow vertical scrolling here
          height: "100%"       // Fill the body height
        }}>
          {children}
        </main>
      </body>
    </html>
  );
}
