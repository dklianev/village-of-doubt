import type { Metadata } from "next";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000"),
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bg" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <SiteChrome />
        {children}
        <ToastHost />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
