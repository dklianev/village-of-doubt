import { TutorialSlide } from "./TutorialSlide";
import { EyeOff } from "lucide-react";
import { getImageProps } from "next/image";
import { tutorialWorld, type TutorialMode } from "./tutorial-scenario";

export function SlideSetup({ mode }: { mode: TutorialMode }) {
  const world = tutorialWorld(mode);
  const { props: roleImage } = getImageProps({
    src: world.roleArt, width: 520, height: 780,
    sizes: "(max-width: 640px) 84px, 112px", quality: 85,
    loading: "lazy", fetchPriority: "low", alt: `Карта на ${world.role}`,
  });
  return (
    <TutorialSlide
      bg="day"
      kicker="сцена 1 - преди нощта"
      title="Масата се събира."
      body={
        <>
          <p>
            Домакинът създава стая и споделя кода. Поканените влизат в профилите си и се присъединяват.
            Картите се раздават, когато домакинът започне играта.
          </p>
          <p>
            Тази вечер си {world.role}. Анна, Борис и Галя са трима от {mode === "mafia_sport" ? "десетте" : "осемте"} на примерната маса.
            След малко ще провериш един от тях.
          </p>
        </>
      }
      callout={{
        label: "За какво се бориш",
        text: `${world.town} трябва да отстрани всички вражески заплахи. Скритият отбор познава своите и се опитва да надделее. Твоята проверка помага на ${world.mafia ? "Града" : "Селото"}.`,
      }}
    >
      <aside className="tutorial-role" aria-label="Примерната ти роля">
        <img {...roleImage} />
        <div>
          <p className="tutorial-role-private"><EyeOff size={15} aria-hidden="true" /> Само за теб</p>
          <h2>{world.role}</h2>
          <p>{world.mafia ? "Проверяваш дали избраният играч е от Мафията." : "Проверяваш дали избраният играч е Върколак или Вампир, без да научаваш точната му роля."}</p>
          <span>Примерна карта. Не я показвай на останалите в истинска игра.</span>
        </div>
      </aside>
    </TutorialSlide>
  );
}
