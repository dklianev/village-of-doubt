import { ROLE_DEFINITIONS, type RoleCode } from "@werewolf/shared";
import { X } from "lucide-react";
import Image from "next/image";
import type { LobbyFormState } from "@/lib/lobby-form";
import { coverImageSizes, roleArtSource } from "@/lib/role-art";

export function InlineRoleDetail({
  family,
  role,
  onClose,
  heading = true,
}: {
  family: LobbyFormState["family"];
  role: RoleCode;
  onClose: () => void;
  heading?: boolean;
}) {
  const definition = ROLE_DEFINITIONS[role];
  const source = roleArtSource(family, role);
  return (
    <article className="create-inline-role-detail" aria-labelledby={heading ? "create-inline-role-title" : undefined} aria-label={heading ? undefined : definition.nameBg}>
      <button type="button" className="create-role-detail-close" aria-label="Затвори ролята" onClick={onClose}>
        <X aria-hidden="true" />
      </button>
      <picture className="role-art-frame" data-frame-family={family}
        style={{ aspectRatio: source.width / source.height, width: `min(100%, calc(var(--role-detail-art-height) * ${source.width / source.height}))` }}
        aria-hidden="true">
        <Image
          {...source}
          alt=""
          loading="lazy"
          quality={85}
          sizes={coverImageSizes(source, [
            { media: "(max-width: 380px)", width: "calc(100vw - 56px)", aspectRatio: 1 },
            { media: "(max-width: 720px)", width: "calc(100vw - 60px)", aspectRatio: 1 },
            { media: "(max-width: 960px)", width: 192, aspectRatio: 1 },
            { media: "(max-width: 1100px)", width: 262, aspectRatio: 1 },
            { width: 254, aspectRatio: 1 },
          ])}
        />
      </picture>
      {heading ? <div>
        <p className="section-kicker">как действа</p>
        <h2 id="create-inline-role-title">{definition.nameBg}</h2>
      </div> : null}
      <p>{definition.fullDescriptionBg}</p>
      <div className="role-detail-tags">
        {definition.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
    </article>
  );
}
