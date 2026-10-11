import { ButtonLink } from "@/components/button-link";
import { lazy, Suspense } from "react";
import { getGameFamily } from "@werewolf/shared";
import type { GameConclusionProps } from "./GameConclusion";

const Conclusion = lazy(() => import("./GameConclusion")
  .then((module) => ({ default: module.GameConclusion }))
  .catch(() => ({ default: ConclusionUnavailable })));

function ConclusionUnavailable({ snapshot }: GameConclusionProps) {
  const path = getGameFamily(snapshot.mode) === "mafia" ? "mafia" : "werewolf";
  return <section className="play-finale-fallback">
    <h1 tabIndex={-1}>Край на играта</h1>
    <p>{snapshot.winnerReasonBg}</p>
    <p role="status">Обобщението не се зареди. Продължи към архива или нова игра.</p>
    <ButtonLink href={`/${path}/create`}>Нова игра</ButtonLink>{" "}
    <ButtonLink variant="secondary" href="/history">Към архива</ButtonLink>
  </section>;
}

export function DeferredGameConclusion(props: GameConclusionProps) {
  return <Suspense fallback={<section className="play-finale-fallback" role="status">Разкриваме лицата зад сенките...</section>}>
    <Conclusion {...props} />
  </Suspense>;
}
