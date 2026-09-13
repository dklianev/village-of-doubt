import { ROLE_DEFINITIONS, type GameFamily, type RoleCode } from "@werewolf/shared";
import { Minus, Plus } from "lucide-react";
import Image from "next/image";
import { coverImageSizes, roleArtSource } from "@/lib/role-art";

export function RoleTileLarge({
  family,
  role,
  count,
  readonly = false,
  reserve = false,
  compactOnMobile = false,
  onIncrement,
  onDecrement,
  onOpen,
}: {
  family: GameFamily;
  role: RoleCode;
  count: number;
  readonly?: boolean;
  reserve?: boolean;
  compactOnMobile?: boolean;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onOpen: () => void;
}) {
  const definition = ROLE_DEFINITIONS[role];
  const source = roleArtSource(family, role);
  return (
    <article
      className="role-tile-large"
      data-readonly={readonly ? "true" : "false"}
      data-reserve={reserve ? "true" : "false"}
      data-selected={count > 0}
      data-team={definition.team}
    >
      <button type="button" className="role-tile-large-body" onClick={onOpen} onContextMenu={(event) => {
        if (readonly || reserve || count <= 0 || !onDecrement) return;
        event.preventDefault();
        onDecrement();
      }}>
        <picture className="role-art-frame" data-frame-family={family} aria-hidden="true">
          <Image
            {...source}
            alt=""
            loading="lazy"
            quality={85}
            sizes={coverImageSizes(source, [
              { media: "(max-width: 720px)", width: compactOnMobile ? 64 : 210, aspectRatio: compactOnMobile ? 64 / 88 : 2 / 3 },
              { width: 300, aspectRatio: 2 / 3 },
            ])}
          />
        </picture>
        <span className="role-tile-count">{count}</span>
        <span className="role-tile-caption">
          <strong>{definition.nameBg}</strong>
          <small>{definition.shortDescriptionBg}</small>
        </span>
      </button>
      {!readonly ? (
        reserve ? (
          <span className="role-tile-reserve-label">запълва местата</span>
        ) : (
          <div className="role-tile-controls">
            <button
              type="button"
              onClick={onDecrement}
              aria-label={`Премахни ${definition.nameBg}`}
              title={`Премахни ${definition.nameBg}`}
              disabled={count <= 0}
            >
              <Minus aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onIncrement}
              aria-label={`Добави ${definition.nameBg}`}
              title={`Добави ${definition.nameBg}`}
              disabled={count >= definition.maxCopies}
            >
              <Plus aria-hidden="true" />
            </button>
          </div>
        )
      ) : null}
    </article>
  );
}
