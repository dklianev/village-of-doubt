import type { Metadata } from "next";
import { Suspense } from "react";
import { TutorialFlipbook } from "@/components/tutorial/TutorialFlipbook";
import { routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Първа игра — наръчник в шест сцени",
  description: "Кинематографичен наръчник за първа игра след вход. Шест сцени, един интерактивен момент, готов си за първата стая.",
  path: "/tutorial",
  image: "/game-art/og/og-tutorial.png",
  imageAlt: "Маса с книга, свещ и карти",
  ogDescription: "Една вечер, шест сцени. Научи масата преди първата нощ.",
});

export default function TutorialPage() {
  return (
    <main className="shell tutorial-shell">
      <Suspense fallback={null}>
        <TutorialFlipbook />
      </Suspense>
    </main>
  );
}
