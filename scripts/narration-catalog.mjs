import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_CATALOG = fileURLToPath(new URL("../assets/narration-source/catalog.v1.json", import.meta.url));
const VOICES = ["classic", "old_villager", "inspector", "witch"];
const FAMILIES = ["werewolves", "mafia", "both"];
const KINDS = ["phase", "finale", "personal-finale", "preview"];
const MAX_LINE_CHARACTERS = 400;

// Mirrors protocol.ts GamePhase and win-conditions.ts WinnerTeam. Lobby,
// paused and game_over are deliberately not phase cues; finales are separate.
const PHASES = [
  "role_reveal", "first_night", "night", "day_announcement", "day_discussion",
  "nomination", "defense", "voting", "resolution", "hunter_revenge", "mayor_successor",
];
const WINNERS = ["village", "werewolves", "vampires", "mafia", "maniac", "lovers", "draw"];
const PHASE_FAMILY = { nomination: "mafia", defense: "mafia", hunter_revenge: "werewolves", mayor_successor: "werewolves" };
// Role availability in shared/src/games/{mafia,werewolf}/roles.ts. The shared
// winner "village" also means the Town; lovers and personal Jester wins span both.
const WINNER_FAMILY = { werewolves: "werewolves", vampires: "werewolves", mafia: "mafia", maniac: "mafia" };
const ROOT_KEYS = ["version", "modelId", "language", "status", "voices", "cues"];
const VOICE_KEYS = ["id", "labelBg", "directionBg"];
const CUE_KEYS = ["id", "family", "kind", "phase", "winner", "eligibilityBg", "lines"];
const CUE_REQUIRED = ["id", "family", "kind", "eligibilityBg", "lines"];
const CUE_ID = /^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+$/;
const BULGARIAN_LETTER = /[\u0410-\u042a\u042c\u042e\u042f\u0430-\u044a\u044c\u044e\u044f\u040d\u045d]/u;
const HIDDEN_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

