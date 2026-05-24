import type { Meta, StoryObj } from "@storybook/react-vite";
import { Display } from "./Display";
import { Eyebrow } from "./Eyebrow";
import { Pill } from "./Pill";
import { SceneCard } from "./SceneCard";

const meta = {
  title: "Primitives/SceneCard",
  component: SceneCard,
  parameters: { layout: "centered", backgrounds: { default: "scene" } },
  argTypes: {
    density: { control: "select", options: ["sm", "md", "lg"] },
  },
} satisfies Meta<typeof SceneCard>;

export default meta;

type Story = StoryObj<typeof meta>;

const Body = () => (
  <>
    <Display size="h3">Селото работи</Display>
    <p style={{ color: "var(--ds-ink-scene-soft)", lineHeight: 1.6, margin: 0, maxWidth: "28rem" }}>
      Всички услуги отговарят нормално и светлината остава запалена.
    </p>
  </>
);

export const Default: Story = {
  args: { eyebrow: "СЪСТОЯНИЕ", children: <Body /> },
};

export const WithMeta: Story = {
  args: { eyebrow: "СЪСТОЯНИЕ", meta: <Eyebrow tone="gold">СЕГА</Eyebrow>, children: <Body /> },
};

export const Dense: Story = {
  args: { eyebrow: "КРАТКО", density: "sm", children: <Body /> },
};

export const Spacious: Story = {
  args: { eyebrow: "ГОЛЯМО", density: "lg", children: <Body /> },
};

export const AllVariants: Story = {
  args: { children: <Body /> },
  render: () => (
    <div style={{ display: "grid", gap: "18px", padding: "32px", width: "min(90vw, 720px)" }}>
      <SceneCard eyebrow="КРАТКО" density="sm">
        <Body />
      </SceneCard>
      <SceneCard eyebrow="СТАНДАРТНО" density="md" meta={<Eyebrow tone="gold">СЕГА</Eyebrow>}>
        <Body />
      </SceneCard>
      <SceneCard eyebrow="ГОЛЯМО" density="lg">
        <Body />
      </SceneCard>
    </div>
  ),
};

export const InteractionStates: Story = {
  args: { children: <Body /> },
  render: () => (
    <div style={{ display: "grid", gap: "18px", padding: "32px", width: "min(90vw, 720px)" }}>
      <SceneCard eyebrow="ДЕЙСТВИЕ" meta={<Eyebrow tone="gold">ФОКУС</Eyebrow>}>
        <Body />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          <Pill style={{ boxShadow: "var(--ds-focus-ring)" }}>Провери</Pill>
          <Pill intent="secondary" style={{ transform: "translateY(-1px)", filter: "brightness(1.05)" }}>
            Hover
          </Pill>
          <Pill intent="secondary" disabled>
            Недостъпен
          </Pill>
        </div>
      </SceneCard>
    </div>
  ),
};
