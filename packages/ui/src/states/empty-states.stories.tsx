import type { Meta, StoryObj } from "@storybook/react-vite";
import { EmptyState } from "../primitives/EmptyState";
import { Pill } from "../primitives/Pill";
import { ARTIFACT_SVG } from "../primitives/artifacts";
import { EMPTY_STATES, type EmptyStateKey } from "./empty-states";

const meta = {
  title: "States/EmptyStates",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const STATE_KEYS = Object.keys(EMPTY_STATES) as EmptyStateKey[];

function CatalogAction({ action }: { action: NonNullable<(typeof EMPTY_STATES)[EmptyStateKey]["action"]> }) {
  if (action.href) {
    return (
      <Pill as="a" href={action.href} intent="secondary" size="sm">
        {action.label}
      </Pill>
    );
  }

  return (
    <Pill intent="secondary" size="sm">
      {action.label}
    </Pill>
  );
}

export const Gallery: Story = {
  render: () => (
    <div
      style={{
        display: "grid",
        gap: "32px",
        padding: "32px",
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      {STATE_KEYS.map((key) => {
        const def = EMPTY_STATES[key];
        const Artifact = ARTIFACT_SVG[def.artifact];

        return (
          <section key={key} style={{ display: "grid", gap: "8px" }}>
            <small
              style={{
                color: "var(--ds-ink-soft)",
                fontFamily: "ui-monospace, monospace",
                fontSize: "11px",
              }}
            >
              {key}
            </small>
            <EmptyState
              artifact={<Artifact size={120} />}
              title={def.title}
              body={def.body}
              action={def.action ? <CatalogAction action={def.action} /> : undefined}
            />
          </section>
        );
      })}
    </div>
  ),
};
