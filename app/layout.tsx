import { ReactNode } from "react";
import { Anton, Barlow } from "next/font/google";
import { Providers } from "@/app/providers";
import type { Metadata, Viewport } from "next";
import "./globals.css";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
});

// Anton is loaded for numerals in the logger, which reference it through
// `[font-family:var(--font-anton)]`. Dropping it here degrades every weight,
// rep count and timer to system sans with no error.
const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
});

export const metadata: Metadata = {
  title: "Train",
  description: "Personal training tracker",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-192x192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Train",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0e16",
  // Android: shrink the layout viewport when the keyboard opens so the fixed
  // rest-timer bar stays visible. iOS ignores this (known limitation).
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Dark, phone-first shell for logging mid-workout. Barlow for text, Anton
  // for numerals. No service worker: a stale cached shell mid-workout is worse
  // than waiting for the network.
  return (
    <html lang="en">
      <body
        className={`${barlow.variable} ${anton.variable} min-h-dvh bg-[#0a0e16] text-neutral-50 selection:bg-cta/40`}
        style={{ fontFamily: "var(--font-barlow), system-ui, sans-serif" }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
