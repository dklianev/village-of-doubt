import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailClient } from "@/components/auth/VerifyEmailClient";
import { ResourceHints } from "@/components/resource-hints";
import "@/components/auth/AuthRecovery.module.css";

export const metadata: Metadata = {
  title: "Потвърждение",
  description: "Потвърди имейла си за достъп до масата.",
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return (
    <main className="shell seal-shell auth-recovery-shell framed-shell">
      <ResourceHints images={["/game-art/auth/verify-email-seal.webp"]} />
      <div className="framed-shell-inner">
        <Suspense fallback={<p className="seal-loading">Восъкът се топи...</p>}>
          <VerifyEmailClient />
        </Suspense>
      </div>
    </main>
  );
}
