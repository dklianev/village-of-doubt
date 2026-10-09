import { TutorialSlide } from "./TutorialSlide";
import { DayClueChips } from "./DayClueChips";
import type { TutorialSceneProps } from "./tutorial-scenario";
import { nightFinding } from "./tutorial-feedback";

export function SlideDay(props: TutorialSceneProps) {
  return (
    <TutorialSlide bg="day" kicker="сцена 3 - една маса, три версии" title="Кой разказва истината?"
      body={<><p>В нашата примерна вечер всички са оцелели. Анна забелязва противоречие, Борис го отрича, а Галя иска обяснение.</p>
        <p>Чуй тримата. Твоят личен резултат може да помогне, но останалите не знаят дали да ти вярват.</p></>}
      callout={{ label: props.practice.night ? "Помниш ли проверката?" : "Подозрение, не доказателство",
        text: props.practice.night ? nightFinding(props.mode, props.practice.night) : "Не си направил примерна проверка. Можеш да сравниш репликите, но увереността и мълчанието сами по себе си не издават роля." }}>
      <DayClueChips practice={props.practice} onPracticeChange={props.onPracticeChange} />
    </TutorialSlide>
  );
}
