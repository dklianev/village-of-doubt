import type { Metadata } from "next";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import type { AuthSessionView } from "@/lib/use-auth-session";
import { CookieBanner } from "@/components/CookieBanner";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { SiteFooter } from "@/components/SiteFooter";
import SiteChrome from "@/components/site-chrome";
import { ToastHost } from "@/components/toast-host";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/seo";
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
  description: "Онлайн Върколак и Мафия с тайни роли, частни стаи и авторитетен игрови сървър.",
  alternates: { canonical: SITE_URL },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/favicon.svg",
  },
  openGraph: {
    title: SITE_NAME,
    description: "Онлайн Върколак и Мафия с тайни роли, частни стаи и авторитетен игрови сървър.",
    url: SITE_URL,
    siteName: SITE_NAME,
    images: [{ url: absoluteUrl("/game-art/og/og-home.png"), width: 1200, height: 630, alt: "Върколак и Мафия" }],
    locale: "bg_BG",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: "Онлайн Върколак и Мафия с тайни роли, частни стаи и авторитетен игрови сървър.",
    images: [absoluteUrl("/game-art/og/og-home.png")],
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth.api.getSession({ headers: await headers() });
  const chromeSession: AuthSessionView | null = session?.user?.id
    ? {
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          image: session.user.image ?? null,
        },
      }
    : null;

  return (
    <html lang="bg" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <SiteChrome initialSession={chromeSession} />
        {children}
        <SiteFooter />
        <CookieBanner />
        <ToastHost />
        <WelcomeModal />
        <FeedbackWidget />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
