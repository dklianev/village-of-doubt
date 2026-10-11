import Link from "next/link";
import { ArrowRight, BookOpen, KeyRound, Users } from "lucide-react";
import { TutorialSlide } from "./TutorialSlide";
import { tutorialWorld, type TutorialSceneProps } from "./tutorial-scenario";
import { tutorialDestination } from "./tutorial-destination";

export function SlideFinal({ mode, continueHref }: TutorialSceneProps) {
  const world = tutorialWorld(mode);
  const destination = continueHref ? tutorialDestination(continueHref) : null;
  const invitation = destination?.invitation;
  return (
    <TutorialSlide bg="night" kicker="сцена 6 - твоята истинска вечер" title="Изборът сега е твой."
      body={<p>{invitation ? "Поканата ти е запазена. Върни се при компанията, когато си готов." : continueHref ? "Вече познаваш първите ходове. Продължи оттам, откъдето започна." : "Знаеш първите ходове. Имаш код от приятел или ще събереш своя компания?"}</p>}>
      <div className="tutorial-final-destination">
        <p className="tutorial-role-private">{destination ? invitation ? "Запазена покана" : destination.name ? `Запазена дестинация: ${destination.name}` : "Запазена страница" : world.name}</p>
        <h2>{invitation ? "Поканата те чака." : "Следва истинската маса."}</h2>
        <div className="tutorial-final-actions">
          {continueHref ? <Link href={continueHref} prefetch={false} className="btn btn-primary">
            {invitation ? "Продължи към поканата" : destination?.name ? `Към стая за ${destination.name}` : "Продължи към запазената страница"} <ArrowRight size={18} aria-hidden="true" />
          </Link> : <>
            <Link href={`/${world.family}/join`} prefetch={false} className="btn btn-primary"><KeyRound size={18} aria-hidden="true" /> Имам код</Link>
            <Link href={world.create} prefetch={false} className="btn btn-secondary">Създай стая <ArrowRight size={18} aria-hidden="true" /></Link>
          </>}
        </div>
        {continueHref ? <Link href={world.create} prefetch={false} className="tutorial-return-link">Или създай стая за {world.name} <ArrowRight size={15} aria-hidden="true" /></Link> : null}
      </div>
      <div className="tutorial-final-secondary-grid">
        <Link href={`/${world.family}/rules`} prefetch={false} className="tutorial-final-secondary-card"><BookOpen size={17} aria-hidden="true" /> Правила за {world.mafia ? "Мафия" : "Върколак"}</Link>
        <Link href={`/${world.family}/roles`} prefetch={false} className="tutorial-final-secondary-card"><Users size={17} aria-hidden="true" /> Ролите {world.mafia ? "в Мафия" : "във Върколак"}</Link>
      </div>
    </TutorialSlide>
  );
}
