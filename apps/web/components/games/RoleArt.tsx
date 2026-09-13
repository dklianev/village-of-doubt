import Image from "next/image";
import { useState } from "react";
import { getRoleAssetKey, type GameFamily, type RoleCode } from "@werewolf/shared";
import { coverImageSizes, roleArtSource } from "@/lib/role-art";
import "./RoleDossier.module.css";

const KNOWN_WEREWOLF_ROLE_ASSETS = new Set([
  "ordinary-villager",
  "werewolf",
  "seer",
  "witch",
  "healer",
  "priest",
  "hunter",
  "cupid",
  "vampire",
  "red-riding-hood",
  "oracle",
  "cook",
  "blacksmith",
  "insomniac",
  "vampire-hunter",
  "investigator",
  "drunk",
  "stray-cat",
  "guard-dog",
  "little-girl",
  "thief",
  "jester",
  "mayor",
]);

const KNOWN_MAFIA_ROLE_ASSETS = new Set([
  "civilian",
  "commissioner",
  "don",
  "mafioso",
  "doctor",
  "detective",
  "bodyguard",
  "vigilante",
  "medium",
  "roleblocker",
  "lawyer",
  "informant",
  "maniac",
  "jester",
  "mayor",
  "lovers",
]);

export function RoleArt({ role, family, eager = false, detail = false }: { role: RoleCode; family: GameFamily; eager?: boolean; detail?: boolean }) {
  const assetKey = getRoleAssetKey(role);
  const hasAsset =
    family === "mafia" ? KNOWN_MAFIA_ROLE_ASSETS.has(assetKey) : KNOWN_WEREWOLF_ROLE_ASSETS.has(assetKey);
  const source = hasAsset ? roleArtSource(family, role) : { src: "/game-art/card-back-secret.webp", width: 1024, height: 1536 };
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
