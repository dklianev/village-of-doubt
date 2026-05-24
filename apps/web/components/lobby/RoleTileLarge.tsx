import Image from "next/image";
import { ROLE_DEFINITIONS, type GameFamily, type RoleCode } from "@werewolf/shared";
import { roleThumbPath } from "@/lib/role-art";

export function RoleTileLarge({
  family,
  role,
  count,
  readonly = false,
  onIncrement,
  onDecrement,
  onOpen,
}: {
  family: GameFamily;
  role: RoleCode;
  count: number;
  readonly?: boolean;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onOpen: () => void;
}) {
  const definition = ROLE_DEFINITIONS[role];
  return (
    <article className="role-tile-large" data-selected={count > 0}>
      <button type="button" className="role-tile-large-body" onClick={onOpen} onContextMenu={(event) => {
        event.preventDefault();
        onDecrement?.();
      }}>
        <picture aria-hidden="true">
          <Image src={roleThumbPath(family, role)} alt="" width={520} height={728} sizes="220px" />
        </picture>
        <span className="role-tile-count">{count}</span>
        <strong>{definition.nameBg}</strong>
      </button>
      {!readonly ? (
        <div className="role-tile-controls">
          <button type="button" onClick={onDecrement} aria-label={`Премахни ${definition.nameBg}`}>-</button>
          <button type="button" onClick={onIncrement} aria-label={`Добави ${definition.nameBg}`}>+</button>
        </div>
      ) : null}
    </article>
  );
}
