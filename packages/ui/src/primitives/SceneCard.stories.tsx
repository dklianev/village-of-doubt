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

const ArchiveBody = () => (
  <>
    <Display size="h1">Архив на масата</Display>
    <p style={{ color: "var(--ds-ink-scene-soft)", lineHeight: 1.6, margin: 0, maxWidth: "34rem" }}>
      Всяко дело носи дата, играчите, ролите и развръзката.
    </p>
  </>
);

const STORY_BACKGROUND =
  "radial-gradient(circle at 28% 34%, oklch(0.72 0.09 76 / 0.62), transparent 24%), linear-gradient(135deg, oklch(0.23 0.045 42), oklch(0.12 0.02 35))";

export const WithBackground: Story = {
  args: {
    eyebrow: "АРХИВ",
    density: "lg",
    background: { image: STORY_BACKGROUND, overlay: "scrim" },
    children: <ArchiveBody />,
  },
};

export const WithBackgroundVeil: Story = {
  args: {
    eyebrow: "АРХИВ",
    density: "lg",
    background: { image: STORY_BACKGROUND, overlay: "veil" },
    children: <ArchiveBody />,
  },
};

export const WithBackgroundNoOverlay: Story = {
  args: {
    eyebrow: "АРХИВ",
    density: "lg",
    background: { image: STORY_BACKGROUND, overlay: "none" },
    children: <ArchiveBody />,
  },
};

export const WithBackgroundFocalShift: Story = {
  args: {
    eyebrow: "АРХИВ",
    density: "lg",
    background: { image: STORY_BACKGROUND, overlay: "scrim", focalX: 24, focalY: 72 },
    children: <ArchiveBody />,
  },
};

export const WithBackgroundTallHero: Story = {
  args: {
    eyebrow: "ПОВЕРИТЕЛНОСТ",
    density: "lg",
    background: {
      image: STORY_BACKGROUND,
      overlay: "scrim",
      minHeight: "var(--ds-scene-hero-min-standard)",
    },
    children: (
      <>
        <Display size="hero">Открит трезор за данните ти</Display>
        <p style={{ color: "var(--ds-ink-scene-soft)", fontSize: "var(--ds-type-lede)", lineHeight: 1.6, margin: 0 }}>
          Виж точно какво пазим, защо и как можеш да го изтриеш.
        </p>
      </>
    ),
  },
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

export const Interactive: Story = {
  args: {
    eyebrow: "ДЕЙСТВИЕ",
    interactive: true,
    children: <Body />,
  },
};

export const WithAccentWin: Story = {
  args: {
    eyebrow: "ПОБЕДА",
    accent: "win",
    children: <Body />,
  },
};

export const WithAccentLoss: Story = {
  args: {
    eyebrow: "ЗАГУБА",
    accent: "loss",
    children: (
      <>
        <Display size="h3">Нощта не прости</Display>
        <p style={{ color: "var(--ds-ink-scene-soft)", lineHeight: 1.6, margin: 0, maxWidth: "28rem" }}>
          Случаят остава отворен за следващата маса.
        </p>
      </>
    ),
  },
};

export const WithAccentWarning: Story = {
  args: {
    eyebrow: "ВНИМАНИЕ",
    accent: "warning",
    children: (
      <>
        <Display size="h3">Сигналът е слаб</Display>
        <p style={{ color: "var(--ds-ink-scene-soft)", lineHeight: 1.6, margin: 0, maxWidth: "28rem" }}>
          Провери връзката преди да поканиш още играчи.
        </p>
      </>
    ),
  },
};
