import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HYPE Tracking System",
  description: "Merchant Activation & Campaign Tracking — HYPE Media Indonesia",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
