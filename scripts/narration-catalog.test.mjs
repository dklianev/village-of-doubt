import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { formatNarrationReport, runCli, validateNarrationCatalog } from "./narration-catalog.mjs";

const VOICES = ["classic", "old_villager", "inspector", "witch"];
const BG = "\u041d\u043e\u0449\u0442\u0430 \u0438\u0434\u0432\u0430.";
const SCRIPT = fileURLToPath(new URL("./narration-catalog.mjs", import.meta.url));

test("the source draft covers both families and every supported public finale", async () => {
  const catalog = JSON.parse(await readFile(new URL("../assets/narration-source/catalog.v1.json", import.meta.url), "utf8"));
  const checked = validateNarrationCatalog(catalog);
  assert.equal(checked.valid, true, JSON.stringify(checked.errors));
  const has = (kind, family, field, value) => catalog.cues.some((entry) => entry.kind === kind
    && (entry.family === family || entry.family === "both") && entry[field] === value);
  for (const family of ["werewolves", "mafia"]) {
    for (const phase of ["role_reveal", "first_night", "night", "day_announcement", "day_discussion", "voting", "resolution"]) {
      assert.ok(has("phase", family, "phase", phase), `${family}/${phase}`);
    }
    for (const winner of ["village", "lovers", "draw"]) {
      assert.ok(has("finale", family, "winner", winner), `${family}/${winner}`);
    }
  }
  for (const [family, winner] of [["werewolves", "werewolves"], ["werewolves", "vampires"], ["mafia", "mafia"], ["mafia", "maniac"]]) {
    assert.ok(has("finale", family, "winner", winner), `${family}/${winner}`);
  }
  for (const [family, phase] of [["mafia", "nomination"], ["mafia", "defense"], ["werewolves", "hunter_revenge"], ["werewolves", "mayor_successor"]]) {
    assert.ok(has("phase", family, "phase", phase), `${family}/${phase}`);
  }
  assert.ok(catalog.cues.some((entry) => entry.kind === "personal-finale" && entry.family === "both"));
  assert.ok(catalog.cues.some((entry) => entry.kind === "preview"));
});

function cue(overrides = {}) {
  return {
    id: "both.phase.night",
    family: "both",
    kind: "phase",
    phase: "night",
    eligibilityBg: BG,
    lines: Object.fromEntries(VOICES.map((voice) => [voice, BG])),
    ...overrides,
  };
}

function fixture(cues = [cue()]) {
  return {
    version: 1,
    modelId: "eleven_v4",
    language: "bg",
    status: "draft",
    voices: VOICES.map((id) => ({ id, labelBg: BG, directionBg: BG })),
    cues,
  };
}

function reject(catalog, code, at) {
  const result = validateNarrationCatalog(catalog);
  assert.equal(result.valid, false);
  assert.equal(result.report, null, "invalid input must never yield a production estimate");
  assert.ok(result.errors.some((error) => error.code === code && (!at || error.path === at)), JSON.stringify(result.errors));
  return result;
}

test("reports exact spoken volume without pricing or production approval", () => {
  const input = fixture();
  const before = structuredClone(input);
  const { valid, errors, report } = validateNarrationCatalog(input);
  assert.equal(valid, true);
  assert.deepEqual(errors, []);
  assert.deepEqual(input, before);
  assert.equal(report.status, "draft");
  assert.equal(report.productionReady, false);
  assert.equal(report.cueCount, 1);
  assert.equal(report.lineCount, 4);
  assert.equal(report.characterCount, [...BG].length * 4);
  assert.equal(report.maxLineCharacters, [...BG].length);
  assert.equal(report.symbolicEstimate.perTake, report.characterCount);
  assert.equal(report.symbolicEstimate.isCreditEstimate, false);
  assert.deepEqual(report.charactersPerVoice, Object.fromEntries(VOICES.map((voice) => [voice, [...BG].length])));
  assert.deepEqual(report.cuesPerFamily, { werewolves: 0, mafia: 0, both: 1 });
  assert.deepEqual(report.cuesPerKind, { phase: 1, finale: 0, "personal-finale": 0, preview: 0 });
  assert.match(formatNarrationReport(report), /DRAFT ONLY - NOT PRODUCTION READY/);
  assert.match(formatNarrationReport(report), /Symbolic estimate: .*NOT credits or a price/);
});

