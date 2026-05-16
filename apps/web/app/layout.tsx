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

function resolveMetadataBase(): URL {
  const candidate = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL;

  if (process.env.NODE_ENV === "production" && !candidate) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL или BETTER_AUTH_URL трябва да са зададени в production среда. Иначе social media preview-та и абсолютните URLs ще сочат към localhost.",
    );
  }

  return new URL(candidate ?? "http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: "Върколак и Мафия",
  description: "Онлайн Върколак и Мафия с тайни роли, частни стаи и авторитетен игрови сървър.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "Върколак и Мафия",
    description: "Онлайн Върколак и Мафия с тайни роли, частни стаи и авторитетен игрови сървър.",
    images: [{ url: "/game-art/og-preview.png", width: 1024, height: 1024, alt: "Върколак" }],
    locale: "bg_BG",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Върколак и Мафия",
    description: "Онлайн Върколак и Мафия с тайни роли, частни стаи и авторитетен игрови сървър.",
    images: ["/game-art/og-preview.png"],
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
