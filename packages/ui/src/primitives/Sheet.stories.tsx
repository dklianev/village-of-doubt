import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import "../styles/sheet.css";
import { Pill } from "./Pill";
import { Sheet } from "./Sheet";

const meta = {
  title: "Primitives/Sheet",
  component: Sheet,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Sheet>;

export default meta;

type Story = StoryObj<typeof meta>;

function SheetDemo({ initialOpen = true }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <>
      <Pill onClick={() => setOpen(true)}>Отвори</Pill>
      <Sheet open={open} onOpenChange={setOpen} title="Писма на масата">
        <p style={{ margin: 0, color: "var(--ds-ink-soft)", lineHeight: 1.6 }}>
          Тук може да стои кратък списък, форма или действие, което не заслужава цял екран.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <Pill intent="ghost" onClick={() => setOpen(false)}>
            Затвори
          </Pill>
          <Pill onClick={() => setOpen(false)}>Запази</Pill>
        </div>
      </Sheet>
    </>
  );
}

export const Default: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    title: "Писма на масата",
    children: "Кратко съдържание.",
  },
};

export const WithoutTitle: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    children: "Кратко съдържание.",
  },
};

export const Interactive: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    title: "Писма на масата",
    children: "Кратко съдържание.",
  },
  render: () => <SheetDemo initialOpen={false} />,
};

export const AllVariants: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    title: "Писма на масата",
    children: "Кратко съдържание.",
  },
  render: () => <SheetDemo />,
};
