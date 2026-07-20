import { describe, expect, it } from "vitest";
import {
  computeSeatLayout,
  type SeatLayoutItem,
  type SeatLayoutRect,
} from "@/lib/play/seat-layout";

const CONTENT_WIDTH = 1200;
const CONTENT_HEIGHT = 680;
const MIN_HIT_SIZE = 44;
const RESERVED_HUD: SeatLayoutRect = {
  x: 390,
  y: 0,
  width: 420,
  height: 150,
};

function layout(count: number, minHitSize = MIN_HIT_SIZE) {
  return computeSeatLayout({
    contentWidth: CONTENT_WIDTH,
    contentHeight: CONTENT_HEIGHT,
    count,
    reservedHud: RESERVED_HUD,
    minHitSize,
  });
}

function boxesOverlap(a: SeatLayoutItem, b: SeatLayoutItem) {
  return Math.abs(a.x - b.x) < (a.hitSize + b.hitSize) / 2
    && Math.abs(a.y - b.y) < (a.hitSize + b.hitSize) / 2;
}

function boxOverlapsRect(seat: SeatLayoutItem, rect: SeatLayoutRect) {
  const half = seat.hitSize / 2;
  return seat.x + half > rect.x
    && seat.x - half < rect.x + rect.width
    && seat.y + half > rect.y
    && seat.y - half < rect.y + rect.height;
}

function renderedFootprintsOverlap(a: SeatLayoutItem, b: SeatLayoutItem, labelHeight: number) {
  const aWidth = Math.max(a.hitSize, a.visualSize * a.scale + 12);
  const bWidth = Math.max(b.hitSize, b.visualSize * b.scale + 12);
  const aHeight = Math.max(a.hitSize, a.visualSize * a.scale + labelHeight);
  const bHeight = Math.max(b.hitSize, b.visualSize * b.scale + labelHeight);

  return Math.abs(a.x - b.x) < (aWidth + bWidth) / 2
    && Math.abs(a.y - b.y) < (aHeight + bHeight) / 2;
}

function renderedFootprintOverlapsRect(seat: SeatLayoutItem, rect: SeatLayoutRect, labelHeight: number) {
  const width = Math.max(seat.hitSize, seat.visualSize * seat.scale + 12);
  const height = Math.max(seat.hitSize, seat.visualSize * seat.scale + labelHeight);
  return seat.x + width / 2 > rect.x
    && seat.x - width / 2 < rect.x + rect.width
    && seat.y + height / 2 > rect.y
    && seat.y - height / 2 < rect.y + rect.height;
}

