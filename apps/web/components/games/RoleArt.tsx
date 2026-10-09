import Image from "next/image";
import { useState } from "react";
import type { GameFamily } from "@werewolf/shared";
import { coverImageSizes } from "@/lib/image-sizes";
import type { RolePresentation } from "@/lib/role-presentation.server";
import "./RoleDossier.module.css";

export function RoleArt({ source, family, eager = false, detail = false }: {
  source: RolePresentation["art"];
  family: GameFamily;
  eager?: boolean;
  detail?: boolean;
}) {
  const [didFail, setDidFail] = useState(false);
  // Nested calc keeps Next's vw heuristic from dropping small mobile candidates.
  const sizes = coverImageSizes(source, detail
    ? [
      { media: "(max-width: 760px)", width: "min(210px, calc(58vw))", aspectRatio: 2 / 3 },
      { width: 300, aspectRatio: 2 / 3 },
    ]
    : [
      { media: "(max-width: 480px)", width: "max(96px, calc(27.54vw - 18px))", aspectRatio: 2 / 3 },
      { media: "(max-width: 760px)", width: "max(112px, calc(29.58vw - 18px))", aspectRatio: 2 / 3 },
      { media: "(max-width: 1100px)", width: "calc((100vw - 92px) / 2)", aspectRatio: 2 / 3 },
      { media: "(max-width: 1280px)", width: 360, aspectRatio: 2 / 3 },
      { width: 259, aspectRatio: 2 / 3 },
    ]);

  return (
    <picture className="role-codex-art role-codex-frame role-art-frame" data-frame-family={family} aria-hidden="true">
      <Image
        {...source}
        unoptimized={didFail}
        quality={85}
        alt=""
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        sizes={sizes}
        onError={didFail ? undefined : () => setDidFail(true)}
      />
    </picture>
  );
}
