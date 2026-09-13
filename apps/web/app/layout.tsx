import type { Metadata } from "next";
import { ChevronDown, Menu, Moon, Play } from "lucide-react";
import { BrandLogo } from "@/components/site-chrome/BrandLogo";
import { Suspense } from "react";
import { NavigationTelemetry } from "@/components/navigation-telemetry";
import { NonCriticalWidgets } from "@/components/non-critical-widgets";
import { ResourceHints } from "@/components/resource-hints";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { SiteFooter } from "@/components/SiteFooter";
import SiteChrome from "@/components/site-chrome";
import { ToastHost } from "@/components/toast-host";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/seo";
import { displayFont, interfaceFont } from "./fonts";
import "./globals.css";

const themeInitScript = `(() => {
  try {
    const saved = window.localStorage.getItem("werewolf-theme") || "system";
    const resolved = saved === "light" || saved === "dark"
      ? saved
      : (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.dataset.theme = resolved;
  } catch {
    document.documentElement.dataset.theme = "dark";
  }
})();`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: "Върколак и Мафия онлайн с тайни роли, частни стаи и достатъчно причини да не вярваш на приятелите си.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: SITE_NAME,
    description: "Върколак и Мафия онлайн с тайни роли, частни стаи и достатъчно причини да не вярваш на приятелите си.",
    url: SITE_URL,
    siteName: SITE_NAME,
    images: [{ url: absoluteUrl("/game-art/og/og-home.png"), width: 1200, height: 630, alt: "Върколак и Мафия" }],
    locale: "bg_BG",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: "Върколак и Мафия онлайн с тайни роли, частни стаи и достатъчно причини да не вярваш на приятелите си.",
    images: [absoluteUrl("/game-art/og/og-home.png")],
  },
};

function SiteChromeFallback() {
  return (
    <header className="site-chrome" data-version="v2" data-fallback aria-hidden="true">
      <span className="site-mobile-menu"><Menu className="site-icon" aria-hidden /></span>
      <span className="site-brand"><BrandLogo /></span>
      <div className="site-primary-band">
        <span className="site-family-link">Върколак</span>
        <span className="site-family-link">Мафия</span>
        <span className="site-more-trigger">Още<ChevronDown className="site-icon" aria-hidden /></span>
      </div>
      <div className="site-entry-actions">
        <span className="site-join-link">Имам код</span>
        <span className="site-play-cta"><Play className="site-icon" aria-hidden /><span>Играй</span></span>
      </div>
      <div className="site-utility-cluster">
        <span className="site-icon-button"><Moon className="site-icon" aria-hidden /></span>
        <span className="site-utility-separator" aria-hidden />
        <span className="auth-chip-slot" data-auth-state="pending"><span className="auth-chip auth-chip-loading" /></span>
      </div>
      <span className="site-play-cta site-play-cta-mobile"><Play className="site-icon" aria-hidden /><span>Играй</span></span>
    </header>
  );
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bg" className={`${displayFont.variable} ${interfaceFont.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ResourceHints preconnect={["https://cdn.discordapp.com", "https://lh3.googleusercontent.com"]} />
        <a className="site-skip-link" href="#main-content">
          Към основното съдържание
        </a>
        <div className="site-chrome-boundary" suppressHydrationWarning>
          <Suspense fallback={<SiteChromeFallback />}>
            <SiteChrome />
          </Suspense>
        </div>
        <div id="main-content" className="site-main-content" tabIndex={-1}>
          {children}
        </div>
        <SiteFooter />
        <ToastHost />
        <Suspense fallback={null}>
          <NonCriticalWidgets initialSession={null} />
        </Suspense>
        <Suspense fallback={null}>
          <NavigationTelemetry />
        </Suspense>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
