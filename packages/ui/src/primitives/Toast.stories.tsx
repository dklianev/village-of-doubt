import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { Pill } from "./Pill";
import { Toast } from "./Toast";

const meta = {
  title: "Primitives/Toast",
  component: Toast,
  parameters: { layout: "centered", backgrounds: { default: "scene" } },
  argTypes: {
    tone: { control: "select", options: ["info", "success", "error"] },
  },
} satisfies Meta<typeof Toast>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Info: Story = {
  args: { open: true, tone: "info", message: "Писмото е изпратено." },
};

export const Success: Story = {
  args: { open: true, tone: "success", message: "Промяната е запазена." },
};

export const Error: Story = {
  args: { open: true, tone: "error", message: "Нещо прекъсна. Опитай пак." },
};

export const Dismissible: Story = {
  args: { open: true, tone: "info", message: "Можеш да затвориш това писмо." },
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <div style={{ display: "grid", justifyItems: "center", gap: "16px", padding: "32px" }}>
        <Toast open={open} message="Можеш да затвориш това писмо." onDismiss={() => setOpen(false)} />
        {!open && <Pill onClick={() => setOpen(true)}>Покажи пак</Pill>}
      </div>
    );
  },
};

export const AllVariants: Story = {
  args: { open: true, message: "Варианти" },
  render: () => (
    <div style={{ display: "grid", gap: "14px", padding: "32px" }}>
      <Toast open tone="info" message="Писмото е изпратено." />
      <Toast open tone="success" message="Промяната е запазена." />
      <Toast open tone="error" message="Нещо прекъсна. Опитай пак." />
    </div>
  ),
};

export const InteractionStates: Story = {
  args: { open: true, message: "Състояния" },
  render: () => {
    useEffect(() => {
      const closeButton = document.querySelector<HTMLButtonElement>("[data-toast-focus-root] button");
      closeButton?.focus();
    }, []);

    return (
      <div data-toast-focus-root style={{ display: "grid", gap: "14px", padding: "32px" }}>
        <Toast open tone="info" message="Затварящият бутон е във фокус." onDismiss={() => {}} />
        <Toast open tone="success" message="Успешното писмо остава видимо." />
        <Toast open tone="error" message="Грешката остава ясно различима." />
      </div>
    );
  },
};
