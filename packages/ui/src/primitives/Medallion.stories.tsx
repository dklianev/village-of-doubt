import type { Meta, StoryObj } from "@storybook/react-vite";
import { Medallion } from "./Medallion";

const meta = {
  title: "Primitives/Medallion",
  component: Medallion,
  parameters: { layout: "centered" },
  argTypes: {
    size: { control: { type: "range", min: 32, max: 120, step: 4 } },
  },
} satisfies Meta<typeof Medallion>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { label: "1" },
};

export const Number: Story = {
  args: { label: 8 },
};

export const Small: Story = {
  args: { label: "№", size: 40 },
};

export const Large: Story = {
  args: { label: "12", size: 88 },
};

export const AllVariants: Story = {
  args: { label: "1" },
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: "18px", padding: "32px" }}>
      <Medallion label="№" size={40} />
      <Medallion label="1" />
      <Medallion label={8} size={72} />
      <Medallion label="12" size={88} />
    </div>
  ),
};
