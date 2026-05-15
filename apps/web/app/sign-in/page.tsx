import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInStage } from "@/components/sign-in/SignInStage";

export const metadata: Metadata = {
  title: "Влез в стаята | Върколак и Мафия",
  description: "Влез с Google, Discord или имейл, за да отвориш частна маса и да пазиш записаните игри.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<{ redirect?: string | string[] }>;
}) {
  const params = await searchParams;
  const redirect = Array.isArray(params?.redirect) ? params.redirect[0] : params?.redirect;

  return (
    <main className="shell sign-in-shell">
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
