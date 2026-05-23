import type { Meta, StoryObj } from "@storybook/react-vite";
import { Display } from "./Display";
import { Eyebrow } from "./Eyebrow";
import { PaperCard } from "./PaperCard";

const meta = {
  title: "Primitives/PaperCard",
  component: PaperCard,
  parameters: { layout: "centered" },
  argTypes: {
    density: { control: "select", options: ["sm", "md", "lg"] },
  },
} satisfies Meta<typeof PaperCard>;

export default meta;

type Story = StoryObj<typeof meta>;

const Body = () => (
  <>
    <Display size="h3">Селото оцеля</Display>
    <p style={{ color: "var(--ds-ink-soft)", lineHeight: 1.6, margin: 0, maxWidth: "28rem" }}>
      Една нощ без жертви и достатъчно време за следващия глас.
    </p>
  </>
);

export const Default: Story = {
  args: { eyebrow: "ДОСИЕ", children: <Body /> },
};

export const WithMeta: Story = {
  args: { eyebrow: "ДОСИЕ", meta: <Eyebrow tone="gold">14.05</Eyebrow>, children: <Body /> },
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
      <PaperCard eyebrow="КРАТКО" density="sm">
        <Body />
      </PaperCard>
      <PaperCard eyebrow="СТАНДАРТНО" density="md" meta={<Eyebrow tone="gold">14.05</Eyebrow>}>
        <Body />
      </PaperCard>
      <PaperCard eyebrow="ГОЛЯМО" density="lg">
        <Body />
      </PaperCard>
    </div>
  ),
};
