import { useMemo } from "react";
import { Sheet } from "@werewolf/ui";
import { encode } from "uqr";
import styles from "./InviteQrSheet.module.css";

const QUIET_ZONE = 2;

/**
 * Live tables pass one phone around: the host shows this code and everyone joins by scanning.
 * The QR carries only the public invite link that "Покани" would share anyway.
 */
export function InviteQrSheet({
  open,
  onOpenChange,
  code,
  inviteUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
  inviteUrl: string;
}) {
  const qr = useMemo(() => {
    const { data, size } = encode(inviteUrl, { ecc: "M", border: 0 });
    let path = "";
    data.forEach((row, y) => row.forEach((dark, x) => {
      if (dark) path += `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`;
    }));
    return { path, span: size + QUIET_ZONE * 2 };
  }, [inviteUrl]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Покана с QR код" closeLabel="Затвори" description="Покажи екрана на масата. Всеки сканира и влиза в стаята.">
      <div className={styles.body}>
        <svg className={styles.qr} viewBox={`0 0 ${qr.span} ${qr.span}`} role="img" aria-label={`QR код за стая ${code}`} shapeRendering="crispEdges">
          <rect width={qr.span} height={qr.span} className={styles.paper} />
          <path d={qr.path} className={styles.ink} />
        </svg>
        <p className={styles.caption}>или въведи кода</p>
        <strong className={styles.code}>{code}</strong>
      </div>
    </Sheet>
  );
}
