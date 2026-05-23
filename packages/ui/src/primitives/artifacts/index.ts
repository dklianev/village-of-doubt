import type { ComponentType } from "react";
import { BalancedScale } from "./balanced-scale";
import { BrokenCandle } from "./broken-candle";
import { ClosedBook } from "./closed-book";
import { DustyShelf } from "./dusty-shelf";
import { EmptyChair } from "./empty-chair";
import { OpenDoor } from "./open-door";
import { SealedLetter } from "./sealed-letter";
import { UnprintedPaper } from "./unprinted-paper";

export {
  BalancedScale,
  BrokenCandle,
  ClosedBook,
  DustyShelf,
  EmptyChair,
  OpenDoor,
  SealedLetter,
  UnprintedPaper,
};

export type ArtifactKey =
  | "empty-chair"
  | "closed-book"
  | "sealed-letter"
  | "open-door"
  | "dusty-shelf"
  | "unprinted-paper"
  | "balanced-scale"
  | "broken-candle";

export const ARTIFACT_SVG: Record<ArtifactKey, ComponentType<{ size?: number }>> = {
  "empty-chair": EmptyChair,
  "closed-book": ClosedBook,
  "sealed-letter": SealedLetter,
  "open-door": OpenDoor,
  "dusty-shelf": DustyShelf,
  "unprinted-paper": UnprintedPaper,
  "balanced-scale": BalancedScale,
  "broken-candle": BrokenCandle,
};

export const ARTIFACT_PAINTERLY_PATH: Record<ArtifactKey, string> = {
  "empty-chair": "/empty-states/empty-chair.webp",
  "closed-book": "/empty-states/closed-book.webp",
  "sealed-letter": "/empty-states/sealed-letter.webp",
  "open-door": "/empty-states/open-door.webp",
  "dusty-shelf": "/empty-states/dusty-shelf.webp",
  "unprinted-paper": "/empty-states/unprinted-paper.webp",
  "balanced-scale": "/empty-states/balanced-scale.webp",
  "broken-candle": "/empty-states/broken-candle.webp",
};
