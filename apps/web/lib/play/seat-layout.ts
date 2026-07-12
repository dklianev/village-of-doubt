export interface SeatLayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SeatLayoutInput {
  contentWidth: number;
  contentHeight: number;
  count: number;
  reservedHud: SeatLayoutRect;
  reservedCenter?: SeatLayoutRect;
  minHitSize: number;
}

export interface SeatMenuPlacement {
  x: "left" | "right";
  y: "up" | "down";
}

export interface SeatLayoutItem {
  index: number;
  x: number;
  y: number;
  visualSize: number;
  hitSize: number;
  scale: number;
  zIndex: number;
  menuPlacement: SeatMenuPlacement;
}

const MIN_PLAYER_COUNT = 3;
const MAX_PLAYER_COUNT = 18;
const MIN_SCALE = 0.85;
const MAX_SCALE = 1.15;
const MIN_TOP_GAP_HALF_DEGREES = 24;
const HUD_CLEARANCE_PX = 8;
const ANGLE_SCAN_STEP_DEGREES = 0.25;
const MIN_BOTTOM_GAP_HALF_DEGREES = 20;
const VERTICAL_PERIMETER_BLEED_PX = 20;

/**
 * Computes pixel geometry for seats around a wide desktop stage.
 * `visualSize` is the unscaled diameter; `hitSize` is the final interactive
 * diameter after perspective has been applied.
 */
export function computeSeatLayout(input: SeatLayoutInput): SeatLayoutItem[] {
  validateInput(input);

  const visualSize = visualSizeForCount(input.count);
  const labelWidth = input.count >= 14 ? 8 : 12;
  const labelHeight = input.count >= 14 ? 24 : input.count >= 10 ? 30 : 33;
  const maxFootprintWidth = Math.max(input.minHitSize, visualSize * MAX_SCALE + labelWidth);
  const maxFootprintHeight = Math.max(input.minHitSize, visualSize * MAX_SCALE + labelHeight);
  if (input.contentWidth < maxFootprintWidth || input.contentHeight < maxFootprintHeight) {
    throw new RangeError("Seat layout content is too small for the requested hit size");
  }

  const centerX = input.contentWidth / 2;
  const centerY = input.contentHeight / 2;
  const radiusX = (input.contentWidth - maxFootprintWidth) / 2;
  const radiusY = Math.min(
    (input.contentHeight - maxFootprintHeight) / 2 + VERTICAL_PERIMETER_BLEED_PX,
    radiusX * 0.46,
  );
  const footprintHalf = Math.max(maxFootprintWidth, maxFootprintHeight) / 2;
  const expandedHud = expandRect(input.reservedHud, footprintHalf + HUD_CLEARANCE_PX);
  const centerClearance = input.count >= 14
    ? input.minHitSize / 2 + 4
    : footprintHalf + HUD_CLEARANCE_PX;
  const expandedCenter = input.reservedCenter
    ? expandRect(input.reservedCenter, centerClearance)
    : undefined;
  const rightGap = Math.max(
    MIN_TOP_GAP_HALF_DEGREES,
    firstClearAngle(centerX, centerY, radiusX, radiusY, expandedHud, 1) + 2,
  );
  const leftGap = Math.max(
    MIN_TOP_GAP_HALF_DEGREES,
    firstClearAngle(centerX, centerY, radiusX, radiusY, expandedHud, -1) + 2,
  );
  const bottomGap = expandedCenter
    ? Math.max(
      MIN_BOTTOM_GAP_HALF_DEGREES,
      firstClearBottomAngle(centerX, centerY, radiusX, radiusY, expandedCenter) + 2,
    )
    : MIN_BOTTOM_GAP_HALF_DEGREES;
  const rightArc = 180 - bottomGap - rightGap;
  const leftArc = 180 - bottomGap - leftGap;

  if (rightArc <= 0 || leftArc <= 0) {
    throw new RangeError("Reserved HUD leaves no perimeter for seat layout");
  }

  const firstArcCount = Math.ceil(input.count / 2);
  const secondArcCount = input.count - firstArcCount;
  const useCrowdedRows = input.count >= 13
    && input.reservedHud.width === 0
    && input.reservedHud.height === 0;
  const angles = useCrowdedRows
    ? [
      ...arcAngles(-52, 104, firstArcCount, radiusX, radiusY),
      ...arcAngles(112, 136, secondArcCount, radiusX, radiusY),
    ]
    : [
      ...arcAngles(rightGap, rightArc, firstArcCount, radiusX, radiusY),
      ...arcAngles(180 + bottomGap, leftArc, secondArcCount, radiusX, radiusY),
    ];

  const seats: SeatLayoutItem[] = angles.map((angleDegrees, index) => {
    const angle = degreesToRadians(angleDegrees);
    const x = centerX + radiusX * Math.sin(angle);
    const y = centerY - radiusY * Math.cos(angle);
    const roundedX = round(x, 3);
    const roundedY = round(y, 3);
    const depth = (1 - Math.cos(angle)) / 2;
    const scale = MIN_SCALE + (MAX_SCALE - MIN_SCALE) * depth;

    return {
      index,
      x: roundedX,
      y: roundedY,
      visualSize,
      hitSize: round(Math.max(input.minHitSize, visualSize * scale), 3),
      scale: round(scale, 4),
      zIndex: 100 + Math.round(depth * 100),
      menuPlacement: {
        x: roundedX <= round(centerX, 3) ? "right" : "left",
        y: roundedY >= round(centerY, 3) ? "up" : "down",
      },
    };
  });

  return seats;
}

