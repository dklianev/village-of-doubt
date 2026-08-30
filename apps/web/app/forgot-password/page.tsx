import type { Metadata } from "next";
import { ForgotPasswordClient } from "@/components/auth/ForgotPasswordClient";
import { ResourceHints } from "@/components/resource-hints";
import "@/components/auth/AuthRecoveryBase.css";
import "@/components/auth/AuthRecovery.module.css";

export const metadata: Metadata = {
  title: "Загубен ключ",
  description: "Заяви нова парола за твоето досие във Върколак и Мафия.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <main className="shell locksmith-shell auth-recovery-shell framed-shell">
      <ResourceHints images={[{ href: "/game-art/auth/forgot-password-locksmith.webp", fetchPriority: "high" }]} />
      <div className="framed-shell-inner">
        <ForgotPasswordClient />
      </div>
    </main>
  );
}
