import type { Dispatch } from "react";
import type { LobbyFormAction, LobbyFormState } from "@/lib/lobby-form";
import type { DetailTab } from "./CreateCustomizationSheet";
import { AdvancedDrawer } from "./AdvancedDrawer";
import { CommunicationSettings, NarratorSettings } from "./StepStyle";
import { StepRoles } from "./StepRoles";
import { TempoSettings } from "./StepRoom";

export function CreateCustomizationContent({
  state,
  dispatch,
  activeTab,
  panelId,
  onEditRoles,
}: {
  state: LobbyFormState;
  dispatch: Dispatch<LobbyFormAction>;
  activeTab: DetailTab;
  panelId: string;
  onEditRoles: () => void;
}) {
  return (
    <>
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
          <AdvancedDrawer state={state} dispatch={dispatch} onEditRoles={onEditRoles} />
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
    </>
  );
}