function arcAngles(
  startDegrees: number,
  spanDegrees: number,
  count: number,
  radiusX: number,
  radiusY: number,
) {
  if (count === 0) {
    return [];
  }
  if (count === 1) {
    return [angleAtArcFraction(startDegrees, spanDegrees, 0.5, radiusX, radiusY)];
  }
  return Array.from({ length: count }, (_, index) => angleAtArcFraction(
    startDegrees,
    spanDegrees,
    index / (count - 1),
    radiusX,
    radiusY,
  ));
}

function visualSizeForCount(count: number) {
  if (count <= 6) {
    return 92;
  }
  if (count <= 9) {
    return 76;
  }
  if (count <= 13) {
    return 62;
  }
  return 52;
}

function firstClearAngle(
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  expandedHud: SeatLayoutRect,
  direction: 1 | -1,
) {
  for (let degrees = 0; degrees <= 180; degrees += ANGLE_SCAN_STEP_DEGREES) {
    const angle = degreesToRadians(degrees * direction);
    const x = centerX + radiusX * Math.sin(angle);
    const y = centerY - radiusY * Math.cos(angle);
    if (!containsPoint(expandedHud, x, y)) {
      return degrees;
    }
  }
  return 180;
}

function firstClearBottomAngle(
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  expandedCenter: SeatLayoutRect,
) {
  for (let degrees = 0; degrees <= 90; degrees += ANGLE_SCAN_STEP_DEGREES) {
    const rightAngle = degreesToRadians(180 - degrees);
    const leftAngle = degreesToRadians(180 + degrees);
    const rightClear = !containsPoint(
      expandedCenter,
      centerX + radiusX * Math.sin(rightAngle),
      centerY - radiusY * Math.cos(rightAngle),
    );
    const leftClear = !containsPoint(
      expandedCenter,
      centerX + radiusX * Math.sin(leftAngle),
      centerY - radiusY * Math.cos(leftAngle),
    );
    if (rightClear && leftClear) {
      return degrees;
    }
  }
  return 90;
}

function angleAtArcFraction(
  startDegrees: number,
  spanDegrees: number,
  fraction: number,
  radiusX: number,
  radiusY: number,
) {
  const sampleCount = Math.max(64, Math.ceil(spanDegrees * 2));
  const samples: Array<{ angle: number; length: number; x: number; y: number }> = [];
  let totalLength = 0;

  for (let index = 0; index <= sampleCount; index += 1) {
    const angle = startDegrees + (spanDegrees * index) / sampleCount;
    const radians = degreesToRadians(angle);
    const x = radiusX * Math.sin(radians);
    const y = -radiusY * Math.cos(radians);
    const previous = samples.at(-1);
    if (previous) {
      totalLength += Math.hypot(x - previous.x, y - previous.y);
    }
    samples.push({ angle, length: totalLength, x, y });
  }

  const targetLength = totalLength * Math.min(1, Math.max(0, fraction));
  const upperIndex = samples.findIndex((sample) => sample.length >= targetLength);
  if (upperIndex <= 0) {
    return samples[0]?.angle ?? startDegrees;
  }
  const lower = samples[upperIndex - 1]!;
  const upper = samples[upperIndex]!;
  const segmentLength = upper.length - lower.length;
  const progress = segmentLength <= 0 ? 0 : (targetLength - lower.length) / segmentLength;
  return lower.angle + (upper.angle - lower.angle) * progress;
}

function expandRect(rect: SeatLayoutRect, amount: number): SeatLayoutRect {
  if (rect.width === 0 || rect.height === 0) {
    return rect;
  }
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2,
  };
}

function containsPoint(rect: SeatLayoutRect, x: number, y: number) {
  if (rect.width === 0 || rect.height === 0) {
    return false;
  }
  return x >= rect.x
    && x <= rect.x + rect.width
    && y >= rect.y
    && y <= rect.y + rect.height;
}

function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function round(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function validateInput(input: SeatLayoutInput) {
  assertPositiveFinite(input.contentWidth, "contentWidth");
  assertPositiveFinite(input.contentHeight, "contentHeight");
  assertPositiveFinite(input.minHitSize, "minHitSize");

  if (!Number.isInteger(input.count) || input.count < MIN_PLAYER_COUNT || input.count > MAX_PLAYER_COUNT) {
    throw new RangeError(`count must be an integer from ${MIN_PLAYER_COUNT} to ${MAX_PLAYER_COUNT}`);
  }

  const rectValues = [
    input.reservedHud.x,
    input.reservedHud.y,
    input.reservedHud.width,
    input.reservedHud.height,
  ];
  if (rectValues.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError("reservedHud values must be finite and non-negative");
  }
  if (
    input.reservedHud.x + input.reservedHud.width > input.contentWidth
    || input.reservedHud.y + input.reservedHud.height > input.contentHeight
  ) {
    throw new RangeError("reservedHud must fit inside the content box");
  }
  if (input.reservedCenter) {
    const { x, y, width, height } = input.reservedCenter;
    if ([x, y, width, height].some((value) => !Number.isFinite(value) || value < 0)) {
      throw new RangeError("reservedCenter values must be finite and non-negative");
    }
    if (x + width > input.contentWidth || y + height > input.contentHeight) {
      throw new RangeError("reservedCenter must fit inside the content box");
    }
  }
}

function assertPositiveFinite(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}
