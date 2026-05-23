import { ARTIFACT_SVG } from "@werewolf/ui/artifacts";
import { EmptyState, Pill } from "@werewolf/ui/server";
import { EMPTY_STATES } from "@werewolf/ui/states";
import { Masthead } from "./Masthead";

export function NewspaperEmpty() {
  const emptyState = EMPTY_STATES["leaderboard-empty"];
  const Artifact = ARTIFACT_SVG[emptyState.artifact];

  return (
    <article className="newspaper-page newspaper-page-empty" aria-label="Бъдещ брой">
      <Masthead issueCount={1} />

      <div className="leaderboard-empty-state">
        <EmptyState
          artifact={<Artifact size={144} />}
          title={emptyState.title}
          body={emptyState.body}
          action={
            emptyState.action?.href ? (
              <Pill as="a" href={emptyState.action.href}>
                {emptyState.action.label}
              </Pill>
            ) : null
          }
        />
      </div>
    </article>
  );
}
