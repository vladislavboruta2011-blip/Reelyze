import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LocaleProvider } from "./locale-provider";
import { SessionProvider } from "./session-provider";
import { toSessionUser, type SessionUser } from "../lib/session-user";
import { createSupabaseServerClient } from "../lib/supabase/server";
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

// Never throws: if Supabase isn't configured yet, or the session check
// fails for any reason, the app renders anonymously — AuthNav shows
// "Sign in" the same as a genuine anonymous visit. This must stay safe
// because RootLayout wraps every page, including the fully anonymous
// landing and results pages.
async function getInitialSessionUser(): Promise<SessionUser | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return toSessionUser(user);
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialUser = await getInitialSessionUser();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SessionProvider initialUser={initialUser}>
          <LocaleProvider>{children}</LocaleProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
