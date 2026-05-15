import type { Metadata } from "next";
import { Suspense } from "react";
import { TutorialFlipbook } from "@/components/tutorial/TutorialFlipbook";

export const metadata: Metadata = {
  title: "Първа игра | Върколак и Мафия",
  description: "Кинематографичен наръчник за първа игра без регистрация - една вечер в шест сцени.",
};

export default function TutorialPage() {
  return (
    <main className="shell tutorial-shell">
      <Suspense fallback={null}>
        <TutorialFlipbook />
      </Suspense>
    </main>
  );
}
