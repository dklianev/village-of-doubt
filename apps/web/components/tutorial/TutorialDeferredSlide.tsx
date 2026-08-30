import { SlideDay } from "./SlideDay";
import { SlideFinal } from "./SlideFinal";
import { SlideNight } from "./SlideNight";
import { SlideResolution } from "./SlideResolution";
import { SlideVote } from "./SlideVote";

type DeferredSlide = 2 | 3 | 4 | 5 | 6;

export function TutorialDeferredSlide({ slide }: { slide: DeferredSlide }) {
  switch (slide) {
    case 2:
      return <SlideNight />;
    case 3:
      return <SlideDay />;
    case 4:
      return <SlideVote />;
    case 5:
      return <SlideResolution />;
    case 6:
      return <SlideFinal />;
  }
}
