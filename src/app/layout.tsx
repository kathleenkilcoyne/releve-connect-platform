import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import AdminConsoleLink from "./AdminConsoleLink";
import ProfessionalNav from "./ProfessionalNav";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Relevé Connect",
  description:
    "National infrastructure for the dance industry — where dance professionals are found.",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Admin-only, server-gated. Renders null for everyone else. */}
        <AdminConsoleLink />
        {/* Professionals only, server-gated (Slice 0b). Null for families/studios,
            so the founding-studio pilot surfaces are untouched. */}
        <ProfessionalNav />
        {children}
        <Analytics />
        {/* HubSpot tracking code, portal 246998651 (id must stay "hs-script-loader" — HubSpot's
            own validator and some HubSpot features key off this exact id). */}
        <Script
          id="hs-script-loader"
          src="https://js-na2.hs-scripts.com/246998651.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
