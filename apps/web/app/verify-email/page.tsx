import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailClient } from "@/components/auth/VerifyEmailClient";
import { ResourceHints } from "@/components/resource-hints";

export const metadata: Metadata = {
  title: "Потвърждение | Върколак и Мафия",
  description: "Потвърди имейла си за достъп до масата.",
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return (
    <main className="shell seal-shell">
      <ResourceHints images={["/game-art/auth/verify-email-seal.webp"]} />
      <Suspense fallback={<p className="seal-loading">Восъкът се топи...</p>}>
        <VerifyEmailClient />
      </Suspense>
    </main>
  );
}
