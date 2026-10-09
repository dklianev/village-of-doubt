import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import sharp from "sharp";

test("phase boards preserve the approved source detail without palette intermediates", async () => {
  for (const family of ["mafia"]) {
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

test("retired Werewolf boards stay absent without removing the gameplay rail", () => {
  for (const phase of ["lobby", "role-reveal", "night", "day", "voting", "resolution"]) {
    assert.ok(existsSync(`apps/web/public/game-art/phase-rail/v1/werewolves/icon-phase-${phase}-128.webp`));
    for (const width of [560, 1120]) {
      assert.equal(existsSync(`apps/web/public/game-art/phase-board/v1/werewolves/icon-phase-${phase}-${width}.webp`), false);
    }
  }
});

test("dedicated Werewolf scenes preserve native dimensions and the master encoding", async () => {
  for (const scene of ["gathering", "secret-card", "vote"]) {
    const name = `rules/werewolf-${scene}-v1`;
    const source = `assets/game-art-source/${name}.png`;
    const output = `apps/web/public/game-art/${name}.webp`;
    const sourceMetadata = await sharp(source).metadata();
    const runtimeMetadata = await sharp(output).metadata();
    assert.equal(runtimeMetadata.width, sourceMetadata.width);
    assert.equal(runtimeMetadata.height, sourceMetadata.height);
    const reference = await sharp(source).rotate()
      .webp({ quality: 82, effort: 6, smartSubsample: true }).toBuffer();
    const expected = await sharp(reference).removeAlpha().raw().toBuffer();
    const actual = await sharp(output).removeAlpha().raw().toBuffer();
    assert.equal(actual.length, expected.length);
    const meanError = actual.reduce((sum, value, index) => sum + Math.abs(value - expected[index]), 0) / actual.length;
    assert.ok(meanError < 0.1, `${name} lost source detail (${meanError.toFixed(2)} mean pixel error)`);
  }
});
