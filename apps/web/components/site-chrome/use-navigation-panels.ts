import { useRef, useState } from "react";

type NavigationPanels = typeof import("./NavigationPanels");
type LoadStatus = "idle" | "pending" | "ready" | "error";

export function useNavigationPanels() {
  const [panels, setPanels] = useState<NavigationPanels | null>(null);
  const [status, setStatus] = useState<LoadStatus>("idle");
  const loadStatus = useRef<LoadStatus>("idle");

  async function load(retry = false) {
    if (loadStatus.current !== "idle" && !(retry && loadStatus.current === "error")) return;
    loadStatus.current = "pending";
    setStatus("pending");
    try {
      // One shared entry, but no hidden drawer mount or cached React.lazy rejection.
      const loaded = await import("./NavigationPanels");
      setPanels(loaded);
      loadStatus.current = "ready";
      setStatus("ready");
    } catch {
      loadStatus.current = "error";
      setStatus("error");
    }
  }

  return { panels, status, preload: () => { void load(); }, retry: () => { void load(true); } };
}