test("does not impose a fixed cue count or reject repeated phase variants", () => {
  const entries = Array.from({ length: 73 }, (_, index) => cue({ id: `both.night.variant-${index}` }));
  const result = validateNarrationCatalog(fixture(entries));
  assert.equal(result.valid, true);
  assert.equal(result.report.lineCount, 73 * 4);
  assert.equal(result.report.characterCount, [...BG].length * 73 * 4);
});

test("accepts reordered voices and JSON records with a null prototype", () => {
  const input = fixture();
  input.voices.reverse();
  assert.equal(validateNarrationCatalog(Object.assign(Object.create(null), input)).valid, true);
});

test("rejects non-object roots, missing root data and incorrect literals", () => {
  for (const value of [null, undefined, [], "catalog", 1, new Date(), new Map()]) reject(value, "object");
  for (const key of Object.keys(fixture())) {
    const input = fixture();
    delete input[key];
    reject(input, "required", `$.${key}`);
  }
  for (const [key, value] of [["version", "1"], ["version", 2], ["modelId", "eleven_v3"], ["language", "en"], ["status", "approved"]]) {
    reject({ ...fixture(), [key]: value }, "literal", `$.${key}`);
  }
});

test("rejects missing, duplicate, extra and unrecognized voices", () => {
  for (const voices of [[], fixture().voices.slice(0, 3), [...fixture().voices, fixture().voices[0]]]) {
    reject({ ...fixture(), voices }, "voice-set");
  }
  const duplicate = fixture();
  duplicate.voices[3] = { ...duplicate.voices[0] };
  reject(duplicate, "duplicate", "$.voices[3].id");
  const unknown = fixture();
  unknown.voices[3].id = "celebrity";
  reject(unknown, "voice", "$.voices[3].id");
  for (const voices of [null, {}, "classic"]) reject({ ...fixture(), voices }, "array", "$.voices");
  const malformed = fixture();
  malformed.voices[0] = null;
  reject(malformed, "object", "$.voices[0]");
});

test("requires Bulgarian voice labels, direction and eligibility", () => {
  for (const key of ["labelBg", "directionBg"]) {
    for (const value of ["", "  ", 10, null, "English only"]) {
      const input = fixture();
      input.voices[0][key] = value;
      reject(input, typeof value === "string" && value.trim() ? "language" : "text", `$.voices[0].${key}`);
    }
    const input = fixture();
    delete input.voices[0][key];
    reject(input, "required", `$.voices[0].${key}`);
  }
  for (const eligibilityBg of ["", "\n\t", null, {}, "Only English"]) {
    reject(fixture([cue({ eligibilityBg })]), typeof eligibilityBg === "string" && eligibilityBg.trim() ? "language" : "text");
  }
});

test("rejects empty, malformed and sparse cue collections", () => {
  for (const cues of [[], null, {}, "night"]) reject({ ...fixture(), cues }, "array", "$.cues");
  for (const value of [null, [], true]) reject(fixture([value]), "object", "$.cues[0]");
  reject(fixture(new Array(1)), "object", "$.cues[0]");
  for (const key of ["id", "family", "kind", "eligibilityBg", "lines"]) {
    const entry = cue();
    delete entry[key];
    reject(fixture([entry]), "required", `$.cues[0].${key}`);
  }
});

test("rejects duplicate or malformed lowercase dot-separated IDs", () => {
  reject(fixture([cue(), cue()]), "duplicate", "$.cues[1].id");
  for (const id of ["", "night", ".night", "night.", "both..night", "Both.night", "both/night", "both.night ", "both.night\n", "both.1", "__proto__", null, 12]) {
    reject(fixture([cue({ id })]), "id", "$.cues[0].id");
  }
});

test("rejects unknown fields at every level without disclosing values or keys", () => {
  const privateMarker = "PRIVATE_DATA_DO_NOT_LOG";
  for (const level of ["root", "voice", "cue", "lines"]) {
    for (const key of ["playerName", "secretRole", "apiKey", "targetUserId", "voice_id", privateMarker, "__proto__"]) {
      const input = fixture();
      const target = { root: input, voice: input.voices[0], cue: input.cues[0], lines: input.cues[0].lines }[level];
      Object.defineProperty(target, key, { value: privateMarker, enumerable: true });
      const result = reject(input, "unknown-key");
      assert.ok(!JSON.stringify(result).includes(privateMarker));
    }
  }
  const symbol = fixture();
  symbol[Symbol("private")] = true;
  reject(symbol, "unknown-key");
});

