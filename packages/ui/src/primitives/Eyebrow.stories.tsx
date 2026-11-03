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
  args: { children: "Състояние", tone: "default" },
};

export const Muted: Story = {
  args: { children: "Архив", tone: "muted" },
};

export const Blood: Story = {
  args: { children: "Сигнал", tone: "blood" },
};

export const Gold: Story = {
  args: { children: "Легенда", tone: "gold" },
};

export const AllVariants: Story = {
  args: { children: "Варианти" },
  render: () => (
    <div style={{ display: "grid", gap: "18px", padding: "32px" }}>
      <Eyebrow>Състояние</Eyebrow>
      <Eyebrow tone="muted">Архив</Eyebrow>
      <Eyebrow tone="blood">Сигнал</Eyebrow>
      <Eyebrow tone="gold">Легенда</Eyebrow>
    </div>
  ),
};
