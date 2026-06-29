import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Climpy — YouTube Shorts Script Analyzer",
    template: "%s | Climpy",
  },
  description:
    "Analyze YouTube Shorts scripts before publishing. Get hook scoring, retention risk, risky timestamps, and specific fixes.",
  verification: {
  google: "IO-mo2mPD8RyYDpwiPPi6W9-7y4pcOmHMOBfpV0bOTs",
},
    icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Climpy — YouTube Shorts Script Analyzer",
    description:
      "Get hook scoring, retention risk, risky timestamps, and specific fixes before your Short goes live.",
    siteName: "Climpy",
    type: "website",
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
