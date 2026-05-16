import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordClient } from "@/components/auth/ResetPasswordClient";

export const metadata: Metadata = {
  title: "Нов ключ | Върколак и Мафия",
  description: "Създай нова парола за твоя профил.",
};

export default function ResetPasswordPage() {
  return (
    <main className="shell forge-shell">
      <Suspense fallback={<p className="forge-loading">Подготвяме ковачницата...</p>}>
        <ResetPasswordClient />
      </Suspense>
    </main>
  );
}
