import { DayClueChips } from "./DayClueChips";
import { TutorialSlide } from "./TutorialSlide";

export function SlideDay() {
  return (
    <TutorialSlide
      bg="day"
      kicker="сцена 3 - денят"
      title="Денят се буди. Какво остана?"
      body={
        <p>
          Сега се събира масата. Един от вас вече го няма. Кой говори първо? Кой мълчи прекалено дълго?
          Денят е за четене на масата, не за бърза присъда.
        </p>
      }
      callout={{
        label: "Малък експеримент",
        text: "Това са пет примерни играчи. Разкрий няколко и виж как малка следа изгражда подозрение.",
      }}
    >
      <DayClueChips />
    </TutorialSlide>
  );
}
