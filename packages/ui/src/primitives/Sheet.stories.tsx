import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
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

export const LongContent: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    title: "Дълго писмо",
    children: (
      <div style={{ display: "grid", gap: "12px" }}>
        {Array.from({ length: 8 }, (_, index) => (
          <p key={index} style={{ margin: 0, color: "var(--ds-ink-soft)", lineHeight: 1.6 }}>
            Ред {index + 1}: съдържанието остава в рамките на листа и се скролва, когато стане дълго.
          </p>
        ))}
      </div>
    ),
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

export const InteractionStates: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    title: "Писма на масата",
    children: "Кратко съдържание.",
  },
  render: () => (
    <Sheet open onOpenChange={() => {}} title="Писма на масата">
      <p style={{ margin: 0, color: "var(--ds-ink-soft)", lineHeight: 1.6 }}>
        Действията в листа показват стабилни hover, focus и disabled състояния.
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: "12px" }}>
        <Pill intent="ghost" style={{ transform: "translateY(-1px)", filter: "brightness(1.05)" }}>
          Hover
        </Pill>
        <Pill style={{ boxShadow: "var(--ds-focus-ring)" }}>Фокус</Pill>
        <Pill intent="secondary" disabled>
          Недостъпен
        </Pill>
      </div>
    </Sheet>
  ),
};
