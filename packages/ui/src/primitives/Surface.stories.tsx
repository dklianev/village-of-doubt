import type { Meta, StoryObj } from "@storybook/react-vite";
import { Surface } from "./Surface";

const meta = {
  title: "Primitives/Surface",
  component: Surface,
  parameters: { layout: "centered" },
  argTypes: {
    variant: { control: "select", options: ["paper", "paper-deep", "scene", "scene-deep"] },
    radius: { control: "select", options: ["card", "tile", "none"] },
    elevation: { control: "select", options: ["none", "card", "scene"] },
    as: { control: "select", options: ["div", "section", "article", "aside"] },
  },
} satisfies Meta<typeof Surface>;

export default meta;

type Story = StoryObj<typeof meta>;

const Sample = ({ label }: { label: string }) => (
  <div style={{ padding: "40px 56px", fontFamily: "Noto Serif, serif", fontSize: "18px" }}>
    {label}
  </div>
);

export const Paper: Story = {
  args: { variant: "paper", radius: "card", elevation: "card", children: <Sample label="Хартия" /> },
};

export const PaperDeep: Story = {
  args: { variant: "paper-deep", radius: "card", elevation: "card", children: <Sample label="Дълбока хартия" /> },
};

export const Scene: Story = {
  args: { variant: "scene", radius: "card", elevation: "scene", children: <Sample label="Сцена" /> },
  parameters: { backgrounds: { default: "scene" } },
};

export const SceneDeep: Story = {
  args: { variant: "scene-deep", radius: "card", elevation: "scene", children: <Sample label="Дълбока сцена" /> },
  parameters: { backgrounds: { default: "scene" } },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "grid", gap: "24px", gridTemplateColumns: "repeat(2, minmax(180px, 1fr))", padding: "32px" }}>
      <Surface variant="paper" radius="card">
        <Sample label="Хартия" />
      </Surface>
      <Surface variant="paper-deep" radius="card">
        <Sample label="Дълбока хартия" />
      </Surface>
      <Surface variant="scene" radius="card" elevation="scene">
        <Sample label="Сцена" />
      </Surface>
      <Surface variant="scene-deep" radius="card" elevation="scene">
        <Sample label="Дълбока сцена" />
      </Surface>
    </div>
  ),
};
