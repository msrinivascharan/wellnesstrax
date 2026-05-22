import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WellnessTrax — Daily Health Intelligence",
  description: "AI-powered daily wellness tracking, nutrition, activity, and health analysis",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
