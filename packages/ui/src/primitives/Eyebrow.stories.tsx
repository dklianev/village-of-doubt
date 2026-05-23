import type { Meta, StoryObj } from "@storybook/react-vite";
import { Eyebrow } from "./Eyebrow";

const meta = {
  title: "Primitives/Eyebrow",
  component: Eyebrow,
  parameters: { layout: "centered" },
  argTypes: {
    tone: { control: "select", options: ["default", "muted", "blood", "gold"] },
  },
} satisfies Meta<typeof Eyebrow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: "СЪСТОЯНИЕ", tone: "default" },
};

export const Muted: Story = {
  args: { children: "АРХИВ", tone: "muted" },
};

export const Blood: Story = {
  args: { children: "СИГНАЛ", tone: "blood" },
};

export const Gold: Story = {
  args: { children: "ЛЕГЕНДА", tone: "gold" },
};

export const AllVariants: Story = {
  args: { children: "ВАРИАНТИ" },
  render: () => (
    <div style={{ display: "grid", gap: "18px", padding: "32px" }}>
      <Eyebrow>СЪСТОЯНИЕ</Eyebrow>
      <Eyebrow tone="muted">АРХИВ</Eyebrow>
      <Eyebrow tone="blood">СИГНАЛ</Eyebrow>
      <Eyebrow tone="gold">ЛЕГЕНДА</Eyebrow>
    </div>
  ),
};
