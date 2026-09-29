import { useCallback, useEffect, useId, useState } from "react";
import { ExternalLink, RotateCw, WifiOff } from "lucide-react";
import { createPortal } from "react-dom";
import { useModal } from "@/lib/use-modal";
import { isDuplicateNameError } from "@/lib/play/join-errors";
import type { ConnectionStatus } from "@/lib/play/types";
import "@/components/play/ReconnectModal.module.css";

type ReconnectProps = {
  status: Extract<ConnectionStatus, "reconnecting" | "lost" | "error">;
  message: string;
  onRetry: () => void;
};

export function ReconnectModal(props: ReconnectProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(props.status === "reconnecting" ? <DelayedReconnect {...props} /> : <ReconnectDialog {...props} />, document.body);
}

function DelayedReconnect(props: ReconnectProps) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, []);
  return show ? <ReconnectDialog {...props} /> : null;
}

function ReconnectDialog({
  status,
  message,
  onRetry,
}: ReconnectProps) {
  const reconnecting = status === "reconnecting";
  const roomError = status === "error";
  const duplicateName = roomError && isDuplicateNameError(message);
  const keepOpen = useCallback(() => undefined, []);
  const { ref } = useModal<HTMLDialogElement>({ open: true, onClose: keepOpen });
  const titleId = useId();
  const descriptionId = useId();
  const title = duplicateName
    ? "Името вече е заето"
    : reconnecting
      ? "Свързваме се отново"
      : roomError
        ? "Връзката със стаята прекъсна"
        : "Връзката е прекъсната";

  return (
    <dialog ref={ref} className="reconnect-modal" aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={(event) => event.preventDefault()} onPointerDownCapture={(event) => event.stopPropagation()}
      onWheelCapture={(event) => event.stopPropagation()} onTouchMoveCapture={(event) => event.stopPropagation()}>
        <div className="reconnect-modal-kicker"><WifiOff size={16} aria-hidden /> Връзка със стаята</div>
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{message}</p>
        {duplicateName ? <p>В профила отвори „Образ и достъп“ и запази различно име на масата. После се върни в този раздел и се свържи отново.</p> : null}
        <div className="reconnect-modal-actions">
          {duplicateName ? (
            <a className="btn btn-primary" href="/account" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="play-button-icon" aria-hidden />
              Промени името (нов раздел)
            </a>
          ) : null}
          <button type="button" className={`btn ${duplicateName ? "btn-secondary" : "btn-primary"}`} onClick={onRetry} disabled={reconnecting} aria-busy={reconnecting}>
            <RotateCw size={18} aria-hidden />
            {reconnecting ? "Опитваме..." : roomError ? "Свържи отново" : "Опитай пак"}
          </button>
          {!duplicateName ? (
            <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>
              Презареди
            </button>
          ) : null}
        </div>
    </dialog>
  );
}
