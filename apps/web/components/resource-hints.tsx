"use client";

import ReactDOM from "react-dom";

export function ResourceHints({
  images = [],
  preconnect = [],
}: {
  images?: readonly string[];
  preconnect?: readonly string[];
}) {
  for (const origin of preconnect) {
    ReactDOM.preconnect(origin);
  }

  for (const image of images) {
    ReactDOM.preload(image, { as: "image" });
  }

  return null;
}
