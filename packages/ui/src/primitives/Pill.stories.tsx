import type { Meta, StoryObj } from "@storybook/react-vite";
import { Pill } from "./Pill";

const meta = {
  title: "Primitives/Pill",
  component: Pill,
  parameters: { layout: "centered" },
  argTypes: {
    intent: { control: "select", options: ["primary", "secondary", "danger", "ghost", "faction"] },
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

export const Faction: Story = {
  args: { children: "Влез на масата", intent: "faction", shimmer: true },
  decorators: [(Story) => <div data-faction="werewolves" style={{ padding: 24 }}><Story /></div>],
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
      <Pill intent="faction" shimmer>
        Влез на масата
      </Pill>
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

export const WithShimmer: Story = {
  args: { intent: "primary", shimmer: true, children: "Избери игра" },
};

export const Tracked: Story = {
  args: { intent: "primary", shimmer: true, tracked: true, children: "Избери игра" },
};

export const FactionWerewolves: Story = {
  args: { intent: "faction", children: "Влез на масата" },
  decorators: [(Story) => <div data-faction="werewolves" style={{ padding: 24 }}><Story /></div>],
};

export const FactionMafia: Story = {
  args: { intent: "faction", children: "Влез на масата" },
  decorators: [(Story) => <div data-faction="mafia" style={{ padding: 24 }}><Story /></div>],
};

export const FocusedShimmer: Story = {
  args: { intent: "primary", shimmer: true, children: "Избери игра" },
  render: (args) => <Pill {...args} style={{ boxShadow: "var(--ds-focus-ring)" }} />,
};

export const DisabledFaction: Story = {
  args: { intent: "faction", disabled: true, children: "Недостъпно" },
  decorators: [(Story) => <div data-faction="mafia" style={{ padding: 24 }}><Story /></div>],
};

export const TrackedBulgarianText: Story = {
  args: { intent: "primary", shimmer: true, tracked: true, children: "Избери игра и започни вечерта" },
};
