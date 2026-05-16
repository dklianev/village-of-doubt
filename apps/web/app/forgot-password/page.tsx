import type { Metadata } from "next";
import { ForgotPasswordClient } from "@/components/auth/ForgotPasswordClient";

export const metadata: Metadata = {
  title: "Загубен ключ | Върколак и Мафия",
  description: "Заяви нова парола за твоя профил във Върколак и Мафия.",
};

export default function ForgotPasswordPage() {
  return (
    <main className="shell locksmith-shell">
      <ForgotPasswordClient />
    </main>
  );
}
