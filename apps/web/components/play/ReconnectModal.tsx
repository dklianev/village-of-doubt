import { useCallback } from "react";
import { useModal } from "@/lib/use-modal";
import type { ConnectionStatus } from "@/lib/play/types";

export function ReconnectModal({
  status,
  message,
  onRetry,
}: {
  status: Extract<ConnectionStatus, "reconnecting" | "lost">;
  message: string;
  onRetry: () => void;
}) {
  const reconnecting = status === "reconnecting";
  const keepOpen = useCallback(() => undefined, []);
  const { ref } = useModal<HTMLElement>({ open: true, onClose: keepOpen });

  return (
    <div className="reconnect-modal-backdrop" role="presentation">
      <aside
        ref={ref}
        className="reconnect-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reconnect-modal-title"
        aria-describedby="reconnect-modal-body"
      >
        <div className="reconnect-modal-orb" aria-hidden />
        <p className="section-kicker">връзка със стаята</p>
        <h2 id="reconnect-modal-title">
          {reconnecting ? "Връщаме те обратно" : "Не успяхме да се върнем автоматично"}
        </h2>
        <p id="reconnect-modal-body">{message}</p>
        <div className="reconnect-modal-actions">
          <button type="button" className="btn btn-primary" onClick={onRetry} disabled={reconnecting} aria-busy={reconnecting}>
            {reconnecting ? "Опитваме..." : "Опитай пак"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>
            Презареди
          </button>
        </div>
      </aside>
    </div>
  );
}