test("rejects all missing, non-string or empty spoken lines", () => {
  for (const voice of VOICES) {
    const missing = cue();
    delete missing.lines[voice];
    reject(fixture([missing]), "required", `$.cues[0].lines.${voice}`);
    for (const value of ["", " \n\t ", null, 0, [], {}]) {
      const entry = cue();
      entry.lines[voice] = value;
      reject(fixture([entry]), "text", `$.cues[0].lines.${voice}`);
    }
  }
  for (const lines of [null, [], BG]) reject(fixture([cue({ lines })]), "object", "$.cues[0].lines");
});

test("enforces 400 code points per line, not a total script-length threshold", () => {
  const input = fixture();
  input.cues[0].lines.classic = "\u0430".repeat(400);
  assert.equal(validateNarrationCatalog(input).valid, true);
  input.cues[0].lines.classic += "\u0430";
  reject(input, "length", "$.cues[0].lines.classic");
  input.cues[0].lines.classic = `\u0430${"\u{1f319}".repeat(399)}`;
  assert.equal(validateNarrationCatalog(input).valid, true, "count code points rather than UTF-16 units");
});

test("requires Bulgarian spoken words and rejects hidden controls", () => {
  for (const value of ["Night comes.", "Noshtta idva.", "123...", `${BG} English`, `${BG}\u044b`, `${BG}\u044d`, `${BG}\u0451`, "\u039d\u03cd\u03c7\u03c4\u03b1"]) {
    const entry = cue();
    entry.lines.classic = value;
    reject(fixture([entry]), "language");
  }
  for (const control of ["\u0000", "\u001b", "\u200b", "\u202e", "\ufeff"]) {
    const entry = cue();
    entry.lines.classic += control;
    reject(fixture([entry]), "control");
  }
});

test("rejects square and angle tags, including partial tags, for all voices", () => {
  for (const voice of VOICES) {
    for (const tag of ["[", "]", "<", ">", "[whispers]", '<break time="1s"/>', `[${BG}]`, `<${BG}>`]) {
      const entry = cue();
      entry.lines[voice] += tag;
      reject(fixture([entry]), "tag", `$.cues[0].lines.${voice}`);
    }
  }
});

test("rejects unknown family and cue kind values", () => {
  for (const family of ["werewolf", "mafia_sport", "all", null, {}]) reject(fixture([cue({ family })]), "family");
  for (const kind of ["private", "action", "game_over", null, {}]) reject(fixture([cue({ kind })]), "kind");
});

test("only supported public phases are accepted", () => {
  for (const phase of ["role_reveal", "first_night", "night", "day_announcement", "day_discussion", "voting", "resolution"]) {
    for (const family of ["werewolves", "mafia", "both"]) {
      assert.equal(validateNarrationCatalog(fixture([cue({ phase, family })])).valid, true);
    }
  }
  for (const phase of ["lobby", "paused", "game_over", "night_action", "toString", "__proto__", null, undefined, 0]) {
    reject(fixture([cue({ phase })]), "phase");
  }
  const entry = cue();
  delete entry.phase;
  reject(fixture([entry]), "phase");
});

test("family-specific phases cannot be assigned to both or the other game", () => {
  for (const [phase, validFamily] of [["nomination", "mafia"], ["defense", "mafia"], ["hunter_revenge", "werewolves"], ["mayor_successor", "werewolves"]]) {
    for (const family of ["werewolves", "mafia", "both"]) {
      const input = fixture([cue({ phase, family })]);
      if (family === validFamily) assert.equal(validateNarrationCatalog(input).valid, true);
      else reject(input, "phase-family");
    }
  }
});

function finale(winner, family) {
  const entry = cue({ id: "both.finale.result", kind: "finale", winner, family });
  delete entry.phase;
  return entry;
}

