import { useEffect, useId, useRef, useState, type Dispatch, type KeyboardEvent } from "react";
import { Sheet } from "@werewolf/ui";
import { BookOpenCheck, Mail, TimerReset, UsersRound, type LucideIcon } from "lucide-react";
import type { LobbyFormAction, LobbyFormState } from "@/lib/lobby-form";
import { AdvancedDrawer } from "@/components/lobby/AdvancedDrawer";
import { CommunicationSettings, NarratorSettings } from "@/components/lobby/StepStyle";
import { StepRoles } from "@/components/lobby/StepRoles";
import { TempoSettings } from "@/components/lobby/StepRoom";

type DetailTab = "roles" | "rhythm" | "rules" | "invite";

const TABS: { id: DetailTab; label: string; mobileLabel: string; description: string; icon: LucideIcon }[] = [
  { id: "roles", label: "Роли", mobileLabel: "Роли", description: "Състав и баланс", icon: UsersRound },
  { id: "rhythm", label: "Ритъм и водене", mobileLabel: "Ритъм", description: "Темпо и разказвач", icon: TimerReset },
  { id: "rules", label: "Правила и комуникация", mobileLabel: "Правила", description: "Глас и разговор", icon: BookOpenCheck },
  { id: "invite", label: "Име на стаята", mobileLabel: "Име", description: "Твоята вечер", icon: Mail },
];

export function CreateCustomizationSheet({
  state,
  dispatch,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  state: LobbyFormState;
  dispatch: Dispatch<LobbyFormAction>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>("roles");
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && panelRef.current) panelRef.current.scrollTop = 0;
  }, [open, activeTab, state.manualRolesEnabled]);

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? TABS.length - 1
          : (currentIndex + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + TABS.length) % TABS.length;
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
      onCloseAutoFocus={onCloseAutoFocus}
      title="Настрой детайлите"
      description="Допълнителни роли, ритъм, правила и име на стаята."
      size="workspace"
      closeLabel="Затвори настройките"
    >
      <div className="create-customization" data-family={state.family} data-active-tab={activeTab}>
        <aside className="create-customization-sidebar">
          <div className="create-customization-ledger">
            <span>{state.family === "werewolves" ? "Върколак" : "Мафия"}</span>
            <strong>{state.playerCount} играчи</strong>
          </div>
          <div className="create-customization-tabs" role="tablist" aria-label="Групи настройки">
            {TABS.map((tab, index) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  id={`${panelId}-${tab.id}-tab`}
                  type="button"
                  role="tab"
                  aria-label={tab.label}
                  aria-selected={activeTab === tab.id}
                  aria-controls={`${panelId}-${tab.id}-panel`}
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  data-active={activeTab === tab.id ? "true" : "false"}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(event) => moveTab(event, index)}
                >
                  <Icon aria-hidden="true" />
                  <span>
                    <strong data-mobile-label={tab.mobileLabel}>{tab.label}</strong>
                    <small>{tab.description}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="create-customization-stage">
          <div
            ref={panelRef}
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
                <AdvancedDrawer state={state} dispatch={dispatch} onEditRoles={() => {
                  setActiveTab("roles");
                  window.requestAnimationFrame(() => document.getElementById(`${panelId}-roles-tab`)?.focus());
                }} />
              </div>
            ) : null}
            {activeTab === "invite" ? (
              <section className="create-invite-settings" aria-labelledby={`${panelId}-invite-title`}>
                <h2 id={`${panelId}-invite-title`}>Име на стаята</h2>
                <p>Как ще се казва вашата вечер?</p>
                <label>
                  <span>Име на стаята</span>
                  <input
                    className="input"
                    value={state.roomName}
                    maxLength={42}
                    onChange={(event) => dispatch({ type: "SET_ROOM_NAME", roomName: event.target.value })}
                  />
                </label>
                <p className="create-name-note">Кодът за покана ще е готов след създаването.</p>
              </section>
            ) : null}
          </div>

          <footer className="create-customization-footer">
            <span title="Промените не се запазват след презареждане.">За текущата подготовка</span>
            <button type="button" className="btn btn-primary" onClick={() => onOpenChange(false)}>
              Готово
            </button>
          </footer>
        </div>
      </div>
    </Sheet>
  );
}