/** Validate untrusted JSON data without echoing its values into diagnostics. */
export function validateNarrationCatalog(catalog) {
  const errors = [];
  const add = (at, code, message) => errors.push({ path: at, code, message });
  const checkRecord = (value, at, allowed, required = allowed) => {
    if (!isRecord(value)) {
      add(at, "object", "Expected a JSON object.");
      return false;
    }
    if (Reflect.ownKeys(value).some((key) => !allowed.includes(key))) {
      // Do not print unknown keys either: they can themselves contain secrets.
      add(at, "unknown-key", "Unexpected field; only schema allowlisted fields are accepted.");
    }
    for (const key of required) {
      if (!Object.hasOwn(value, key)) add(`${at}.${key}`, "required", "Required field is missing.");
    }
    return true;
  };
  const checkBg = (value, at, spoken = false) => {
    if (typeof value !== "string" || !value.trim()) {
      add(at, "text", "Expected nonempty Bulgarian text.");
      return;
    }
    if (!BULGARIAN_LETTER.test(value)) add(at, "language", "Bulgarian Cyrillic text is required.");
    if (HIDDEN_CONTROL.test(value)) add(at, "control", "Hidden control characters are not accepted.");
    if (spoken) {
      if ([...value].length > MAX_LINE_CHARACTERS) add(at, "length", "Spoken text exceeds 400 Unicode code points.");
      if (/[\[\]<>]/u.test(value)) add(at, "tag", "Square-bracket and angle-bracket tags are not allowed in spoken text.");
      const letters = value.match(/\p{L}/gu) ?? [];
      if (letters.some((letter) => !BULGARIAN_LETTER.test(letter))) {
        add(at, "language", "Spoken words must use Bulgarian letters, not foreign or transliterated text.");
      }
    }
  };

  if (!checkRecord(catalog, "$", ROOT_KEYS)) return { valid: false, errors, report: null };
  for (const [key, expected] of Object.entries({ version: 1, modelId: "eleven_v4", language: "bg", status: "draft" })) {
    if (catalog[key] !== expected) add(`$.${key}`, "literal", `Expected ${JSON.stringify(expected)}.`);
  }

  if (!Array.isArray(catalog.voices)) {
    add("$.voices", "array", "Expected the exact four narrator voices.");
  } else {
    const seen = new Set();
    for (const [index, voice] of catalog.voices.entries()) {
      const at = `$.voices[${index}]`;
      if (!checkRecord(voice, at, VOICE_KEYS)) continue;
      if (!VOICES.includes(voice.id)) {
        add(`${at}.id`, "voice", "Unknown narrator voice.");
      } else {
        if (seen.has(voice.id)) add(`${at}.id`, "duplicate", "Duplicate narrator voice.");
        seen.add(voice.id);
      }
      checkBg(voice.labelBg, `${at}.labelBg`);
      checkBg(voice.directionBg, `${at}.directionBg`);
    }
    if (catalog.voices.length !== VOICES.length || seen.size !== VOICES.length) {
      add("$.voices", "voice-set", "Exactly classic, old_villager, inspector and witch are required, once each.");
    }
  }

  if (!Array.isArray(catalog.cues) || catalog.cues.length === 0) {
    add("$.cues", "array", "Expected a nonempty cue array.");
  } else {
    const seen = new Set();
    for (const [index, cue] of catalog.cues.entries()) {
      const at = `$.cues[${index}]`;
      if (!checkRecord(cue, at, CUE_KEYS, CUE_REQUIRED)) continue;
      if (typeof cue.id !== "string" || cue.id.trim() !== cue.id || !CUE_ID.test(cue.id)) {
        add(`${at}.id`, "id", "Expected a lowercase dot-separated cue ID.");
      } else {
        if (seen.has(cue.id)) add(`${at}.id`, "duplicate", "Duplicate cue ID.");
        seen.add(cue.id);
      }
      if (!FAMILIES.includes(cue.family)) add(`${at}.family`, "family", "Unknown game family.");
      if (!KINDS.includes(cue.kind)) add(`${at}.kind`, "kind", "Unknown cue kind.");
      checkBg(cue.eligibilityBg, `${at}.eligibilityBg`);

      if (cue.kind === "phase") {
        if (!Object.hasOwn(cue, "phase") || !PHASES.includes(cue.phase)) {
          add(`${at}.phase`, "phase", "Expected an allowed GamePhase, excluding lobby, paused and game_over.");
        } else if (Object.hasOwn(PHASE_FAMILY, cue.phase) && cue.family !== PHASE_FAMILY[cue.phase]) {
          add(`${at}.family`, "phase-family", "This phase belongs to only one game family, not both.");
        }
      } else if (Object.hasOwn(cue, "phase")) {
        add(`${at}.phase`, "kind-field", "Only phase cues may specify a phase.");
      }

      if (cue.kind === "finale") {
        if (!Object.hasOwn(cue, "winner") || !WINNERS.includes(cue.winner)) {
          add(`${at}.winner`, "winner", "Expected a shared WinnerTeam; personal wins are not teams.");
        } else if (Object.hasOwn(WINNER_FAMILY, cue.winner) && cue.family !== WINNER_FAMILY[cue.winner]) {
          add(`${at}.family`, "winner-family", "This outcome belongs to only one game family, not both.");
        }
      } else if (Object.hasOwn(cue, "winner")) {
        add(`${at}.winner`, "kind-field", "Only faction finale cues may specify a winner; personal finales stay independent.");
      }

      if (checkRecord(cue.lines, `${at}.lines`, VOICES)) {
        for (const voice of VOICES) checkBg(cue.lines[voice], `${at}.lines.${voice}`, true);
      }
    }
  }

  if (errors.length > 0) return { valid: false, errors, report: null };
  const charactersPerVoice = Object.fromEntries(VOICES.map((voice) => [voice, 0]));
  const cuesPerFamily = Object.fromEntries(FAMILIES.map((family) => [family, 0]));
  const cuesPerKind = Object.fromEntries(KINDS.map((kind) => [kind, 0]));
  let maxLineCharacters = 0;
  for (const cue of catalog.cues) {
    cuesPerFamily[cue.family] += 1;
    cuesPerKind[cue.kind] += 1;
    for (const voice of VOICES) {
      const count = [...cue.lines[voice]].length;
      charactersPerVoice[voice] += count;
      maxLineCharacters = Math.max(maxLineCharacters, count);
    }
  }
  const characterCount = Object.values(charactersPerVoice).reduce((total, count) => total + count, 0);
  return {
    valid: true,
    errors: [],
    report: {
      version: catalog.version,
      modelId: catalog.modelId,
      language: catalog.language,
      status: "draft",
      productionReady: false,
      cueCount: catalog.cues.length,
      lineCount: catalog.cues.length * VOICES.length,
      characterCount,
      maxLineCharacters,
      charactersPerVoice,
      cuesPerFamily,
      cuesPerKind,
      symbolicEstimate: {
        unit: "Unicode code points in spoken text, including spaces and punctuation",
        perTake: characterCount,
        formula: "perTake * takes; add audition and retake text separately",
        isCreditEstimate: false,
      },
      notes: [
        "DRAFT ONLY: structurally valid, not approved for generation or production playback.",
        "Symbolic text-volume estimate, NOT credits or a price. No provider or network calls were made.",
        "Direction and eligibility text are excluded. Billing, voice multipliers and promotion eligibility are unverified.",
        "Bulgarian quality, names, privacy and cue eligibility still require human review; fields are allowlisted, prose is not certified.",
      ],
    },
  };
}

