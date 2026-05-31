# Audio narrator — strategy document

**Status**: planning · No implementation yet · Decision pending
**Author**: AI-assisted draft, 2026-05-16
**Owner**: TBD (likely product/eng joint decision)
**Decision deadline**: pre-public-launch (target: before final feature freeze)

---

## TL;DR

The game has a `narratorVoice` config field with 4 persona enums (`classic`, `old_villager`, `inspector`, `witch`), but it only switches **text style** — no audio. Adding real spoken narration would significantly raise the "premium" feel and matches the cinematic visual direction already established (painterly art, brass plaques, vintage newsprint).

Three approaches considered: free browser TTS, pre-generated ElevenLabs clips, runtime TTS streaming. **Recommendation: pre-generated ElevenLabs clips for 4 personas, ~40 base phrases, generic (no name substitution) for MVP. Total one-time cost ~$22 + 8 hours engineering. Defers indefinite per-game runtime cost.**

If product decides TTS is out of MVP scope, fallback is to **rename `narratorVoice` to `narratorTone`** to remove the misleading "voice" terminology in the codebase.

---

## 1. Current state recap

### What exists

| Component | File | Purpose |
|---|---|---|
| `playCue()` | `apps/web/lib/sound.ts` | 4 procedural beeps via Web Audio API oscillators (vote/kill/phase-change/win) |
| `NarratorVoice` enum | `packages/shared/src/game-config.ts:17` | Text-style switch: classic / old_villager / inspector / witch |
| `NARRATOR_VOICE_LABELS_BG` | `packages/shared/src/game-config.ts` | Maps enum to BG label |
| Sound toggle | `apps/web/components/site-chrome.tsx` | Mute/unmute speaker icon in navbar |

### What does NOT exist

- `speechSynthesis` calls (browser Web Speech API)
- External TTS API integration (ElevenLabs, OpenAI, Google, Azure, Resemble)
- Pre-recorded audio files
- `<audio>` playback infrastructure
- Audio asset pipeline (similar to `optimize:assets` but for audio)
- Volume control, autoplay toggle, voice picker UI
- Per-persona audio routing logic

### The misleading naming

