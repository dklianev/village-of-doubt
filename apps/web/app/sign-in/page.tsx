import type { Metadata } from "next";
import { Suspense } from "react";
import { ResourceHints } from "@/components/resource-hints";
import { SignInStage } from "@/components/sign-in/SignInStage";
import { routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Вход — седни на масата",
  description: "Влез с Google, Discord или имейл. Един профил пази историята, постиженията и поканите за частни стаи.",
  path: "/sign-in",
  image: "/game-art/og/og-sign-in.png",
  imageAlt: "Карти, свещ и ключ върху дървена маса",
  ogDescription: "Влез с Google, Discord или имейл и отвори частна маса.",
});

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<{ redirect?: string | string[] }>;
}) {
  const params = await searchParams;
  const redirect = Array.isArray(params?.redirect) ? params.redirect[0] : params?.redirect;

  return (
    <main className="shell sign-in-shell">
      <ResourceHints images={["/game-art/sign-in-table.webp"]} />
      <Suspense fallback={<div className="sign-in-loading">Подреждаме масата...</div>}>
        <SignInStage redirectTo={safeRedirect(redirect)} />
      </Suspense>
    </main>
  );
}

function safeRedirect(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}