export function formatNarrationReport(report) {
  return [
    "Narration catalog: DRAFT ONLY - NOT PRODUCTION READY",
    `Model: ${report.modelId} | Language: ${report.language}`,
    `Cues: ${report.cueCount} | Spoken lines: ${report.lineCount} | Characters: ${report.characterCount}`,
    `Longest spoken line: ${report.maxLineCharacters} / ${MAX_LINE_CHARACTERS}`,
    ...VOICES.map((voice) => `${voice}: ${report.charactersPerVoice[voice]} characters`),
    `Symbolic estimate: ${report.characterCount} * takes (spoken Unicode code points, NOT credits or a price).`,
    ...report.notes,
  ].join("\n");
}

const USAGE = "Usage: node scripts/narration-catalog.mjs [catalog.json | --catalog path] [--json]\nDefault: assets/narration-source/catalog.v1.json (relative to the repository, not cwd)\nOffline draft validation only; no generation, network, credits or production approval.";

export async function runCli(args, { stdout = process.stdout, stderr = process.stderr } = {}) {
  let input;
  let json = false;
  let help = false;
  let usageError = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") json = true;
    else if (arg === "--help" || arg === "-h") help = true;
    else if (arg === "--catalog") {
      const value = args[++index];
      if (!value || value.startsWith("-") || input !== undefined) usageError = true;
      else input = value;
    } else if (!arg || arg.startsWith("-") || input !== undefined) usageError = true;
    else input = arg;
  }
  const fail = (code, message, exitCode = 1) => {
    const result = { valid: false, errors: [{ path: "$", code, message }], report: null };
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else stderr.write(`Narration catalog rejected: ${message}\n`);
    return exitCode;
  };
  if (usageError) return fail("usage", USAGE, 2);
  if (help) {
    stdout.write(`${USAGE}\n`);
    return 0;
  }

  let source;
  try {
    source = await readFile(input ?? DEFAULT_CATALOG, "utf8");
  } catch {
    return fail("read", "Cannot read the local catalog file. Nothing was approved or generated.");
  }
  let catalog;
  try {
    catalog = JSON.parse(source);
  } catch {
    // JSON.parse errors can contain source snippets, including private data.
    return fail("json", "Invalid JSON. Source content is not included in diagnostics.");
  }
  const result = validateNarrationCatalog(catalog);
  if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else if (result.valid) stdout.write(`${formatNarrationReport(result.report)}\n`);
  else stderr.write(`Narration catalog rejected:\n${result.errors.map((error) => `${error.path}: ${error.message}`).join("\n")}\n`);
  return result.valid ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runCli(process.argv.slice(2));
}
