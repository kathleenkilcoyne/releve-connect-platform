import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
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

// Editorial display serif — the Relevé "voice" for names and section headings.
// Warm, high-contrast, and premium; paired with Geist for UI/body text. Applied
// selectively via `font-serif`, so it never touches forms or the pilot surfaces.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
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
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Admin-only, server-gated. Renders null for everyone else. */}
        <AdminConsoleLink />
        {/* Professionals only, server-gated (Slice 0b). Null for families/studios,
            so the founding-studio pilot surfaces are untouched. */}
        <ProfessionalNav />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
