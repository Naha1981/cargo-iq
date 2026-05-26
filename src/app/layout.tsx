import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CargoIQ — AI Compliance & Cost Containment for CargoWise",
  description:
    "South Africa's AI compliance and cost containment platform for freight forwarders and customs brokers. Purpose-built for the WiseTech Value Pack pricing environment and SARS's 2025/2026 enforcement regime.",
  keywords: [
    "CargoIQ",
    "CargoWise",
    "SARS",
    "compliance",
    "freight forwarding",
    "customs broker",
    "South Africa",
    "WiseTech",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif" }}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
