import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Dialog } from "./Dialog";
import { Pill } from "./Pill";

const meta = {
  title: "Primitives/Dialog",
  component: Dialog,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Dialog>;

export default meta;

type Story = StoryObj<typeof meta>;

function DialogDemo({ initialOpen = true }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <>
      <Pill onClick={() => setOpen(true)}>Отвори</Pill>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Потвърди действието"
        description="Тази промяна ще се запази веднага."
        footer={
          <>
            <Pill intent="ghost" onClick={() => setOpen(false)}>
              Откажи
            </Pill>
            <Pill onClick={() => setOpen(false)}>Потвърди</Pill>
          </>
        }
      >
        <p style={{ margin: 0, color: "var(--ds-ink-soft)", lineHeight: 1.6 }}>
          Провери детайлите преди да продължиш.
        </p>
      </Dialog>
    </>
  );
}

export const Default: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    title: "Потвърди действието",
    description: "Тази промяна ще се запази веднага.",
    children: "Провери детайлите преди да продължиш.",
  },
};

export const WithFooter: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    title: "Потвърди действието",
    description: "Тази промяна ще се запази веднага.",
    children: "Провери детайлите преди да продължиш.",
    footer: <Pill>Потвърди</Pill>,
  },
};

export const Interactive: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    title: "Потвърди действието",
    children: "Провери детайлите преди да продължиш.",
  },
  render: () => <DialogDemo initialOpen={false} />,
};

export const AllVariants: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    title: "Потвърди действието",
    children: "Провери детайлите преди да продължиш.",
  },
  render: () => <DialogDemo />,
};

export const InteractionStates: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    title: "Потвърди действието",
    children: "Провери детайлите преди да продължиш.",
  },
  render: () => (
    <Dialog
      open
      onOpenChange={() => {}}
      title="Потвърди действието"
      description="Състояния на действията в модала."
      footer={
        <>
          <Pill intent="ghost" style={{ transform: "translateY(-1px)", filter: "brightness(1.05)" }}>
            Hover
          </Pill>
          <Pill style={{ boxShadow: "var(--ds-focus-ring)" }}>Фокус</Pill>
          <Pill intent="secondary" disabled>
            Недостъпен
          </Pill>
        </>
      }
    >
      <p style={{ margin: 0, color: "var(--ds-ink-soft)", lineHeight: 1.6 }}>
        Основното съдържание остава спокойно, докато действията показват състояния.
      </p>
    </Dialog>
  ),
};
