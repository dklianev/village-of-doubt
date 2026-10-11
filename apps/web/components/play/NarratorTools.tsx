import type { ComponentProps } from "react";
import { NarratorDesk } from "./NarratorDesk";
import { NarratorSnapshotPanel } from "./NarratorSnapshotPanel";
export { KeyboardShortcutsModal } from "../keyboard-shortcuts-modal";

export default function NarratorTools({ desk, snapshot }: {
  desk?: ComponentProps<typeof NarratorDesk>;
  snapshot?: ComponentProps<typeof NarratorSnapshotPanel>["snapshot"];
}) {
  return <>
    {desk ? <NarratorDesk {...desk} /> : null}
    {snapshot ? <NarratorSnapshotPanel snapshot={snapshot} /> : null}
  </>;
}
