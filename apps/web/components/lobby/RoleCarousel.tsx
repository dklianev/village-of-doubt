"use client";

import type { GameFamily, RoleCode, RoleDistribution } from "@werewolf/shared";
import { RoleTileLarge } from "@/components/lobby/RoleTileLarge";

export function RoleCarousel({
  family,
  roles,
  distribution,
  readonly = false,
  onIncrement,
  onDecrement,
  onOpen,
}: {
  family: GameFamily;
  roles: RoleCode[];
  distribution: RoleDistribution;
  readonly?: boolean;
  onIncrement?: (role: RoleCode) => void;
  onDecrement?: (role: RoleCode) => void;
  onOpen: (role: RoleCode) => void;
}) {
  if (roles.length === 0) {
    return <p className="role-carousel-empty">Няма роли за този филтър.</p>;
  }

  return (
    <div className="role-carousel" aria-label="Избор на роли">
      {roles.map((role) => (
        <RoleTileLarge
          key={role}
          family={family}
          role={role}
          count={distribution[role] ?? 0}
          readonly={readonly}
          onIncrement={() => onIncrement?.(role)}
          onDecrement={() => onDecrement?.(role)}
          onOpen={() => onOpen(role)}
        />
      ))}
    </div>
  );
}
