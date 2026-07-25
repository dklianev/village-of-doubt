import { useId, useState, type Dispatch, type KeyboardEvent } from "react";
import { Sheet } from "@werewolf/ui";
import { X } from "lucide-react";
import type { LobbyFormAction, LobbyFormState } from "@/lib/lobby-form";
import { AdvancedDrawer } from "@/components/lobby/AdvancedDrawer";
import { CommunicationSettings, NarratorSettings } from "@/components/lobby/StepStyle";
import { StepRoles } from "@/components/lobby/StepRoles";
import { TempoSettings } from "@/components/lobby/StepRoom";

type DetailTab = "roles" | "rhythm" | "rules" | "invite";

const TABS: { id: DetailTab; label: string }[] = [
  { id: "roles", label: "Роли" },
  { id: "rhythm", label: "Ритъм и водене" },
  { id: "rules", label: "Правила и комуникация" },
  { id: "invite", label: "Име и покана" },
];

export function CreateCustomizationSheet({
  state,
  dispatch,
  open,
  onOpenChange,
}: {
  state: LobbyFormState;
  dispatch: Dispatch<LobbyFormAction>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>("roles");
  const panelId = useId();

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? TABS.length - 1
          : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    const nextTab = TABS[nextIndex];
    if (!nextTab) {
      return;
    }
    setActiveTab(nextTab.id);
    window.requestAnimationFrame(() => document.getElementById(`${panelId}-${nextTab.id}-tab`)?.focus());
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Настрой детайлите"
      description="Допълнителни роли, ритъм, правила и име на стаята."
    >
      <div className="create-customization" data-family={state.family}>
        <button
          type="button"
          className="create-customization-close"
          aria-label="Затвори настройките"
          onClick={() => onOpenChange(false)}
        >
          <X aria-hidden="true" />
        </button>

        <div className="create-customization-tabs" role="tablist" aria-label="Групи настройки">
          {TABS.map((tab, index) => (
            <button
              key={tab.id}
              id={`${panelId}-${tab.id}-tab`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`${panelId}-${tab.id}-panel`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              data-active={activeTab === tab.id ? "true" : "false"}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => moveTab(event, index)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          id={`${panelId}-${activeTab}-panel`}
          className="create-customization-panel"
          role="tabpanel"
          aria-labelledby={`${panelId}-${activeTab}-tab`}
        >
          {activeTab === "roles" ? <StepRoles state={state} dispatch={dispatch} embedded /> : null}
          {activeTab === "rhythm" ? (
            <div className="create-customization-stack">
              <TempoSettings state={state} dispatch={dispatch} />
              <NarratorSettings state={state} dispatch={dispatch} />
            </div>
          ) : null}
          {activeTab === "rules" ? (
            <div className="create-customization-stack">
              <CommunicationSettings state={state} dispatch={dispatch} />
              <AdvancedDrawer state={state} dispatch={dispatch} />
            </div>
          ) : null}
          {activeTab === "invite" ? (
            <section className="create-invite-settings" aria-labelledby={`${panelId}-invite-title`}>
              <p className="create-customization-kicker">по избор</p>
              <h2 id={`${panelId}-invite-title`}>Име на стаята</h2>
              <p>Дай име на вечерта или остави предложеното. Кодът се създава автоматично.</p>
              <label>
                <span>Име на стаята</span>
                <input
                  className="input"
                  value={state.roomName}
                  maxLength={42}
                  onChange={(event) => dispatch({ type: "SET_ROOM_NAME", roomName: event.target.value })}
                />
              </label>
            </section>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}
