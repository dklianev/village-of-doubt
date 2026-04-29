import type { Metadata } from "next";
import { SiteChrome } from "@/components/site-chrome";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000"),
  title: "Върколак",
  description: "Онлайн Върколак и Мафия с тайни роли, частни стаи и авторитетен игрови сървър.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "Върколак",
    description: "Онлайн Върколак и Мафия с тайни роли, частни стаи и авторитетен игрови сървър.",
    images: [{ url: "/game-art/og-preview.png", width: 1024, height: 1024, alt: "Върколак" }],
    locale: "bg_BG",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Върколак",
    description: "Онлайн Върколак и Мафия с тайни роли, частни стаи и авторитетен игрови сървър.",
    images: ["/game-art/og-preview.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bg">
      <body>
        <SiteChrome />
        {children}
      </body>
    </html>
  );
}
