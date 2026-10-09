import { lazy, Suspense, useRef, useState } from "react";
import { QrCode, Share2 } from "lucide-react";
import { PlayFeatureBoundary } from "./PlayFeatureBoundary";

const InviteQrSheet = lazy(() => import("./InviteQrSheet").then((module) => ({ default: module.InviteQrSheet })));

/**
 * Lobby invite extras, loaded with the lobby rather than the whole play room: the native share
 * sheet (Viber, WhatsApp, Messages...) with a copy fallback, and a QR code for live tables.
 */
export function InviteTools({ code, onCopyInvite }: { code: string; onCopyInvite: () => void | Promise<void> }) {
  const [qrOpen, setQrOpen] = useState(false);
  const qrTrigger = useRef<HTMLButtonElement>(null);
  const inviteUrl = () => new URL(`/lobby/${encodeURIComponent(code)}`, window.location.origin).href;

  async function shareInvite() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Сенките", text: `Ела на масата в Сенките. Код на стаята: ${code}`, url: inviteUrl() });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await onCopyInvite();
  }

  return (
    <>
      <button type="button" aria-label="Сподели поканата" title="Сподели поканата" onClick={() => void shareInvite()}>
        <Share2 aria-hidden="true" />
      </button>
      <button ref={qrTrigger} type="button" aria-label="Покажи QR код за масата" title="QR код за масата" onClick={() => setQrOpen(true)}>
        <QrCode aria-hidden="true" />
      </button>
      {qrOpen ? (
        <PlayFeatureBoundary fallback={<span role="status">QR кодът не се зареди. Използвай поканата.</span>}>
        <Suspense fallback={null}>
          <InviteQrSheet open onOpenChange={setQrOpen} code={code} inviteUrl={inviteUrl()}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              qrTrigger.current?.focus({ preventScroll: true });
            }} />
        </Suspense>
        </PlayFeatureBoundary>
      ) : null}
    </>
  );
}
