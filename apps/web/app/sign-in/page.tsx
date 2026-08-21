import type { Metadata } from "next";
import { Suspense } from "react";
import { ResourceHints } from "@/components/resource-hints";
import { SignInStage } from "@/components/sign-in/SignInStage";
import { routeMetadata } from "@/lib/seo";
import { safeInternalRedirect } from "@/lib/safe-internal-redirect";

export const metadata: Metadata = routeMetadata({
  title: "Вход — седни на масата",
  description: "Влез с Google, Discord или имейл. Едно досие пази историята, легендите и поканите за частни стаи.",
  path: "/sign-in",
  image: "/game-art/og/og-sign-in.png",
  imageAlt: "Карти, свещ и ключ върху дървена маса",
  ogDescription: "Влез с Google, Discord или имейл и отвори частна маса.",
});

export const instant = false;

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<{ redirect?: string | string[] }>;
}) {
  const params = await searchParams;
  const redirect = Array.isArray(params?.redirect) ? params.redirect[0] : params?.redirect;

  return (
    <main className="shell sign-in-shell">
      <ResourceHints
        images={[
          {
            href: "/game-art/sign-in-table.webp",
            media: "(min-width: 721px)",
            fetchPriority: "high",
          },
          {
            href: "/game-art/mobile/sign-in-table.webp",
            media: "(max-width: 720px)",
            fetchPriority: "high",
          },
        ]}
      />
      <Suspense fallback={<div className="sign-in-loading">Подреждаме масата...</div>}>
        <SignInStage redirectTo={safeInternalRedirect(redirect)} />
      </Suspense>
    </main>
  );
}
