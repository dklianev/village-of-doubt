import { EmptyState, Pill } from "@werewolf/ui";
import { EMPTY_STATES } from "@werewolf/ui/states";
import { ArtifactImage } from "@/components/ArtifactImage";

const historyEmpty = EMPTY_STATES["history-empty"];

export function EvidenceWallEmpty() {
  return (
    <section className="evidence-empty">
      <EmptyState
        artifact={<ArtifactImage artifact={historyEmpty.artifact} />}
        title={historyEmpty.title}
        body={historyEmpty.body}
        action={
          historyEmpty.action ? (
            <Pill as="a" href={historyEmpty.action.href ?? "/create"}>
              {historyEmpty.action.label}
            </Pill>
          ) : undefined
        }
      />
    </section>
  );
}
