import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NutriBot — Daily Nutrition Intelligence",
  description: "AI-powered cardiac-safe daily nutrition tracking and analysis",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
