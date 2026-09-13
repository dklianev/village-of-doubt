import { lazy, Suspense, useState } from "react";
import type { PlayToolSheetProps } from "./PlayToolSurface";

const PlayToolSurface = lazy(() => import("./PlayToolSurface"));

export function PlayToolSheet(props: PlayToolSheetProps) {
  const [hasOpened, setHasOpened] = useState(props.open);
  if (props.open && !hasOpened) setHasOpened(true);

  // Keep the loaded sheet mounted for Radix's closing animation and focus return.
  return hasOpened ? <Suspense fallback={null}><PlayToolSurface {...props} /></Suspense> : null;
}
