import { useCallback } from "react";
import { ExternalLink } from "lucide-react";
import { isDuplicateNameError } from "@/lib/play/join-errors";
import { useModal } from "@/lib/use-modal";
import type { ConnectionStatus } from "@/lib/play/types";
import "@/components/play/ReconnectModal.module.css";

export function ReconnectModal({
  status,
  message,
  onRetry,
}: {
  status: Extract<ConnectionStatus, "reconnecting" | "lost" | "error">;
  message: string;
  onRetry: () => void;
}) {
  const reconnecting = status === "reconnecting";
  const roomError = status === "error";
  const duplicateName = roomError && isDuplicateNameError(message);
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
          {duplicateName
            ? "Името вече е заето"
            : reconnecting
            ? "Връщаме те обратно"
            : roomError
              ? "Връзката със стаята прекъсна"
              : "Не успяхме да се върнем автоматично"}
        </h2>
        <p id="reconnect-modal-body">{message}</p>
        {duplicateName ? <p>В профила отвори „Образ и достъп“ и запази различно име на масата. После се върни в този раздел и се свържи отново.</p> : null}
        <div className="reconnect-modal-actions">
          {duplicateName ? (
            <a className="btn btn-primary" href="/account" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="play-button-icon" aria-hidden />
              Промени името (нов раздел)
            </a>
          ) : null}
          <button type="button" className={`btn ${duplicateName ? "btn-secondary" : "btn-primary"}`} onClick={onRetry} disabled={reconnecting} aria-busy={reconnecting}>
            {reconnecting ? "Опитваме..." : roomError ? "Свържи отново" : "Опитай пак"}
          </button>
          {!duplicateName ? (
            <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>
              Презареди
            </button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
