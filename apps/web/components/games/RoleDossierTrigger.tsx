import { getRolePresentation } from "@/lib/role-presentation.server";
import { RoleDossierButton, type RoleDossierButtonProps } from "./RoleDossierButton";

export type RoleDossierTriggerProps = Omit<RoleDossierButtonProps, "definition">;

export function RoleDossierTrigger(props: RoleDossierTriggerProps) {
  return <RoleDossierButton {...props} definition={getRolePresentation(props.family, props.role)} />;
}
