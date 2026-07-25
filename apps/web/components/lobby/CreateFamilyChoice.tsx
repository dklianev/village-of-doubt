import Link from "next/link";
import { ArrowRight, Moon, VenetianMask } from "lucide-react";

export function CreateFamilyChoice({ searchParams }: { searchParams: URLSearchParams }) {
  const werewolfHref = familyHref("/werewolf/create", searchParams);
  const mafiaHref = familyHref("/mafia/create", searchParams);

  return (
    <section className="create-family-choice" aria-labelledby="create-family-title">
      <header className="create-family-heading">
        <p className="create-quick-kicker">нова вечер на масата</p>
        <h1 id="create-family-title">Коя история започва тази вечер?</h1>
        <p>Избери света. Ние ще подготвим балансирана стая, която можеш да отвориш веднага.</p>
      </header>

      <div className="create-family-scenes">
        <Link className="create-family-scene" data-family="werewolves" href={werewolfHref}>
          <span className="create-family-scene-icon" aria-hidden="true">
            <Moon />
          </span>
          <span className="create-family-scene-copy">
            <small>фолклорен хорър · 6-30 души</small>
            <strong>Върколак</strong>
            <span>Селото заспива. Тайните роли се събуждат около една обща история.</span>
          </span>
          <b>
            Избери Върколак
            <ArrowRight aria-hidden="true" />
          </b>
        </Link>

        <Link className="create-family-scene" data-family="mafia" href={mafiaHref}>
          <span className="create-family-scene-icon" aria-hidden="true">
            <VenetianMask />
          </span>
          <span className="create-family-scene-copy">
            <small>градска мистерия · 4-24 души</small>
            <strong>Мафия</strong>
            <span>Лампата свети ниско. Всеки има алиби, но не всеки казва истината.</span>
          </span>
          <b>
            Избери Мафия
            <ArrowRight aria-hidden="true" />
          </b>
        </Link>
      </div>
    </section>
  );
}

function familyHref(path: "/werewolf/create" | "/mafia/create", current: URLSearchParams) {
  const params = new URLSearchParams(current);
  params.delete("mode");
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
