export type CoverImageSlot = {
  media?: string;
  width: number | string;
  /** Target image box width divided by height, after any frame padding. */
  aspectRatio: number;
};

export function coverImageSizes(
  source: { width: number; height: number },
  slots: readonly CoverImageSlot[],
) {
  return slots.map(({ media, width, aspectRatio }) => {
    // Cover may scale to the box height. `auto` would discard that extra width.
    const factor = Math.max(1, source.width / source.height / aspectRatio);
    const slotWidth = typeof width === "number" ? `${width}px` : width;
    const size = factor === 1 ? slotWidth : `calc(${slotWidth} * ${factor})`;
    return media ? `${media} ${size}` : size;
  }).join(", ");
}
