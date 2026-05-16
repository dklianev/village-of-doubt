import type { Metadata } from "next";
import { ForgotPasswordClient } from "@/components/auth/ForgotPasswordClient";
import { ResourceHints } from "@/components/resource-hints";

export const metadata: Metadata = {
  title: "Загубен ключ | Върколак и Мафия",
  description: "Заяви нова парола за твоя профил във Върколак и Мафия.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <main className="shell locksmith-shell">
      <ResourceHints images={["/game-art/auth/forgot-password-locksmith.webp"]} />
      <ForgotPasswordClient />
    </main>
  );
}
