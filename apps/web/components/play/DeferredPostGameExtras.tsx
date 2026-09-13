import Link from "next/link";
import { lazy, Suspense } from "react";
import { getGameFamily } from "@werewolf/shared";
import type { PostGameExtrasProps } from "./PostGameExtras";

const Extras = lazy(() => import("./PostGameExtras")
  .then((module) => ({ default: module.PostGameExtras }))
  // A missing optional chunk must leave the result and a way out usable.
  .catch(() => ({ default: ExtrasUnavailable })));

function ExtrasUnavailable({ section, snapshot }: PostGameExtrasProps) {
  if (section === "story") return null;
  const familyPath = getGameFamily(snapshot.mode) === "mafia" ? "mafia" : "werewolf";
  return (
    <>
      <p role="status">Обобщението не се зареди. Можеш да започнеш нова игра или да отвориш архива.</p>
      <div className="play-winner-actions">
        <Link className="btn btn-primary" href={`/${familyPath}/create`}>Нова игра</Link>
        <Link className="btn btn-secondary" href="/history">Към архива</Link>
      </div>
    </>
  );
}

export function DeferredPostGameExtras(props: PostGameExtrasProps) {
  return (
    <Suspense fallback={props.section === "actions" ? <p role="status">Зареждаме обобщението...</p> : null}>
      <Extras {...props} />
    </Suspense>
  );
}