test("validates every shared winner against eligible game families", () => {
  const expected = { village: ["werewolves", "mafia", "both"], werewolves: ["werewolves"], vampires: ["werewolves"], mafia: ["mafia"], maniac: ["mafia"], lovers: ["werewolves", "mafia", "both"], draw: ["werewolves", "mafia", "both"] };
  for (const [winner, families] of Object.entries(expected)) {
    for (const family of ["werewolves", "mafia", "both"]) {
      const input = fixture([finale(winner, family)]);
      if (families.includes(family)) assert.equal(validateNarrationCatalog(input).valid, true);
      else reject(input, "winner-family");
    }
  }
  for (const winner of ["town", "jester", "neutral", "toString", null, undefined, []]) {
    reject(fixture([finale(winner, "both")]), "winner");
  }
  const missing = finale("village", "both");
  delete missing.winner;
  reject(fixture([missing]), "winner");
});

test("keeps preview and personal finales separate from phase and team outcomes", () => {
  for (const kind of ["preview", "personal-finale"]) {
    for (const family of ["both", "mafia", "werewolves"]) {
      const entry = cue({ kind, family });
      delete entry.phase;
      assert.equal(validateNarrationCatalog(fixture([entry])).valid, true);
      reject(fixture([{ ...entry, phase: "game_over" }]), "kind-field");
      reject(fixture([{ ...entry, winner: "village" }]), "kind-field");
      reject(fixture([{ ...entry, winner: undefined }]), "kind-field");
    }
  }
  reject(fixture([cue({ winner: "village" })]), "kind-field");
  reject(fixture([{ ...finale("village", "both"), phase: "game_over" }]), "kind-field");
});

async function capture(args) {
  let stdout = "";
  let stderr = "";
  const exitCode = await runCli(args, {
    stdout: { write: (text) => { stdout += text; } },
    stderr: { write: (text) => { stderr += text; } },
  });
  return { exitCode, stdout, stderr };
}

test("CLI fails closed for files, JSON and schema, without leaking input", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "narration-catalog-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "catalog with spaces.json");
  const marker = "PRIVATE_DATA_DO_NOT_LOG";
  const missing = await capture([file, "--json"]);
  assert.equal(missing.exitCode, 1);
  assert.equal(JSON.parse(missing.stdout).errors[0].code, "read");
  await writeFile(file, `{"apiKey": "${marker}", invalid`);
  const invalidJson = await capture([file, "--json"]);
  assert.equal(invalidJson.exitCode, 1);
  assert.equal(JSON.parse(invalidJson.stdout).errors[0].code, "json");
  assert.ok(!invalidJson.stdout.includes(marker));
  await writeFile(file, JSON.stringify({ ...fixture(), [marker]: marker }));
  for (const args of [[file], [file, "--json"]]) {
    const invalid = await capture(args);
    assert.equal(invalid.exitCode, 1);
    assert.ok(!(invalid.stdout + invalid.stderr).includes(marker));
    if (args.includes("--json")) assert.equal(JSON.parse(invalid.stdout).report, null);
    else assert.match(invalid.stderr, /rejected/);
  }
});

test("CLI works outside the repository with a supplied file and does not alter it", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "narration-catalog-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "catalog with spaces.json");
  const source = JSON.stringify(fixture());
  await writeFile(file, source);
  for (const args of [[file, "--json"], ["--catalog", file, "--json"]]) {
    const result = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: directory, encoding: "utf8", timeout: 10_000 });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    const output = JSON.parse(result.stdout);
    assert.equal(output.valid, true);
    assert.equal(output.report.productionReady, false);
    assert.equal(output.report.lineCount, 4);
  }
  const text = await capture([file]);
  assert.equal(text.exitCode, 0);
  assert.match(text.stdout, /Cues: 1 \| Spoken lines: 4/);
  assert.match(text.stdout, /NOT credits/);
  assert.equal(await readFile(file, "utf8"), source);
});

test("CLI rejects unsupported or conflicting arguments instead of silently accepting them", async () => {
  for (const args of [["--generate"], ["--catalog"], ["--catalog", "--json"], ["--catalog", "a", "b"], ["a", "b"], ["a", "--catalog", "b"], ["--help", "--approve"]]) {
    const result = await capture(args);
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr + result.stdout, /Usage:/);
  }
  const help = await capture(["--help"]);
  assert.equal(help.exitCode, 0);
  assert.equal(help.stderr, "");
  assert.match(help.stdout, /Offline draft validation only/);
});

test("importing the validator has no CLI side effects", () => {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(new URL("./narration-catalog.mjs", import.meta.url).href)});`], { encoding: "utf8", timeout: 10_000 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});
