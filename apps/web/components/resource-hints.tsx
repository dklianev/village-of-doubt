"use client";

import ReactDOM from "react-dom";

export function ResourceHints({ images }: { images: readonly string[] }) {
  for (const image of images) {
    ReactDOM.preload(image, { as: "image" });
  }

  return null;
}
