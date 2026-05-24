import type { Meta, StoryObj } from "@storybook/react-vite";
import { Pill } from "./Pill";

const meta = {
  title: "Primitives/Pill",
  component: Pill,
  parameters: { layout: "centered" },
  argTypes: {
    intent: { control: "select", options: ["primary", "secondary", "danger", "ghost"] },
    size: { control: "select", options: ["sm", "md", "lg"] },
  },
} satisfies Meta<typeof Pill>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { children: "Запази", intent: "primary" },
};

export const Secondary: Story = {
  args: { children: "Виж повече", intent: "secondary" },
};

export const Danger: Story = {
  args: { children: "Изтрий", intent: "danger" },
};

export const Link: Story = {
  args: { as: "a", href: "/status", children: "Виж състояние", intent: "ghost" },
};

export const AllVariants: Story = {
  args: { children: "Варианти" },
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", padding: "32px" }}>
      <Pill>Запази</Pill>
      <Pill intent="secondary">Виж повече</Pill>
      <Pill intent="danger">Изтрий</Pill>
      <Pill intent="ghost" as="a" href="/status">
        Виж състояние
      </Pill>
      <Pill size="sm">Малък</Pill>
      <Pill size="lg">Голям</Pill>
    </div>
  ),
};

export const InteractionStates: Story = {
  args: { children: "Състояния" },
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", padding: "32px" }}>
      <Pill>Нормален</Pill>
      <Pill style={{ transform: "translateY(-1px)", filter: "brightness(1.05)" }}>Hover</Pill>
      <Pill style={{ boxShadow: "var(--ds-focus-ring)" }}>Фокус</Pill>
      <Pill disabled>Недостъпен</Pill>
    </div>
  ),
};
