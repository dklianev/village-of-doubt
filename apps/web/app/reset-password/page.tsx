import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordClient } from "@/components/auth/ResetPasswordClient";
import { ResourceHints } from "@/components/resource-hints";
import "@/components/auth/AuthRecoveryBase.css";
import "@/components/auth/AuthRecovery.module.css";

export const metadata: Metadata = {
  title: "Нов ключ",
  description: "Създай нова парола за твоето досие.",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <main className="shell forge-shell auth-recovery-shell framed-shell">
      <ResourceHints images={[{ href: "/game-art/auth/reset-password-forge.webp", fetchPriority: "high" }]} />
      <div className="framed-shell-inner">
        <Suspense fallback={<p className="forge-loading">Подготвяме ковачницата...</p>}>
          <ResetPasswordClient />
        </Suspense>
      </div>
    </main>
  );
}
