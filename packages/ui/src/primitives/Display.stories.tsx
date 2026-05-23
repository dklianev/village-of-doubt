import type { Meta, StoryObj } from "@storybook/react-vite";
import { Display } from "./Display";

const meta = {
  title: "Primitives/Display",
  component: Display,
  parameters: { layout: "centered" },
  argTypes: {
    size: { control: "select", options: ["hero", "h1", "h2", "h3", "h4"] },
    as: { control: "select", options: ["h1", "h2", "h3", "h4", "p"] },
  },
} satisfies Meta<typeof Display>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Hero: Story = {
  args: { size: "hero", children: "Селото оцеля" },
};

export const HeadingOne: Story = {
  args: { size: "h1", children: "Селото оцеля" },
};

export const HeadingTwo: Story = {
  args: { size: "h2", children: "Последен инцидент" },
};

export const HeadingThree: Story = {
  args: { size: "h3", children: "Архивът чака" },
};

export const AllSizes: Story = {
  args: { children: "Размери" },
  render: () => (
    <div style={{ display: "grid", gap: "22px", padding: "32px", maxWidth: "720px" }}>
      <Display size="hero">Селото оцеля</Display>
      <Display size="h1">Състояние на услугите</Display>
      <Display size="h2">Какво проверяваме</Display>
      <Display size="h3">Последен инцидент</Display>
      <Display size="h4">Няма нови писма</Display>
    </div>
  ),
};
