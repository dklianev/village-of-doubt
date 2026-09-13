import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

test("phase boards preserve the approved source detail without palette intermediates", async () => {
  for (const family of ["werewolves", "mafia"]) {
    const sourceDirectory = family === "mafia" ? "mafia/" : "";
    const source = `assets/game-art-source/${sourceDirectory}icon-phase-day.png`;
    for (const width of [560, 1120]) {
      const output = `apps/web/public/game-art/phase-board/v1/${family}/icon-phase-day-${width}.webp`;
      const reference = await sharp(source)
        .resize(width, width * 5 / 7, { fit: "cover", position: "centre", withoutEnlargement: true })
        .webp({ quality: 74, effort: 6 })
        .toBuffer();
      const expected = await sharp(reference).removeAlpha().raw().toBuffer();
      const actual = await sharp(output).removeAlpha().raw().toBuffer();
      assert.equal(actual.length, expected.length);
      const meanError = actual.reduce((sum, value, index) => sum + Math.abs(value - expected[index]), 0) / actual.length;
      assert.ok(meanError < 0.1, `${family} phase board no longer matches the approved high-detail encoding (${meanError.toFixed(2)} mean pixel error)`);
    }
  }
});