describe("computeSeatLayout", () => {
  it.each(Array.from({ length: 16 }, (_, index) => index + 3))(
    "produces safe deterministic geometry for %i seats",
    (count) => {
      const seats = layout(count);

      expect(seats).toHaveLength(count);
      expect(layout(count)).toEqual(seats);

      for (const [index, seat] of seats.entries()) {
        expect(seat.index).toBe(index);
        expect(Number.isFinite(seat.x)).toBe(true);
        expect(Number.isFinite(seat.y)).toBe(true);
        expect(seat.hitSize).toBeGreaterThanOrEqual(MIN_HIT_SIZE);
        expect(seat.scale).toBeGreaterThanOrEqual(0.85);
        expect(seat.scale).toBeLessThanOrEqual(1.15);
        expect(seat.zIndex).toBeGreaterThanOrEqual(100);
        expect(seat.zIndex).toBeLessThanOrEqual(200);
        expect(seat.x - seat.hitSize / 2).toBeGreaterThanOrEqual(0);
        expect(seat.x + seat.hitSize / 2).toBeLessThanOrEqual(CONTENT_WIDTH);
        expect(seat.y - seat.hitSize / 2).toBeGreaterThanOrEqual(0);
        expect(seat.y + seat.hitSize / 2).toBeLessThanOrEqual(CONTENT_HEIGHT);
        expect(boxOverlapsRect(seat, RESERVED_HUD)).toBe(false);
      }

      for (let first = 0; first < seats.length; first += 1) {
        for (let second = first + 1; second < seats.length; second += 1) {
          expect(boxesOverlap(seats[first]!, seats[second]!)).toBe(false);
        }
      }
    },
  );

  it.each([
    [3, 92],
    [6, 92],
    [7, 76],
    [9, 76],
    [10, 62],
    [13, 62],
    [14, 52],
    [18, 52],
  ])("uses the expected visual density tier at %i seats", (count, expectedSize) => {
    expect(layout(count).every((seat) => seat.visualSize === expectedSize)).toBe(true);
  });

  it("makes front seats larger and layers them above rear seats", () => {
    const seats = layout(9);
    const rearSeat = seats.reduce((rear, seat) => seat.y < rear.y ? seat : rear);
    const frontSeat = seats.reduce((front, seat) => seat.y > front.y ? seat : front);

    expect(frontSeat.scale).toBeGreaterThan(rearSeat.scale);
    expect(frontSeat.hitSize).toBeGreaterThan(rearSeat.hitSize);
    expect(frontSeat.zIndex).toBeGreaterThan(rearSeat.zIndex);
  });

  it("places menus inward and away from the nearest stage edge", () => {
    for (const seat of layout(12)) {
      expect(seat.menuPlacement.x).toBe(seat.x <= CONTENT_WIDTH / 2 ? "right" : "left");
      expect(seat.menuPlacement.y).toBe(seat.y >= CONTENT_HEIGHT / 2 ? "up" : "down");
    }
  });

  it("keeps full seat footprints separate on a compact laptop table", () => {
    const seats = computeSeatLayout({
      contentWidth: 893,
      contentHeight: 294,
      count: 12,
      reservedHud: { x: 0, y: 0, width: 0, height: 0 },
      reservedCenter: { x: 378.5, y: 99.58, width: 136, height: 136 },
      minHitSize: MIN_HIT_SIZE,
    });

    for (let first = 0; first < seats.length; first += 1) {
      for (let second = first + 1; second < seats.length; second += 1) {
        expect(renderedFootprintsOverlap(seats[first]!, seats[second]!, 34)).toBe(false);
      }
    }
    expect(seats.every((seat) => seat.visualSize === 56)).toBe(true);
  });

  it("keeps neighboring arc distances balanced on crowded ellipses", () => {
    const seats = layout(18);
    const rightCount = Math.ceil(seats.length / 2);
    const distances = [seats.slice(0, rightCount), seats.slice(rightCount)]
      .flatMap((arc) => arc.slice(1).map((seat, index) => Math.hypot(
        seat.x - arc[index]!.x,
        seat.y - arc[index]!.y,
      )));
    const minimum = Math.min(...distances);
    const maximum = Math.max(...distances);

    expect(maximum / minimum).toBeLessThan(1.12);
  });

  it.each([13, 18])("keeps the full rendered footprint clear of the centered timer at %i seats", (count) => {
    const contentWidth = 893;
    const contentHeight = 345;
    const core: SeatLayoutRect = {
      x: contentWidth / 2 - 80,
      y: contentHeight / 2 - 80,
      width: 160,
      height: 160,
    };
    const seats = computeSeatLayout({
      contentWidth,
      contentHeight,
      count,
      reservedHud: { x: 0, y: 0, width: 0, height: 0 },
      reservedCenter: core,
      minHitSize: MIN_HIT_SIZE,
    });
    const labelHeight = count >= 14 ? 24 : 30;

    expect(seats.every((seat) => !renderedFootprintOverlapsRect(seat, core, labelHeight))).toBe(true);
  });

  it("uses two clean table-edge arcs for crowded layouts without an internal HUD", () => {
    const seats = computeSeatLayout({
      contentWidth: CONTENT_WIDTH,
      contentHeight: CONTENT_HEIGHT,
      count: 18,
      reservedHud: { x: 0, y: 0, width: 0, height: 0 },
      reservedCenter: { x: 520, y: 270, width: 160, height: 140 },
      minHitSize: MIN_HIT_SIZE,
    });

    for (let first = 0; first < seats.length; first += 1) {
      for (let second = first + 1; second < seats.length; second += 1) {
        expect(boxesOverlap(seats[first]!, seats[second]!)).toBe(false);
      }
    }
    expect(seats.slice(0, 9).every((seat) => seat.y < CONTENT_HEIGHT / 2)).toBe(true);
    expect(seats.slice(9).every((seat) => seat.y > CONTENT_HEIGHT / 2)).toBe(true);
  });

  it("honors a custom minimum hit size independently of the visual tier", () => {
    const seats = layout(18, 64);

    expect(seats.every((seat) => seat.visualSize === 52)).toBe(true);
    expect(seats.every((seat) => seat.hitSize >= 64)).toBe(true);
  });

  it.each([
    { count: 2 },
    { count: 19 },
    { count: 3.5 },
    { contentWidth: 0 },
    { contentHeight: Number.NaN },
    { minHitSize: -1 },
  ])("rejects invalid scalar input: %o", (override) => {
    expect(() => computeSeatLayout({
      contentWidth: CONTENT_WIDTH,
      contentHeight: CONTENT_HEIGHT,
      count: 8,
      reservedHud: RESERVED_HUD,
      minHitSize: MIN_HIT_SIZE,
      ...override,
    })).toThrow(RangeError);
  });

  it("rejects a reserved HUD rectangle outside the content box", () => {
    expect(() => computeSeatLayout({
      contentWidth: CONTENT_WIDTH,
      contentHeight: CONTENT_HEIGHT,
      count: 8,
      reservedHud: { x: 1000, y: 0, width: 300, height: 100 },
      minHitSize: MIN_HIT_SIZE,
    })).toThrow(RangeError);
  });
});
