import { useEffect, useId, useRef, useState, type Dispatch, type KeyboardEvent } from "react";
import { Sheet } from "@werewolf/ui";
import { BookOpenCheck, Mail, RotateCw, TimerReset, UsersRound, type LucideIcon } from "lucide-react";
import type { LobbyFormAction, LobbyFormState } from "@/lib/lobby-form";
import { loadCreateCustomizationContent } from "./create-customization-deferred";

export type DetailTab = "roles" | "rhythm" | "rules" | "invite";
type CustomizationContent = Awaited<ReturnType<typeof loadCreateCustomizationContent>>;

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
  const [Content, setContent] = useState<CustomizationContent | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || Content) return;
    let active = true;
    setFailed(false);
    void loadCreateCustomizationContent().then(
      (LoadedContent) => { if (active) setContent(() => LoadedContent); },
      () => { if (active) setFailed(true); },
    );
    return () => { active = false; };
  }, [open, Content, attempt]);

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
            aria-busy={!Content && !failed}
            tabIndex={-1}
          >
            {Content ? (
              <Content state={state} dispatch={dispatch} activeTab={activeTab} panelId={panelId}
                onEditRoles={() => {
                  setActiveTab("roles");
                  window.requestAnimationFrame(() => document.getElementById(`${panelId}-roles-tab`)?.focus());
                }} />
            ) : (
              <div className="create-customization-stack">
                <p role={failed ? "alert" : "status"} aria-atomic="true">
                  {failed ? "Настройките не се заредиха." : "Зареждаме настройките..."}
                </p>
                {failed ? (
                  <button type="button" className="btn btn-secondary" onClick={() => {
                    panelRef.current?.focus({ preventScroll: true });
                    setFailed(false);
                    setAttempt((value) => value + 1);
                  }}><RotateCw size={18} aria-hidden="true" /> Опитай отново</button>
                ) : null}
              </div>
            )}
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
