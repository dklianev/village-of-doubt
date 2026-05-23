import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordClient } from "@/components/auth/ResetPasswordClient";
import { ResourceHints } from "@/components/resource-hints";

export const metadata: Metadata = {
  title: "Нов ключ | Върколак и Мафия",
  description: "Създай нова парола за твоето досие.",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <main className="shell forge-shell auth-recovery-shell framed-shell">
      <ResourceHints images={["/game-art/auth/reset-password-forge.webp"]} />
      <div className="framed-shell-inner">
        <Suspense fallback={<p className="forge-loading">Подготвяме ковачницата...</p>}>
          <ResetPasswordClient />
        </Suspense>
      </div>
    </main>
  );
}
