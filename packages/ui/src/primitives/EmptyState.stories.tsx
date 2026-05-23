import type { Meta, StoryObj } from "@storybook/react-vite";
import { EmptyState } from "./EmptyState";
import { Pill } from "./Pill";

const meta = {
  title: "Primitives/EmptyState",
  component: EmptyState,
  parameters: { layout: "centered" },
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

function LetterArtifact() {
  return (
    <svg viewBox="0 0 144 144" width="144" height="144" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="24" y="38" width="96" height="68" rx="4" fill="var(--ds-surface-paper-deep)" />
      <path d="M24 38 L72 78 L120 38" />
      <circle cx="72" cy="92" r="12" fill="var(--ds-accent-blood)" stroke="var(--ds-accent-blood-deep)" strokeWidth="2" />
    </svg>
  );
}

export const Default: Story = {
  args: {
    title: "Архивът чака първото си писмо.",
    body: "Завърши една игра и тя ще се появи тук.",
  },
};

export const WithArtifact: Story = {
  args: {
    artifact: <LetterArtifact />,
    title: "Архивът чака първото си писмо.",
    body: "Завърши една игра и тя ще се появи тук.",
  },
};

export const WithAction: Story = {
  args: {
    artifact: <LetterArtifact />,
    title: "Архивът чака първото си писмо.",
    body: "Завърши една игра и тя ще се появи тук.",
    action: <Pill as="a" href="/create">Седни на маса</Pill>,
  },
};

export const CompactCopy: Story = {
  args: {
    title: "Няма известия.",
    body: "Когато се случи нещо важно, ще намериш писмо тук.",
  },
};

export const AllVariants: Story = {
  args: {
    title: "Архивът чака първото си писмо.",
    body: "Завърши една игра и тя ще се появи тук.",
  },
  render: () => (
    <div style={{ display: "grid", gap: "24px", padding: "32px", width: "min(90vw, 760px)" }}>
      <EmptyState title="Няма известия." body="Когато се случи нещо важно, ще намериш писмо тук." />
      <EmptyState
        artifact={<LetterArtifact />}
        title="Архивът чака първото си писмо."
        body="Завърши една игра и тя ще се появи тук."
        action={<Pill as="a" href="/create">Седни на маса</Pill>}
      />
    </div>
  ),
};