`narratorVoice` is currently a **text persona**, not an audio voice. This causes confusion. Either:
- (a) Implement actual audio (this doc's main proposal), making the name accurate
- (b) Rename to `narratorTone` / `narratorPersona` to remove the implication

---

## 2. Goal

Add cinematic, in-character spoken narration that:

1. **Reinforces premium aesthetic** — match painterly art and noir/folklore vibes
2. **Differentiates 4 personas** — Класически Разказвач, Старият селянин, Инспекторът, Вещицата each sound distinctly different
3. **Stays in Bulgarian** — preserves BG-only invariant
4. **Doesn't break play** — silent mute always available; never blocks game progression
5. **Predictable cost** — no per-game runtime fees that scale with viral moments
6. **Works offline** — PWA-compatible (audio clips cached locally)

### Non-goals (out of scope for v1)

- Per-player dialogue (each player's role announcement)
- Voice-acting cutscenes
- Live voice modulation
- TTS for user-generated content (chat messages)
- Multi-language (BG-only)
- Voice recognition / voice input

---

## 3. Three implementation approaches

### Approach A — Browser `speechSynthesis` (Web Speech API)

Built into every modern browser. Free. Works offline once browser loads.

```ts
function speakBg(text: string, persona: NarratorVoice) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "bg-BG";
  // Browser picks a BG voice; we can't really control which
  utterance.rate = persona === "old_villager" ? 0.85 : 1.0;
  utterance.pitch = persona === "witch" ? 1.3 : 1.0;
  window.speechSynthesis.speak(utterance);
}
```

**Pros:**
- Free, zero subscription
- Zero asset weight (no clips to ship)
- Always up-to-date with copy (just feed text)
- Truly offline-first
- Setup time: 1-2 hours

**Cons:**
- 🔴 **BG voice quality varies wildly by device** — Android (Google TTS) is OK; iOS Bulgarian is poor; Windows has decent voice but inconsistent. macOS has no BG voice at all in some versions.
- 🔴 **Can't differentiate personas convincingly** — `pitch` and `rate` modifications make all 4 personas sound like the same robot at different speeds. Not "cinematic".
- 🔴 **iOS Safari restrictions** — `speechSynthesis` requires explicit user gesture to unlock; first phase announcement may be silent.
- 🟡 **No control over emphasis / pauses / SSML** in Bulgarian voices (SSML support spotty across browsers)
- 🟡 **Inconsistent UX** — same game sounds different to different players

**Verdict:** Useful as **accessibility fallback only**, not as the primary narration. Mark with "(базов глас от устройството)" label.

---

### Approach B — Pre-generated ElevenLabs clips (RECOMMENDED)

Generate ~40 base phrases × 4 personas once via ElevenLabs API, save as MP3/Opus in `apps/web/public/audio/narrator/`, play via `<audio>` or Web Audio.

**Directory structure:**
```
apps/web/public/audio/narrator/
  classic/
    01-lobby-opens.mp3
    02-night-falls.mp3
    03-werewolves-wake.mp3
    ...
  old-villager/
    01-lobby-opens.mp3
    ...
  inspector/
    ...
  witch/
    ...
```

**Pros:**
- 🟢 **Cinematic quality** — ElevenLabs BG voices are convincingly human, with character
- 🟢 **Personas truly differ** — pick different voice IDs per persona (e.g., old villager = older male voice with gravelly cadence; witch = younger female with raspy edge)
- 🟢 **One-time cost** — generate once, ship statically forever
- 🟢 **Offline-first** — clips cache locally with PWA
- 🟢 **Zero runtime API cost** — no per-game spending
- 🟢 **Deterministic** — same playback every time
- 🟢 **Pre-rendered emphasis** — can add intentional pauses, mood shifts in source script

**Cons:**
- 🟡 **Recurring subscription if expanding** — ElevenLabs Creator tier $22/mo (or $5/mo Starter). Single month of subscription enough to generate initial library, then cancel.
- 🟡 **Static** — if copy changes, must re-generate that clip(s)
- 🟡 **Repo weight** — 4 voices × 40 clips × ~3 sec × 32 kbps Opus = ~25-30 MB. Manageable; can serve from CDN.
- 🟡 **No dynamic content** — can't speak player names without splicing (see § 4.2 for workaround)
- 🟢 (low risk) — ElevenLabs ToS allows commercial use on Creator+ tier; verify before launch

**Effort:** ~8 hours engineering (audio playback infra + persona switching) + ~3-4 hours generation/curation (writing 40 phrases × 4 voices, listening, regenerating bad takes)

**Verdict:** ⭐ Best balance for premium feel + predictable cost.

---

### Approach C — Runtime TTS API streaming

Server-side proxy that calls TTS provider on each phase announcement, streams audio to clients.

**Architecture:**
- Game-server emits phase event → web backend receives → calls TTS API → streams audio URL to clients via Colyseus message → clients fetch and play

**Pros:**
- 🟢 **Always fresh** — copy changes ripple to audio automatically
- 🟢 **Dynamic content** — can speak player names, vote counts, etc.
- 🟢 **No repo weight** — zero static audio

**Cons:**
- 🔴 **Per-request cost scales with viral moments** — 100 simultaneous games × 8 phases × 4 sec audio = real money fast
- 🔴 **Latency** — game pauses while audio renders + streams (1-3 sec for ElevenLabs, slower for OpenAI tts-1-hd)
- 🔴 **External service dependency** — outage breaks audio
- 🔴 **Privacy/data flow** — game state leaves your servers
- 🟡 **Caching complexity** — to avoid double-paying for identical phrases, need cache layer

**Cost estimate (ElevenLabs Creator pricing):**
- 100 concurrent games × 8 phases × 80 chars/phrase = 64,000 chars/game-burst
- ElevenLabs charges $0.18 per 1K chars on overage = **$11.50 per burst**
- Reddit viral momentum (1000 concurrent) = **$115 per burst**
- Compare to Approach B: one-time $22 forever

**Verdict:** ❌ Not recommended. Cost unpredictability + latency + dependency risk outweigh dynamic-content benefit. Reconsider only if game has dedicated audio-first features.

---

## 4. Scope analysis — what gets voiced?

### 4.1 Phrase inventory (estimated)

Group by game phase:

| Group | Phrases | Examples |
|---|---|---|
| Lobby | 3-4 | "Масата се събира.", "Имаме нужда от още играчи." |
| Role reveal | 1-2 (generic) | "Картите са раздадени. Запомнете тайната си." |
| First night | 5-6 | "Нощта пада за пръв път.", "Очите се затварят.", "Заспивате." |
| Per role wake (night) | 8-10 | "Върколаците се събуждат.", "Лечителят отваря очи.", "Гадателят гледа.", "Шерифът провери.", "Вещицата отваря шишенцата.", "Маниакът се движи в сенките." etc. |
| Day morning | 4-5 | "Нощта отстъпва.", "Селото се събужда.", "Един от вас не дочака утрото.", "Тази нощ беше спокойна." |
| Discussion | 2-3 | "Започва обсъждането.", "Кой говори първи?" |
| Voting | 3-4 | "Време за гласуване.", "{name} в защита." (generic version), "Решете кой ще си тръгне." |
| Resolution | 4-5 | "Селото избра.", "Този глас не свали никого.", "Картата се обръща." |
| Game over | 6-8 | "Селото оцеля.", "Върколаците надделяха.", "Мафията владее града.", "Шутът победи.", "Маниакът остана последен." |

**Total estimate**: ~40 base phrases × 4 personas = **160 audio clips** for v1.

### 4.2 The dynamic-content problem

Some announcements naturally include player names:
- "Тази нощ загина {name}"
- "{name} е следващият кмет"
- "{name} се защитава"

**Three options:**

| Option | Approach | Pros | Cons |
|---|---|---|---|
| **A. Generic-only (recommended for v1)** | Rewrite copy to avoid names. "Един от вас не дочака утрото." | Simple; cheap; works offline | Less personal |
| B. Phonetic splicing | Pre-record common BG names; concatenate via Web Audio API | Personal | Won't cover all names (custom BG names are infinite); concatenation sounds robotic |
| C. Hybrid runtime TTS | Static base + runtime TTS just for name | Best of both | Reintroduces runtime cost + latency just for one word |

**Recommendation**: Start with **Option A (generic-only)**. Revisit if user feedback explicitly asks for personalized callouts.

### 4.3 Script tone per persona

To make personas truly distinct, write **different scripts per persona**, not just different voices reading the same words:

| Phrase: "Night falls." | Persona | Script |
|---|---|---|
| Класически Разказвач | "Нощта пада над селото." (neutral, dignified) |
| Старият селянин | "Е сега пък... нощта дойде, прибирайте се." (folksy, slow) |
| Инспекторът | "Светлините гаснат. Започваме разпита по тъмно." (procedural, clipped) |
| Вещицата | "Лунната сянка дойде. Заспивайте, мили мои." (eerie, dragged) |

This is **~3 hours of copy writing** per persona × 4 = ~12 hours total. Should be done before any audio generation.

---

## 5. Cost analysis

### Approach A (Web Speech API)
- **One-time:** $0
- **Recurring:** $0
- **Engineering:** 2-3 hours (setup + voice selection logic + iOS gesture unlock)
- **Maintenance:** ~1 hour per copy change (just edit text)

### Approach B (Pre-generated ElevenLabs)

| Item | Cost |
|---|---|
| ElevenLabs Creator subscription, 1 month | $22 |
| Voice cloning fee (if you want custom voice characters) | $0 included in Creator tier |
| Audio storage (in repo or CDN) | ~$0 |
| Engineering: copywriting | 12 hours |
| Engineering: generation + curation | 4 hours |
| Engineering: playback infrastructure | 6 hours |
| Engineering: UI controls | 3 hours |
| **Total one-time** | **$22 + ~25 hours** |
| **Recurring** | **$0** (after first month, cancel subscription unless adding more clips) |

**Repo weight**: 4 personas × 40 clips × ~80 KB Opus = **~13 MB**. Compared to existing `apps/web/public/game-art/` (~50 MB), this is acceptable. Can also serve from R2/Cloudflare CDN if desired.

### Approach C (Runtime TTS)

Variable. Roughly:
- $1.50 per 1000 game-bursts at peak
- Realistic: $20-200 per month depending on viral spikes
- Unpredictable; couples cost to product success

---

## 6. Quality comparison

Estimated subjective ranking (subjective, 1-10):

| Approach | Voice quality | Persona differentiation | BG accent | Mood / character | Total |
|---|---|---|---|---|---|
| **B. ElevenLabs pre-gen** | 9 | 9 | 9 | 9 | 36/40 |
| **C. Runtime ElevenLabs** | 9 | 9 | 9 | 9 | 36/40 |
| **A. Web Speech (Android)** | 6 | 3 | 7 | 4 | 20/40 |
| **A. Web Speech (iOS)** | 4 | 3 | 5 | 3 | 15/40 |
| **A. Web Speech (Windows)** | 6 | 3 | 6 | 4 | 19/40 |

Quality only matters if it actually reaches the user, so device variance hurts Approach A significantly.

---

## 7. UX considerations

### Volume + autoplay

Default behavior should be **muted on first visit** (browser autoplay policies require gesture anyway). User clicks navbar speaker icon → audio starts on next phase.

Three states for the speaker icon:
- 🔇 Muted (default; current state without TTS)
- 🔉 Cues only (procedural beeps; current "sound enabled" state)
- 🔊 Cues + narrator (new state; opt-in)

Persisted via `localStorage.werewolf-audio-mode = "muted" | "cues" | "narrator"`.

### Voice picker UI

Where do players choose persona? **In wizard step 3 (Стил)** — currently has tempo (Бърза/Нормална/На живо). Add a "Глас на разказвача" sub-section with 4 cards, each playing a sample clip on hover/click for preview.

### Voice changes mid-game?

**No.** Persona is locked at game start. Changing it mid-game would be confusing.

### Spectator mode

Spectators hear narrator audio same as players. (Different from chat / private role audio, which they obviously don't.)

### Hearing-impaired players

All narrator audio is **redundant** with text in `messageBg`/`causeBg` already shown in the UI. No information is conveyed only through audio. Audio is enhancement, not replacement.

### Distracting narration

Some players will find narration overbearing after 5+ games. **Make it 1-click off** (navbar speaker icon cycles modes). Don't hide it in settings.

---

## 8. Privacy / GDPR considerations

### Approach A (Web Speech)
- No data leaves browser. Zero privacy concern.

### Approach B (Pre-generated)
- Audio files are static, generated once before deployment. No runtime data leaves your servers. Zero privacy concern at play time.
- During generation: copy text is sent to ElevenLabs servers. None of it contains user data. ElevenLabs ToS allows this.

### Approach C (Runtime TTS)
- ⚠ Game state / player names sent to TTS provider in real-time. Requires:
  - DPA (Data Processing Agreement) with provider
  - Disclosure in privacy policy
  - User consent before audio starts (since it's "transmitting personal data to a third party")

Approach B avoids this entire category of concern.

---

## 9. Tech architecture for Approach B (recommended)

### Asset pipeline

```
docs/audio-narrator-scripts.md      ← copywriting source of truth (4 personas × 40 phrases)
                ↓ (manual generation via ElevenLabs UI or batch script)
scripts/generate-narrator-audio.mjs ← optional batch automation
                ↓
apps/web/public/audio/narrator/<persona>/<index>-<slug>.opus
```

Suggested format: **Opus 32 kbps mono**. Supported in all evergreen browsers, ~3x smaller than MP3 at equivalent quality. iOS Safari supports Opus since 17.

### Manifest

```ts
// packages/shared/src/audio-manifest.ts
export type NarratorClipId =
  | "lobby-opens"
  | "night-falls"
  | "werewolves-wake"
  | "healer-wakes"
  | "seer-wakes"
  | ... (etc, ~40 IDs)
  | "village-wins"
  | "werewolves-win"
  | "game-over-jester";

export const NARRATOR_AUDIO_MANIFEST: Record<NarratorClipId, { duration: number; slug: string }> = {
  "lobby-opens": { duration: 3.2, slug: "01-lobby-opens" },
  "night-falls": { duration: 2.8, slug: "02-night-falls" },
  ...
};
```

### Player

```ts
// apps/web/lib/narrator-audio.ts
class NarratorPlayer {
  private current: HTMLAudioElement | null = null;

  async play(persona: NarratorVoice, clipId: NarratorClipId) {
    if (this.mode === "muted" || this.mode === "cues") return;
    this.current?.pause();
    const slug = NARRATOR_AUDIO_MANIFEST[clipId].slug;
    this.current = new Audio(`/audio/narrator/${persona}/${slug}.opus`);
    this.current.volume = this.volume;
    await this.current.play().catch(() => { /* user gesture not yet granted */ });
  }
}

export const narratorPlayer = new NarratorPlayer();
```

### Trigger points

Server emits a phase change → web client receives Colyseus message → maps phase + persona to clip ID → plays.

In `apps/web/components/play-room-client.tsx`:

```ts
room.onStateChange((state) => {
  if (state.phase !== lastPhase) {
    const clipId = mapPhaseToClipId(state.phase, lastPhase);
    if (clipId) narratorPlayer.play(state.narratorVoice, clipId);
  }
  lastPhase = state.phase;
});
```

### PWA caching

Service worker pre-caches `/audio/narrator/<chosen-persona>/*.opus` on first visit (after wizard step 3 selection). Other personas lazy-load when previewed.

Estimated first-paint impact: zero (audio cached after user opens wizard, before they actually start game).

---

## 10. Phased rollout

### Phase 0 — Decision (this doc)
Choose: implement v1 / defer / cut feature (rename `narratorVoice` to `narratorTone`).

### Phase 1 — MVP (if approved)
- 4 personas × ~20 phrases (essential only: night/day/death/resolution/game-over)
- Generic copy (no name substitution)
- Web `<audio>` element playback
- Toggle in navbar: 🔇 → 🔉 → 🔊
- Voice picker in wizard step 3

**Engineering**: 18-20 hours
**Cost**: $22 (one-month ElevenLabs subscription)
**Repo weight**: ~8 MB

### Phase 2 — Expansion (post-launch, optional)
- Expand to 40 phrases per persona (every meaningful phase event)
- Add 5th persona based on community feedback
- Volume slider (instead of binary on/off)
- "Replay last announcement" hotkey

**Effort**: +10 hours
**Cost**: +$0 (still within initial generation)

### Phase 3 — Dynamic (post-Phase 2, if user demand exists)
- Pre-record common BG names; spliced playback for "Тази нощ загина {name}"
- Or runtime TTS for names only via narrow API call

**Effort**: +20 hours
**Cost**: variable

---

## 11. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| ElevenLabs voice quality declines (model regression) | Low | Medium | Lock generation to specific model version; archive raw audio files |
| ElevenLabs ToS change (commercial use restrictions) | Low | High | Read current Creator tier ToS before generation; keep audio assets we already generated even if subscription ends |
| Browser Opus support breaks (unlikely) | Very low | Medium | Provide MP3 fallback for non-Opus browsers |
| Audio over WiFi too laggy for live play | Low | Low | Audio is async; doesn't gate game progression |
| Community wants more personas | Medium | Low | Phase 2 adds 5th persona; total cost low |
| Player finds voice annoying after many games | High | Low | Easy 1-click mute |
| Asset weight bloats first paint | Low | Low | Lazy-load: only fetch chosen persona's clips, not all 4 |
| Mobile data usage concern | Low | Low | 8 MB total per persona is < 1 photo on Instagram; opt-in via toggle |
| ElevenLabs API outage during initial generation | Low | Low | Re-try; we generate once and ship statically |

---

## 12. Decision framework

| Question | If yes... | If no... |
|---|---|---|
| Is audio a key part of "premium" launch experience? | → Approach B (recommended) | → Defer, rename `narratorVoice` |
| Is $22 + 25 engineering hours within budget? | → Approach B | → Approach A (free fallback) |
| Will product expand audio post-launch? | → Approach B (foundation) | → Approach A |
| Do players want personalized name callouts on day 1? | → Hybrid B+C (complex) | → Approach B (generic) |
| Is `narratorVoice` actively confusing users right now? | → Either rename it or implement B | → Status quo OK |

---

## 13. Recommendation

**Implement Approach B (pre-generated ElevenLabs)** if all of these are true:
1. Public launch is happening within 4-6 weeks
2. ~25 engineering hours + $22 budget is available
3. Audio is desired part of "premium feel" pitch
4. Product agrees with generic-only copy for v1 (no names)

If these aren't all true, **defer and rename `narratorVoice` → `narratorTone`** in a small follow-up PR to remove the misleading terminology. Add this doc as a tracked feature for post-launch.

---

## 14. Open questions

1. **Voice characters**: Should the 4 personas have specific gendered voices (e.g., старият селянин = male, вещицата = female)? Or all gender-neutral?
2. **Sample preview length**: When user previews persona in wizard, should the preview be a full phrase (~5 sec) or short tag (~2 sec "Привет")?
3. **Music**: Out of scope for this doc, but: should there be ambient music behind narration? Or strictly narration over silence?
4. **Live-tempo mode**: When players are at one physical table, narrator audio could replace the phone-as-table screen. Different UX. Worth a separate exploration?
5. **TTS for chat / role reveal**: Probably not (private content, accessibility complication), but worth confirming.
6. **Asset hosting**: Local in `public/` or CDN (R2 / Cloudflare)? Affects PWA cache strategy.
7. **A/B test before launch**: Worth checking with playtesters whether narrator is "premium" or "distracting"?

---

## 15. Next steps if approved

1. Owner picks approach + answers § 14 open questions
2. Copywriting sprint (~3-4 hours per persona) → `docs/audio-narrator-scripts.md`
3. ElevenLabs voice ID selection per persona (1-2 hours of voice browsing + sample testing)
4. Batch generation + curation (~4 hours)
5. Codex prompt for playback infrastructure (will write this if decision is to implement)
6. PWA cache strategy update
7. Wizard step 3 UI extension (voice picker cards)
8. Navbar 3-state speaker toggle

---

## Appendix: alternative — just rename

If audio is cut from scope, file a tiny follow-up:

```
feat(config): rename NarratorVoice to NarratorTone to clarify text-style intent

- packages/shared/src/game-config.ts: type rename + constant rename
- apps/game-server/src/rooms/GameRoom.ts: field rename
- apps/web/components/lobby/StepStyle.tsx: UI label "Глас на разказвача" → "Тон на разказвача"
- packages/database/migrations: column rename if persisted to DB
- docs: update terminology references

Note: NarratorPersona was also considered but feels too jargon-y for end-user-facing label.
```

This is ~30 minutes engineering. Avoids future confusion if audio remains permanently out of scope.

---

(End of document)
