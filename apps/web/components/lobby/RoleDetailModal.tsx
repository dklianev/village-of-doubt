"use client";

import Image from "next/image";
import { ROLE_DEFINITIONS, teamLabelBg, type GameFamily, type RoleCode } from "@werewolf/shared";
import { roleThumbPath } from "@/lib/role-art";
import { useModal } from "@/lib/use-modal";

export function RoleDetailModal({
  family,
  role,
  onClose,
}: {
  family: GameFamily;
  role: RoleCode;
  onClose: () => void;
}) {
  const definition = ROLE_DEFINITIONS[role];
  const { ref } = useModal({ open: true, onClose });

  return (
    <div ref={ref} className="role-detail-modal" role="dialog" aria-modal="true" aria-labelledby="role-detail-title">
      <button type="button" className="role-detail-backdrop" aria-label="Затвори ролята" onClick={onClose} />
      <article className="role-detail-card">
        <picture aria-hidden="true">
          <Image src={roleThumbPath(family, role)} alt="" width={520} height={728} sizes="230px" />
        </picture>
        <div>
          <p className="section-kicker">{teamLabelBg(definition.team, family)}</p>
          <h2 id="role-detail-title">{definition.nameBg}</h2>
          <p>{definition.fullDescriptionBg}</p>
          <div className="role-detail-tags">
            {definition.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <div className="role-detail-tips">
            <span>Когато съм: пазя информацията си и търся точния момент.</span>
            <span>Срещу мен: следя кой печели от всяко обвинение.</span>
          </div>
          {definition.dependencies.length > 0 ? (
            <ul>
              {definition.dependencies.map((dependency) => (
                <li key={dependency.roleId}>{dependency.reasonBg}</li>
              ))}
            </ul>
          ) : null}
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Готово
          </button>
        </div>
      </article>
    </div>
  );
}
