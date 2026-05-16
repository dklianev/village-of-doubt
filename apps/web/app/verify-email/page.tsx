import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailClient } from "@/components/auth/VerifyEmailClient";

export const metadata: Metadata = {
  title: "Потвърждение | Върколак и Мафия",
  description: "Потвърди имейла си за достъп до масата.",
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return (
    <main className="shell seal-shell">
      <Suspense fallback={<p className="seal-loading">Восъкът се топи...</p>}>
        <VerifyEmailClient />
      </Suspense>
    </main>
  );
}
