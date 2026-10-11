import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInStage } from "@/components/sign-in/SignInStage";
import { routeMetadata } from "@/lib/seo";
import { safeInternalRedirect } from "@/lib/safe-internal-redirect";

export const metadata: Metadata = routeMetadata({
  title: "Вход",
  description: "Влез в Сенките с Google, Discord или имейл. Събери компанията за Върколак и Мафия.",
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
    <main className="sign-in-shell">
      <Suspense fallback={<div className="sign-in-loading" role="status">Зареждаме входа...</div>}>
        <SignInStage redirectTo={safeInternalRedirect(redirect)} />
      </Suspense>
    </main>
  );
}
