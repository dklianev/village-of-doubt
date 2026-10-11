# Leaderboard Edition Design QA

Date: 2026-09-22. Scope: the approved leaderboard image implemented in the existing Senkite application, with a corresponding light theme. No backend ranking, authentication, navbar, or gameplay redesign.

## Visual Truth and Capture

- Source: C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-c6a42e51-8567-4920-a19e-67d9f4326ad7.png
- Implementation: E:/codex-temp/leaderboard-redesign/final-dark-desktop.png
- Light counterpart: E:/codex-temp/leaderboard-redesign/final-light-desktop.png
- Browser: http://127.0.0.1:3000/leaderboard?visualLeaderboard=fixture
- Both reference and desktop comparison are 1536 x 1024 pixels, CSS viewport 1536 x 1024, device scale factor 1. No density normalization was needed.
- Synthetic populated state. The reference's invented date and some numerical values intentionally differ from the existing deterministic fixture. The runtime presents the actual snapshot date and all rows; it does not manufacture numbers to match an illustration.
- Full-view reference and dark/light captures were opened together for comparison. Masthead, runners, table header, row typography, and numeral/newspaper details were inspected at their readable native scale in the same inputs.
- Additional captures: qa-{dark,light}-{320,768,1440,1536}.png, tablet-refined-light.png, final-{dark,light}-{320,390,768,1440}.png, final-empty-{dark,light}.png, empty-light.png, unavailable-light.png in E:/codex-temp/leaderboard-redesign/.

## Comparison History

1. First implementation: image hierarchy was correct, but body type was sans-serif and the table began too low. Restored the established reading serif, enlarged the masthead, compacted metadata, and reworked the two runner-up lines. Evidence: first-*.png to second-*.png.
2. Tablet review: ordinary runner names broke mid-word and the numeral was cropped at the right edge. Changed the tablet image scale to 1200px, reduced the tablet masthead to 48px, and moved wins beneath runner names. Evidence: qa-dark-768.png to tablet-refined-light.png.
3. Measured contrast exposed small text over bright/dark parts of the artwork; 200% text exposed insufficient fixed-column table width. Strengthened the quiet text-side overlay and lower fade, adjusted light ink, and preserved an 8rem desktop name column through the table's minimum width. Mobile horizontal scrolling remains inside the keyboard-focusable table region.
4. Final narrow-screen pass: runner-up layout now adapts to text size, with one column when 200% text cannot fit two. Light kicker and sorting-label ink were strengthened without changing thresholds or hiding text.

## Fidelity Surfaces

- Typography: existing Literata display/reading font and Sofia UI font, zero tracking, large masthead, editorial lead, restrained metadata, tabular numeric rows. No new font dependency. The implementation uses the site's real navbar instead of copying bitmap controls from the mock.
- Rhythm: full-bleed scene, unframed 1280px content width, 24px desktop inner padding, 20px phone gutters and 16px at 320px. Ranking begins around y553 at the reference viewport, close to the mock. Artwork is a short introductory crop on phones, not a viewport-height obstacle.
- Colors: dark ink-green/ivory/metal and burgundy; daylight pearl stone, deep green ink and dark red accents. Both themes use corresponding generated scenes rather than recoloring a dark photograph with a white panel.
- Artwork: native 1536 x 1024 plates exported at WebP quality 75. Physical numeral, typewriter, letterpress blocks, roller and printed brand are raster artwork. Names, scores, dates and controls remain HTML. Correct theme only is requested by CSS.
- Copy/data: Bulgarian, authoritative server order, all supplied players up to the existing 30-player limit, seven-day public-finished-game scope, no fabricated season/ELO/rank changes/profile portraits. Empty and unavailable editions remain distinct and actionable.

## Verification

- Production build, web typecheck, regression contracts and dictionary check passed.
- Asset optimizer tests: 42 passed, including byte-for-byte reproduction of both new scenes and the JPEG metadata preview without mutating masters.
- Read-only format validation: 102 AVIF/WebP pairs passed.
- Production performance budget passed: JS gzip 552.3 KiB; runtime artwork 74,590.3 KiB of 75,000 KiB. Existing warning-tier art entries remain; no limit was relaxed. Artwork decreased by about 403.5 KiB from the pre-task measurement.
- General newspaper browser regression: six scenarios passed, including light/dark, narrow screens, actual row count and accessibility.
- Reviewed populated and empty visual baselines now use explicit synthetic query parameters, not a live database response.
- Component and loading geometry: 38 tests passed, including dated/undated snapshots and CLS below 0.05.
- Chromium final stable run: all 30 scenarios passed with retries disabled, including theme-only downloads, actual painted-pixel contrast, 200% text, keyboard scrolling, empty/unavailable/small/full data and retry recovery. One transient Next.js runtime-error marker from an earlier run did not recur in either its isolated rerun or the complete final run; no error check was suppressed.
- Previously failing contrast and enlarged-text cases: five passes in Firefox and five in WebKit.
- Reviewed visual baselines and accessibility: ten tests passed again without update mode.

## Canonical Linux Verification

Completed on 2026-09-22 after the user started Docker. Docker Engine 29.8.0 responded successfully. The earlier WSL mount E_ACCESSDENIED and local socket error 1920 no longer blocked this run; their underlying Windows cause has not been established or claimed fixed.

- Ran the exported verifyOptimizedAssets verifier against E:/codex-temp/leaderboard-art-verification-20260922 using the repository's pinned node:24.20.0-bookworm image digest and sharp@0.35.4. All three canonical generators completed with exit 0.
- Before the run, all 854 source/runtime files matched the working tree byte for byte. Generator scripts and package pins also matched before and after verification.
- Processed all 277 source assets, followed by seven critical mobile assets and 24 phase assets. The verifier found no mutated source masters and no non-reproducible runtime outputs. No platform-specific AVIF restoration was needed (restoredAvifs: []).
- After the run, all 854 files still matched the current working tree byte for byte, including both leaderboard backgrounds and the metadata JPEG. The live project assets were not rewritten.
- Read-only validation confirmed all 102 AVIF/WebP pairs have matching dimensions.
- No Docker reset, manual ACL change, security-policy change, budget relaxation or baseline update was needed. The previous Docker-dependent verification gap is closed.

## Final Findings

No actionable P0/P1/P2 design or behavior regression remains in the verified scope. Art is deliberately quieter beneath live text than in the generated mock to preserve measured contrast; the full ranking and real snapshot scope replace the mock's abbreviated content. These are intentional product constraints, not missing features. No further P3 visual loop is needed.

Real production database/auth behavior was not tested with these synthetic screenshots. This scoped verification is not a full production release sign-off.

# Endgame Edition Design QA

Date: 2026-09-27. Scope: all eight approved endgame outcomes, individually and with independent Jester victory. This section does not supersede the preceding leaderboard report.

## References and Implementation

- Primary approved reference: `C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-e9d7110e-f65c-46fc-892f-189e9cc38d0f.png` (Werewolves + Jester).
- Final dark comparison: `C:/Users/Administrator/.codex/visualizations/2026/05/27/019e6aa0-15f1-7f70-9b9c-957902364c79/endgame-final/werewolves-werewolves-jester-dark-1488.png`.
- Final daylight comparison: same directory, `werewolves-village-jester-light-1488.png`.
- Final phone comparison: same directory, `werewolves-draw-jester-dark-320.png`.
- Reference and implementation were opened together at 1488 x 1058, scale factor 1. The full-width interior, outcome, separate personal victory, stacked actions and portrait revelation retain the approved hierarchy. Existing navbar, real participant avatars, server-authored results and responsive roster deliberately replace illustrative mock data.
- The eight native AVIF plates and optional transparent Jester artifact preserve the separate village, city and faction scenes. Daylight uses a localized upper wash for readable text over the window; mobile places actions before a short unobstructed art band. The page is a responsive interpretation, not a claim of identical pixels at every size.

## Fixes During QA

- Fixed intrinsic aspect-ratio expansion beyond the viewport at 1024 px.
- Corrected daylight text contrast, light-theme story colors and laurel/name overlap.
- Kept terminal reveal and winner badges dependent on the validated server result. Missing data does not cause the client to infer hidden roles or personal wins.
- A failed optional chunk retains the server's outcome explanation and navigation; its neutral heading does not deny a Jester win when no team wins.
- Route-level stylesheet loading avoids an unstyled lazy finale. Initial focus respects interaction already in progress.
- Removed obsolete winner panel rules, redundant overrides and the unused winner-rise animation instead of increasing performance limits.

## Verification

- Pinned Node 24.20.0: shared 324 passed; game-server 364 passed, 2 database integration tests skipped without TEST_DATABASE_URL; playtest 111 passed; focused terminal snapshot/hook tests 98 passed. Shared/server/web typechecks passed.
- Main web UI and replay/repeat-setting checks: 316 passed. Final conclusion/fallback/story rerun: 25 passed.
- Asset optimizer suite: 56 passed. Native endgame resolution, transparent ornaments and reproducible encodings validated. Sparse laurel detail is measured within occupied bounds, without lowering the entropy threshold or changing the source master.
- Chromium matrix: 72 cases passed across eight outcomes, solo/Jester, both themes, 320/1488 px plus dense 30-player layouts at 390/768/1024/1440 px with doubled text. Assertions covered role catalogs, replay destinations, repeat setup, back/reload, keyboard focus, decoded images, overflow, clipping and runtime errors. Representative village/town/Werewolves scenarios also passed axe checks.
- Final CSS/loading recheck: 20 cases passed. One intermediate repeated full matrix stopped with Chromium ERR_NO_BUFFER_SPACE; the affected draw cases and final representative cases passed in a fresh run without suppressing errors. No underlying Windows/network cause is claimed fixed.
- Seven updated repository browser checks passed (five first run, two on targeted rerun after correcting test measurement): two native endgame environments, Mafia game-over geometry, both persisted-replay/repeat flows, mobile document scroll and desktop full-bleed geometry. Artifacts: `C:/Users/Administrator/.codex/visualizations/2026/05/27/019e6aa0-15f1-7f70-9b9c-957902364c79/endgame-functional-tests` and `endgame-functional-recheck`.
- Latest production build, all 24 regression contracts and dictionary checks passed. Dictionary: zero hard warnings, nine existing legacy entries. `git diff --check` passed.
- Final production budget passed without baseline or limit changes: JS corpus 525.4 KiB, /play JS 131.4 KiB, /play CSS 64.2 KiB; runtime art 74,746.1 KiB of 75,000 KiB. Compared with the pre-task measurement, total JS is about +2.2 KiB, /play JS about +0.2 KiB and art about +138.4 KiB. Existing warning-tier CSS/art/metadata entries remain. No visual baselines were updated by this work.

## Operational Remainder

The approved deletion of only `.turbo` and `apps/web/.next/dev/cache` was rejected by command policy; neither was deleted. E: remains nearly full. The two temporary `turbopackFileSystemCacheForDev/Build: false` settings in `apps/web/next.config.ts` remain solely to prevent additional cache growth during local work. Remove those two settings after disk space is recovered; unrelated pre-existing chunking settings must remain intact. Screenshots were moved to C: for the final pass. These fixture checks do not establish production authentication, database persistence or a complete release sign-off. No commit, push or deploy was performed.

Design verification: passed. Canonical Linux asset verification: passed.

# Account Collection Design QA

Date: 2026-09-24. Scope: the personal account composition, existing achievement relics, responsive presentation, and an export-module boundary needed to keep the production JavaScript budget green. No game, authentication, deletion, or export algorithm changes.

## Presentation

- Portrait, membership date and summary results now form an unframed identity section. The existing archive-room imagery carries the atmosphere in both themes.
- The chronicle opens with three owned achievement relics from the existing catalog, including tier, title and the real condition. Full count uses unique known IDs; the catalog link exposes the complete collection. The preview does not imply chronological ordering.
- Results and recent evenings sit below the collection, side by side on desktop and stacked on phones. Settings and security keep opaque, quiet working surfaces and the existing accessible tab, focus and history behavior.
- Empty awards show one explicitly locked preview, not an invented earned award. Unavailable records are distinct from an empty profile and do not display fabricated zero statistics.
- Phone gutters are 20px, or 16px below 359px. No new font, dependency, artwork, continuous ambient animation, or decorative nested panel was added.
- The background overlay covers the document instead of ending at the viewport. The scene itself has a bounded height and lower fade. Both phone orientations request a sufficiently large source, avoiding an enlarged landscape thumbnail.

## Evidence

- Before: E:/codex-temp/account-before-{dark,light}.png and account-before-{dark,light}-mobile.png.
- Reviewed final captures: E:/codex-temp/account-final-{dark,light}-{320,390,768,1440}.png.
- Additional settings/security and empty/unavailable captures: E:/codex-temp/account-final-{dark,light}-{settings-390,settings-1440,security-390,security-1440,empty,unavailable}.png.
- Captures and browser interactions use synthetic profiles only. Demo: http://127.0.0.1:3000/account?visualAuth=1. Extra visualAccount values: empty, unavailable, complete, long. These remain behind the existing non-production fixture guard.

## Verification

- 97 focused component/page tests passed, including account export, privacy consumers, fixture guards and loading states.
- 41 account browser scenarios passed: theme/width matrix, decoded Retina pixel density, 200% text, long names/results, empty/unavailable/complete awards, tabs, keyboard focus, saved/draft identity, Back restoration and pending results. Dialog lifecycle includes Chromium and Firefox.
- Six ambient image-quality scenarios and four reduced-motion scenarios passed. Background source, scaling, document-height overlay and scroll stability are asserted, including 640px landscape.
- Four account visual baselines were reviewed before update, then passed without update mode. The full-page account accessibility audit also passed. Unrelated baselines were not updated.
- 12 privacy browser checks passed after extracting the shared download function, including failed export/retry, sign-in destination preservation, contrast and date stability. The moved export algorithm was compared with its pre-move text and is unchanged.
- Web typecheck, production build, regression contracts and dictionary check passed. Dictionary reports zero hard warnings and nine existing legacy entries.
- Independent read-only review found no confirmed actionable regression in the scoped visual refresh.

## Performance and Limits

- The initial build exceeded the JavaScript growth allowance by 638 bytes. Importing getImageProps still registers Next's Image client dependency in this installed version; it did not by itself reduce the corpus.
- Privacy previously imported its download helper from the account UI component, pulling account styles into a second entry. Extracting the unchanged helper into components/account/account-export.ts removed that coupling.
- Final production budget passes: JavaScript gzip 556.4 KiB, CSS gzip 139.7 KiB, artwork 74,590.3 KiB of 75,000 KiB. No budget or performance baseline was relaxed. Existing warning-tier art entries remain; this task adds no runtime artwork.
- Local fixtures and mocked downloads do not prove real production authentication, database access or multiplayer behavior. This is scoped design/regression verification, not a release sign-off. No commit, push or deploy performed.

# History Ledger Design QA

Date: 2026-09-25. Scope: implement the approved dark history concept with its row layout in both themes, and the approved daylight archive atmosphere. Preserve the public archive query, privacy boundaries, outcomes, filters, pagination, and replay destinations. No new backend feature, authentication, or game-state behavior.

## References and Evidence

- Dark reference: C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-f5ab36fc-df4c-484f-bfd4-84d9ffc2b211.png.
- Light atmosphere reference: C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-a04797c5-a862-426d-87fa-222992357125.png.
- Final captures: E:/codex-temp/history-ledger-qa/{dark,light}-{320,390,768,1440}-viewport.png, corresponding full-page captures, and webkit-prefixed captures.
- Final browser URL: http://127.0.0.1:3000/history?visualHistory=fixture.
- The reference and final desktop capture were opened together per theme. Reference renders are 1487x1058; implementation is 1440x1024, nearly the same aspect ratio. No claim of pixel-exact matching between those dimensions.
- The selected light direction supplies atmosphere only; the user approved the dark concept's layout for both themes. The implementation intentionally preserves real fixture identifiers, dates, all eight records, existing public-event summaries, and working filters instead of fabricated mock data or a fake sort dropdown.

## Review Iterations

1. Initial backgrounds isolated the book on an empty surface, weakening the approved archive setting. Re-generated the two scenes with the archive desk, drawers, daylight/window treatment, photos, and seal. Final originals are archive-ledger-{dark,light}-v2.png; exact prompts and provenance are in assets/game-art-source/history/archive-ledger-v2-prompts.md.
2. The first background crop put the bottom of the artwork behind the filter controls. Adjusted its size, position and mask so the controls occupy a quiet full-width band. On mobile, the art appears above the title rather than competing with it.
3. Full-page inspection revealed the fixed background only covered the initial viewport in capture. Replaced it with a document-height, route-scoped background, keeping the entire archive readable without inheriting the site's unrelated ambient scene.
4. Updated artwork put bright paper/dark keys behind part of the heading. Added theme-specific local reading scrims. Re-captured both themes and all four widths; reviewed desktop, tablet and phone views. Row borders, visible focus, image bounds, and controls remain consistent.
5. Row outcomes now sit at h3 under the archive list's h2. Updated the existing winner-copy test's explicit heading level; all 27 winner/family cases still assert the same text and replay destinations.

## Verification

- 97 focused history/replay component, page and helper tests passed.
- 16 Playwright archive/ledger tests passed, covering filters, independent URL state, pagination, reload, replay and Back, distinct empty/unavailable/no-match states, row geometry, decorative thumbnails, keyboard targets, and accessible replay names.
- Chromium and WebKit each passed the 320/390/768/1440 light/dark matrix, main-content axe checks, 200% text overflow checks, and runtime/console error assertions. Empty/unavailable states were also captured on phone.
- The first screenshot harness produced a hydration warning by hiding the caret before hydration of a hidden fixture input. Re-ran with screenshot caret preservation; no product-code workaround or weakened error assertions.
- Web typecheck, dictionary check (zero hard warnings), regression contracts and final production build passed.
- Targeted optimizer reproduction test passed, verifying unchanged source masters, byte-equivalent WebPs, 1536px width, bounded size, and no redundant image variants.
- Final perf:budget passed: JS gzip 556.4 KiB (same rounded size as before), CSS gzip 140.0 KiB (previously139.7), art74,729.4 KiB /75,000 KiB (previously74,590.3). Existing warning-tier art findings remain. No performance or visual baseline, hard limit, or gate changed.

## Remaining Limits

The Docker Linux engine pipe was unavailable, so a fresh canonical Linux full-corpus asset verification was not run. The new WebPs were reproduced with the pinned local sharp optimizer and its scoped test; this does not claim canonical Linux verification. Live production data/auth and multiplayer were not tested; all screenshots use synthetic fixtures. No commit, push or deploy.

No actionable P0/P1/P2 visual or behavior issue remains in the verified scope. The room/city thumbnail art is reused deliberately, not newly generated per record.

final result: passed

# Replay Chronicle Design QA

Date: 2026-09-26. Scope: implement the selected replay concept at `/history/[gameId]/replay`, retaining authorized data, chronological ordering, cursor pagination and both game families. Existing unrelated dirty-tree work is preserved.

## Visual Truth and Evidence

- Selected reference: `C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-a71e96c8-bf1f-4a0c-a4ae-c85a5d7740a4.png`.
- Before: `E:/codex-temp/replay-before-desktop-dark.png`.
- Final desktop captures: `E:/codex-temp/replay-design-qa/final-dark-desktop.png` and `final-light-desktop.png`.
- Responsive evidence: `E:/codex-temp/replay-design-qa/{chromium,firefox,webkit}-{fixture,mafia}-{dark,light}-{320,390,768,1440}.png`, with full-page versions for 390/1440. Machine-readable matrices are in the same directory.
- Reference: 1435x1096 pixels. Implementation: 1440x1096 CSS pixels at deviceScaleFactor 1. Reference and implementation were opened in the same comparison input. No claim of pixel-exact identity across the five-pixel width difference.
- State: synthetic completed Werewolf game, village winner, dark theme. The concept illustrates one final phase with eight fictional participants; implementation deliberately preserves the existing fixture's three participants and all eight events/seven phase segments. It does not invent survival statuses, discard earlier phases, or claim a vote caused the ending without authoritative evidence. The header retains the stored winner label; case reference, dates and permission scope remain genuine to the fixture.
- The same full-view inputs were readable at native desktop size. Focused inspection covered the hero/tower crop, the timeline spine, role thumbnail boundaries and roster dividers. Separate 320/390 captures and full-page mobile evidence were inspected for wrapping, target visibility and footer continuity.

## Fidelity Review

- Typography: retained the site's actual display/body fonts and navbar. Desktop display title is 72px; mobile is 41.6px/35.2px at the scoped breakpoints. No viewport-scaled typography or negative letter spacing. Both family headings and unknown-result fallbacks wrap within the page. Browser font rasterization differs slightly, without overflow.
- Layout: 410px unframed desktop hero, 1248px content, restrained three-column chronicle/index/roster arrangement, fine separators and framed 50x60 role thumbnails. Below 1100px the roster follows the timeline; below 760px phase links become horizontally scrollable. Page gutters are 16px at 320 and 20px at 390. All real phase segments remain available via native anchors.
- Color: pine-charcoal and restrained brass in dark Werewolf; cool pale green-gray in light. Mafia reuses its urban art and neutral charcoal/stone palette. Primary action remains red. Borders, focus and event tones are visible in both themes; information is not encoded by color alone.
- Images: native ImageGen produced matched dawn/daylight village compositions with a complete right-hand tower, forest, lane and small blank paper/seal. Existing role thumbnails and Mafia art are reused. Public roster portraits use the neutral card back; only an explicitly revealed public death event can show its role art. Both new runtime images are 1440x480 Q65 WebPs. No extra mobile/AVIF/PNG runtime variants.
- Content/interactions: real result and family names, no raw unknown codes or participant IDs, no made-up player survival status. Phase anchors, keyboard finale link, reload, Back/Forward, remaining roster disclosure and cursor navigation work. Empty, unavailable and expired-cursor states remain distinct.

## Corrections and Verification History

1. Removed legacy global replay class hooks after identifying their overlap with archive/leaderboard styles. Route-scoped module styles and data hooks now remain stable after client navigation and browser history.
2. An agent-added regression exposed a false finale link for a postgame departure-only chunk. The link now requires an actual final event in the current authorized chunk.
3. The first accessibility pass found duplicate named landmarks for resumed voting segments. Kept one named timeline region and ordinary phase sections/headings. Both light/dark axe failures passed after the correction; rules were not disabled.
4. Initial equal per-image allocation unnecessarily compressed the light scene. Reallocated only the new pair's budgets, retaining Q65 for both and the combined 250 KiB cap. Existing corpus gates and older recipes are unchanged.
5. One Chromium harness run encountered a dev HMR socket buffer error; a clean rerun passed. WebKit needed lazy images scrolled into view before decode and navigation to settle before the next synthetic auth request. Corrected the QA harness rather than suppressing errors or changing auth behavior; the complete rerun passed.
6. After personally reviewing desktop/mobile and both themes, updated only the four replay screenshot baselines. Re-ran the replay visual suite without update mode: all five checks passed.

## Completed Checks

- 153 targeted history/replay page, component and helper tests passed; four utility presentation geometry tests passed.
- 44 archive/journal/replay browser scenarios passed, including the two corrected accessibility cases on rerun. Covers all 1005 events without duplication, authorized artwork URLs, roster disclosure, resumed phases, cursor restart, case identity and CSS stability after navigation. Two additional cases use the real navbar theme toggle for both families, decode the newly selected artwork and assert unchanged chronicle geometry.
- Five replay visual/accessibility checks passed against the reviewed baselines, without update mode.
- Chromium, Firefox and WebKit each passed a 58-entry QA report: 320/390/768/1100/1101/1440 widths, both themes and families, 100%/200% text, axe, keyboard finale navigation, reload/Back and empty/unavailable/public/unknown-code states. Final reports contain no overflow, text-boundary failures, axe violations or runtime/console errors.
- Nine focused optimizer tests passed, including current-master preservation, byte reproduction, exact path scope, fail-closed quality, 1440x480 dimensions, combined budget and absence of extra formats.
- Web typecheck, dictionary check (zero hard warnings), regression contracts, production build and final `perf:budget` passed. Scoped `git diff --check` passed.

## Budget and Limits

- JS gzip remains 556.4 KiB at the reported precision; no client component or client runtime was added. CSS gzip is 141.2 KiB, previously 140.0.
- New artwork: 253512 bytes / 247.570 KiB combined. Final corpus is 74976.989 / 75000 KiB, leaving about 23 KiB. Existing warning-tier art and metadata findings remain. Do not add more art without reclaiming space or making an explicit product budget decision.
- These are local synthetic and mocked-session checks, not production authentication, live multiplayer, or full-release verification. A fresh canonical Linux full-corpus asset verification was not run; the new pair was reproduced with the pinned local optimizer and its focused tests.
- No commit, push or deploy. Dev remains available at `http://127.0.0.1:3000/history/fixture-game-1/replay?visualReplay=fixture`.

No actionable P0/P1/P2 issue remains in the verified replay scope. Broader art-budget cleanup is separate follow-up work.

final result: passed

# Replay Demo Fidelity Revision

Date: 2026-09-26. User explicitly requested fidelity to the selected demo after rejecting the previous all-phases layout. This revision supersedes the previous acceptance of the long chronicle and small portraits.

## Reference and Visual Review

- Reference remains `C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-a71e96c8-bf1f-4a0c-a4ae-c85a5d7740a4.png`.
- Reference and revised dark capture were opened together at 1435x1096, scale 1. Evidence: `E:/codex-temp/replay-design-qa/match-pass-{1,2,3}.png` and `E:/codex-temp/replay-match-qa/final-{dark,light}-desktop.png`.
- The new dev-only `visualReplay=demo` fixture has eight synthetic participants and the same final-day sequence as the concept. No production record is changed or substituted with demo data.
- Pass 1 corrected the primary P1 mismatch: one selected chapter instead of seven vertically expanded phase sections. Earlier events remain available, mounted in chronological order, with original phase IDs retained.
- Pass 2 corrected P2 spacing and portrait scale: 1232px content, 204px index, 652px timeline and 314px roster at the reference viewport. Chapter begins at y574; final divider is y1002, compared with approximately y1009 in the concept.
- Pass 3 verified the final three-column composition and cropped portraits against the selected image in the same input. The actual page was also inspected at mobile sizes and in light mode.

## Required Fidelity Surfaces

- Typography: retained actual product fonts and navbar, 72px desktop title and serif narrative subtitle. Removed duplicate winner subheading. Compact scene titles and larger event titles retain hierarchy without shrinking body copy.
- Spacing: 410px unframed hero, compact event rows, aligned roster heading, thin rules and larger 66x72 timeline portraits. Mobile retains 16/20px gutters and puts the roster below the events. Selected chapter is centered in the horizontal mobile index without vertical page movement.
- Colors: dark pine and brass, pale green-gray light counterpart, red primary action and active-index rule. Survival labels have words as well as colored dots. Both family/theme combinations passed contrast checks.
- Images: existing village pair, Mafia backgrounds and avatar/role art reused; no new raster assets added. Public player avatars are distinct from secret roles. Authorized role art remains a fallback when a legacy record lacks avatar metadata. Publicly revealed death art stays local to that event.
- Copy/content: phase navigation now reads Start/Night/Day/End in Bulgarian. The existing case reference, correct dates, authorized scope and authoritative outcome are retained. Cause text is preserved; unknown survival state is not guessed from a partial timeline. The narrative vote subtitle requires a recorded vote-elimination immediately before the final group.

Expected differences from the generated concept are explicit: actual product fonts, existing avatar artwork, verified case IDs and result text rather than invented survivors or a fabricated last-werewolf explanation. The background master is a separately generated production asset, not a pixel crop of the full mock. This is a faithful composition, not a claim that every raster pixel or fictional face is identical.

## Corrections and Verification

- Persisted `avatarId` and `isAlive` are selected for replay participants; hidden-role queries still omit the role column. Optional return fields preserve legacy fixtures and unknown-state fallbacks. Database sidecar: 100 affected tests passed.
- Added pure chapter grouping with original phase IDs, pauses/resumes, partial pages and safe unknown labels. No game engine, networking state or private data reconstruction was added to the client.
- Replaced the first client-heavy reader with a small enhancement of server-rendered markup. This fixed RSC key warnings and brought a 386-byte budget overage back under the unchanged growth allowance.
- Resumed phases use named groups rather than duplicate region landmarks. Axe checks are clean; no rules were disabled.
- 200 targeted history/replay/helper/geometry tests passed. Full workspace typecheck, dictionary check and regression contracts passed.
- 25 replay browser tests passed with no retries or runtime errors: theme switching, all event reachability, keyboard, Back/Forward, reload, legacy phase hashes, mobile nav positioning, public avatar/status privacy and CSS stability after archive navigation.
- 29 archive/journal checks passed across the initial run and targeted rerun of the two intentionally changed presentation assertions. All 1005 events remain reachable without duplication; cursor expiry/restart remains correct.
- Chromium, Firefox and WebKit each completed a 58-entry responsive/accessibility report without issues. Both families/themes, widths 320/390/768/1100/1101/1440, 100/200% text, empty/error/public/unknown states and keyboard navigation covered. Reports: `E:/codex-temp/replay-match-qa/`.
- Four replay visual baselines were updated only after screenshot review. All five replay visual/accessibility checks subsequently passed without update mode.
- Fresh production build and `perf:budget` passed. JS corpus is 557.2 KiB (previous 556.4), CSS 141.7 KiB; play JS remains 131.5 KiB. No limit or performance baseline changed. Art remains 74976.989 / 75000 KiB, with previous warning-tier findings unchanged.

## Scope and Handoff

Verified with local synthetic records and mocked authentication, not production authentication or live multiplayer. No commit, push or deployment. Existing unrelated dirty-tree changes preserved. Preview: `http://127.0.0.1:3000/history/demo/replay?visualReplay=demo`.

final result: passed

# Friends Guestbook Demo Implementation

Date: 2026-09-26. The user selected the cinematic guestbook demo and requested its implementation. This section covers `/friends` only; preceding reviews remain historical evidence for their own scopes.

## Source and Comparison

- Selected reference: `C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-6748a661-fc52-4ace-b15e-f51bc51c097e.png`, 1448x1086 pixels.
- Implementation: `http://127.0.0.1:3000/friends?visualAuth=1`. Captured at a 1448x1086 CSS viewport, device scale 1. `E:/codex-temp/friends-viewport-dark.png` and `friends-viewport-light.png` are viewport captures at the same pixel dimensions. Full-page counterparts are `friends-final-dark.png` and `friends-final-light.png`; the actual product footer makes the full page slightly taller than the concept.
- Matched dark state: six synthetic local names and notes, first two selected, room invitation with synthetic code ABC234. Actual product navbar, fonts and local preview origin remain in use. No real contacts or credentials appear in evidence.
- Opened the source and final dark/light captures together in one comparison input. Inspected the heading, list alignment, monograms, fine row rules, letter, seal and primary action at readable desktop scale. Additional focused screenshots cover the dialog and invitation, and full-page 320/390 captures establish wrapping and footer continuity. No raster density scaling was needed.
- Mobile evidence: `E:/codex-temp/friends-mobile-final-{dark,light}.png` (390px), plus current 320/390/768/1440 and 200-percent text captures in `E:/codex-temp/friends-qa/`.

## Fidelity Surfaces

- Typography: retained product Literata/Sofia Sans rather than approximating the demo with unrelated fonts. Desktop heading 60px, intermediate 52px, mobile 40px/36px; no viewport font scaling or negative letter spacing. Names use the display face, notes and actions use the UI face. Text wraps without concealing controls, including maximum-length names and notes.
- Layout: unframed full-bleed room, compact heading, list left and 408px invitation right at the reference width. The guestbook list begins near x192 and invitation ends near x1368, subject to native scrollbar width. At <=820px the invitation follows the list. Gutters are 16px at 320 and 20px at 390. Form editing is a native modal rather than a permanent third panel.
- Color: dark pine, cream lettering and restrained brass; light limestone/sage with matching daylight scene. Parchment and red wax connect the invitation to the scene in both themes. Selected rows also have checked controls; focus is explicit, not color-only state.
- Images: replaced the two existing scene masters with matched evening/daylight compositions, not a new layer of duplicate backgrounds. Generated a transparent wax seal and blank medallion for live initials. Existing paper texture is reused. Runtime scenes are 1448px WebP/AVIF plus 960px mobile WebP; ornaments are 192px/128px WebP. Browser tests decode images and compare rendered pixels with the background enabled/disabled, catching invisible-but-loaded art.
- Content and behavior: this is still a local guestbook, not a remote social graph. Add/edit/delete/undo, draft preservation, duplicate checks, corrupt-storage recovery, concurrent-tab conflicts, unavailable storage and clipboard fallback remain. Selection survives filtering; invitation uses the current origin and validated room code. No fixture data is inserted into a normal user's storage.

Expected differences from the generated concept: real product navbar/footer and typography; functional delete/undo instead of an undefined overflow menu; accurate filtered-selection wording and indeterminate checkbox; real invitation URL instead of hardcoded domain-only text. The production background is a separately generated clean plate. Fidelity describes composition and character, not identical generated pixels or fabricated application behavior.

## Findings Corrected During Review

1. Initial list alignment, title size and heavy paper treatment differed from the reference. Adjusted desktop grid, 60px heading and pale paper overlay; recaptured and compared against the selected reference.
2. Light artwork initially decoded but sat behind the body background. Corrected the route-scoped stacking context. Removed a rectangular header overlay edge and regenerated only the light copy area's illumination. A later floor fade exposed a page/footer edge; moved that fade to the background layer and recaptured `friends-final-light.png`.
3. Mobile heading spacing pushed the list too far down. Tuned the 286px natural header composition, including 74px top padding at <=360px, without imposing a fixed height that would clip enlarged text.
4. At 200-percent text, the 320px title and invitation mode labels widened the page. Added min-width constraints, wrapping and minmax(0, 1fr) tracks. Both themes now pass enlarged-text checks with no horizontal overflow.
5. Native dialog Tab wrapping needed explicit first/last control handling. Escape/backdrop close retain drafts; focus returns to the original trigger or the surviving Add button. React Activity hides close the native top layer and restore the retained draft on return.
6. Firefox restored dynamic button-disabled state on reload, producing a hydration mismatch. Local ActionButton markup now disables that restoration with autocomplete=off, without suppressing hydration errors. This behavior is documented at https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/disabled. Four Firefox reload/CRUD tests pass after the correction.
7. Some intermediate browser runs overlapped builds/HMR and failed with startup/navigation timeouts or screenshot-injected inline caret styles. Screenshots now hide carets through a temporary stylesheet, not input DOM mutation. Fresh serial runs pass with runtime-error assertions intact; no browser errors are filtered away.

## Completed Verification

- 42 FriendsClient tests and four presentation geometry tests passed; the added autocomplete contract assertion was also rerun directly. Earlier focused storage coverage passed and its implementation is unchanged.
- All 21 guestbook browser tests passed in one final Chromium run, with no retries: light/dark at 320/390/768/1440, empty/populated/long records, selection/filtering, real clipboard, room/site invitation switching, CRUD/undo, reload, keyboard/focus, 200-percent text, axe checks and private-record network assertions. No runtime or console errors in the accepted run.
- Four native dialog CRUD/Escape/reload/focus tests each passed in Firefox and WebKit, also without retries. Final result directories: `results-accepted`, `results-firefox-clean`, `results-webkit-accepted` under `E:/codex-temp/friends-qa/`.
- All 47 optimizer tests passed, including deterministic reproduction, bounded scene recipes, ornament alpha/dimensions/entropy and scoped asset budgets. All 102 AVIF/WebP pairs passed dimension checks.
- Dictionary check passed with zero hard warnings; regression contracts passed. Fresh production build and TypeScript compilation passed after the Firefox correction. Scoped diff whitespace check passed. No visual baseline was updated for this work.

## Remaining Release Gate

- `perf:budget` is NOT green: final JS corpus is 557.9 KiB, 474 bytes above the unchanged allowed growth from the checked-in 552.4 KiB baseline. Before this task it was about 557.3 KiB and still passed. The initial redesign exceeded the allowance by 927 bytes; a bounded client simplification reduced the increase without removing accessibility or storage behavior. No baseline, limit or error severity was changed.
- Protected route caps pass; `/play` remains 131.5 KiB JS. CSS corpus is 142.7 KiB. Art corpus is 74829.1 / 75000 KiB, down from 74976.989 KiB before this task; about 171 KiB headroom remains. Existing art/metadata warning-tier findings remain.
- A complete canonical Linux full-corpus asset regeneration and full release suite were not run. Local fixtures do not prove production authentication or multiplayer. The JS growth violation must be resolved before treating this as release-ready.

The visual and interaction scope has no remaining actionable P0/P1/P2 finding in the checked scenarios. This design-QA pass does not waive the separately failing performance release gate. No commit, push or deploy. Local dev remains running.

final result: passed

# Friends Demo Fidelity Correction

Date: 2026-09-26. The user correctly rejected the preceding implementation as not 1:1 with the selected demo. This comparison supersedes its visual fidelity acceptance, not its functional test evidence.

- Source is still `exec-6748a661-fc52-4ace-b15e-f51bc51c097e.png` at 1448x1086. Opened it together with `E:/codex-temp/friends-fidelity-dark-2.png` at the same 1448x1086 viewport/density, six synthetic names, first two selected and ABC234 invitation. Light counterpart: `friends-fidelity-light-2.png`. Mobile counterpart: `friends-fidelity-light-mobile.png` at 390px. Final mobile invitation reports equal scrollHeight/clientHeight (218px), so the ordinary full URL is not clipped.
- Earlier P2 differences: names/notes were in the wrong horizontal tracks; medallions were too small; selected rows were oversized green blocks; row rules were shortened by a permanently reserved scrollbar; invitation used overly clean shared paper; footer sat below the reference frame; lower background was too busy. The first correction is `friends-fidelity-dark-1.png`; the second corrects medallion scale, name size, paper edge contrast and full-frame height.
- Typography: retained product font files, reduced list title to 29px/400 and desktop names to 20px/400. Header remains 60px. Names, notes and controls now align with the reference's distinct columns. Mobile names remain 21px and no font is scaled with viewport width.
- Spacing: desktop rows are 62px; medallion slots are 56px to account for the raster's transparent edge; notes start near x415 and names near x327 in the full-width reference state. Mobile retains its separate compact grid and 16/20px gutters. Route-scoped footer spacing and content minimum height now keep the six-person reference composition within 1086px.
- Color/material: reduced dark selected-row fill, softened separators, and added a restrained full-scene readability layer. The invitation now uses a purpose-generated aged-paper bitmap with live HTML controls, a distinct divider below the room code, more open letter leading and a less pill-shaped primary action. Light mode retains readable green ink and visible row states.
- New asset: `assets/game-art-source/friends/invitation-paper-v1.png`, delivered as `apps/web/public/game-art/friends/invitation-paper-v1.webp` (816x1088, Q72, 36618 bytes). Built-in Image Gen prompt/reference/provenance is recorded in `assets/game-art-source/friends/README.md`. No extra AVIF/mobile copy, no changes to shared parchment or either scene master.
- Mobile inspection caught a clipped final URL line after the desktop letter was tightened. Set a separate mobile preview minimum height and added a browser assertion that an ordinary two-person room invitation fits in full. All eight affected invitation/enlarged-text cases passed again.
- Verification: all 21 guestbook browser cases passed without retries; four presentation geometry checks passed; two focused optimizer tests passed, including current-master reproduction and the new paper's dimensions/quality/budget. Regression contracts and fresh production build/TypeScript passed. No runtime or axe failures in the accepted browser run. Scoped diff whitespace check passed; no visual or performance baseline was changed.
- Remaining expected differences: actual product fonts, native checkboxes/radios, existing navbar, working delete/undo command and current-origin invitation URL. Separately generated scene/seal/paper are not pixel-identical raster extractions. These are explicitly disclosed, not a claim of literal pixel equality. No further actionable layout/accessibility regression was found in the tested states.
- Performance release gate remains open and unchanged: 557.9 KiB JS, 474 bytes over the baseline growth allowance; CSS 142.9 KiB; art 74864.8 / 75000 KiB. No additional JavaScript was introduced by this CSS/art correction. No commit, push or deploy.

final result: passed

# Friends Reference Detail Pass

Date: 2026-09-26. Follow-up to the user's request to bring the working page closer to the approved demo. This entry supersedes the preceding performance status and native-control fidelity notes.

## Reference And Evidence

- Target: `C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-6748a661-fc52-4ace-b15e-f51bc51c097e.png`, 1448x1086.
- Before: `E:/codex-temp/friends-match-before.png`, captured with the same six synthetic names/notes, first two selected, and ABC234 room code. Source and implementation were opened together for comparison.
- Final desktop: `E:/codex-temp/friends-final-match/guestbook-demo-dark-1448x1086.png` and `guestbook-demo-light-1448x1086.png`. Both are real browser captures, not regenerated mockups.
- Mobile: `guestbook-demo-dark-390x844.png` and `guestbook-demo-light-390x844.png` in the same directory. Additional populated, empty, maximum-length and enlarged-text captures cover 320, 390, 768 and 1440px in both themes. Personally inspected representative captures at all four sizes.

## Changes And Findings

- P2: browser-default grey checkbox fills weakened selection visibility and differed from the approved controls. Added consistent outlined 24px controls with server-rendered Lucide check/minus icons. Native input semantics, partial selection, keyboard focus and disabled behavior remain intact; symbols distinguish selection without color alone.
- P2: notes/counts/privacy text and the add command were too small, and edit icons lacked the intended metal accent. Increased those text sizes, enlarged the add icon, and restored restrained gold editing controls without changing product fonts or introducing a dependency.
- Layout: kept 62px desktop rows and the separate responsive grid; refined the desktop column gap to 47px, list title alignment and header kicker/subtitle spacing. A trial scrollbar compensation was removed after headed-browser inspection exposed differing viewport-unit behavior. Content continues to align with the actual shared navbar and reserved browser gutter, without hardcoded scrollbar widths.
- Material: softened the paper edge contrast, added small library-icon divider details, resized radio indicators and tightened the ordinary invitation height. Preserved content-measured textarea growth and the 480px cap for very large selections. Reduced the green cast in the dark scene's lower overlay.
- Behavior preserved: local-only records, edit conflict handling, undo, native dialog scroll locking/focus restoration, current-origin links, escaped content and clipboard fallback. No gameplay, auth, storage schema or network behavior changed.
- Typography investigation confirmed that the existing Literata and Sofia Sans assets are genuine variable fonts, not accidental static bold files. Global font files and declarations were left unchanged.

## Verification

- 61 unit/presentation cases passed across the initial suite and focused rerun. The sole initial assertion expected the old checkbox DOM sibling and was updated to verify the new wrapper and aria-hidden decorative icon.
- 38 distinct Chromium cases passed across the complete 37-case run and final affected-desktop run, which added the light reference state. Includes axe checks, runtime-error checks, storage privacy, CRUD, copied full URL, 200% text and horizontal-overflow checks.
- 16 distinct Firefox/WebKit cases passed across scoped runs: modal CRUD/scroll lock, wrapped/large invitations and reference captures in both themes. Firefox exposed DOMRect rounding to 480.000061px; the cap assertion now measures integer layout height, still capped at 480px. No limit was increased.
- Web typecheck, final production build, regression contracts and fresh `perf:budget` passed. JavaScript is 556.8 KiB, CSS approximately 143.3 KiB, /play JS 131.5 KiB, art unchanged at 74864.8 KiB. The former JavaScript growth failure was resolved by the preceding server-owned icon-slot fix, which this pass preserves. Existing art/metadata warning tiers remain; hard limits and baselines were not changed.
- No full release suite, production login or multiplayer verification was performed for this presentation-only task. No commit, push or deploy.

## Fidelity Boundary

No remaining actionable P0/P1/P2 issue was found in the scoped visual/interaction review. The page follows the reference composition but is not literally pixel-identical: actual product fonts/navbar, separately generated scene/seal/paper details, direct delete/undo rather than a fictional overflow menu, accurate selection labels, real invitation URL and browser scrollbar space remain. Mobile deliberately uses a single column. These are disclosed functional/product differences, not a claim of exact raster equality.

final result: passed

# Invitation Threshold Implementation

Date: 2026-09-26. Scope is the invitation preview at `/lobby/[code]`, not the playable waiting room in `/play`.

## Reference And Evidence

- Approved reference: `C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-86e25acc-e0a4-4aea-8553-f4c15037e7e3.png`, 1487x1058.
- Real browser evidence: `E:/codex-temp/invitation-accepted-dark-1487.png` and `invitation-accepted-light-1487.png`. CSS viewport and screenshot are both 1487x1058 at device scale factor 1, without browser chrome or density rescaling.
- Matched state: private Werewolf invitation ABC234, six of twelve places occupied, host Mila and three public preview names. All data is synthetic, provided by isolated browser-context route interception; no real room, credentials or private role information was used.
- Source and implementation were combined into `E:/codex-temp/invitation-reference-comparison.png` (reference left, implementation right). The focused `invitation-reference-detail.png` compares equal 500x780 regions starting at x100/y105, so copy, type and controls can be inspected without relying on a reduced full-page view.
- Before: `E:/codex-temp/lobby-invitation-before-demo.png`. Intermediate desktop passes: `invitation-iteration1.png`, `invitation-iteration2.png`. Final responsive evidence includes `invitation-accepted-{light,dark}-{320,390}.png`, `invitation-accepted-light-1024.png`, and the 768px captures under `invitation-final-*`. Personal review also covered both Mafia themes; its existing family-specific artwork is retained.
- Viewport captures are used for narrow-screen handoff because headed Chromium's full-page capture can temporarily change scrollbar allocation. Geometry assertions run against the actual viewport before capture. Dev-only Next overlays are hidden in handoff screenshots; real application controls are not hidden.

## Comparison And Corrections

- Initial P1: the previous large opaque invitation panel did not resemble the approved open composition. Replaced it with a frameless, constrained content column over dedicated clean background plates, retaining real semantic HTML and all eligibility behavior.
- First comparison P2: heading/intro rhythm, code size, medallion scale and button proportions drifted from the mock. Adjusted fixed typography, gold rules, 52px medallion slots and the 450px action row. At the reference viewport, the action row is x127.5/y735.78 with height 58px, matching the intended placement. No viewport-scaled font sizing was introduced.
- Responsive P2: artwork was too busy behind mobile text. The upper scene now fades before the main reading area. On small screens actions precede the roster visually; at 320px they stack rather than squeezing labels. At 390px the primary row ends at y614.58; at 320px both stacked actions end at y676.97 in the checked ordinary state.
- Mid-width P2: centered cover cropping placed the copy button and last participant over a chair at 1024px. At 801-1200px the scene is left-aligned and the readability layer protects the full content column. The final light 1024px capture shows controls against the quiet plaster wall.
- Browser checks found two further P2 issues: the 1024x768 action row ended at y825.78, and a long name moved one 320px medallion down by 4px. Added a short-viewport desktop spacing variant and top-aligned medallions. The action row now ends at y745.98 in the same offline-participant fixture; all eight affected Chromium cases passed on repeat.

## Required Fidelity Surfaces

- Typography: preserved the product's actual Literata and Sofia Sans files. Desktop title 66px, body 20px, utility text 16px; separate compact and mobile sizes preserve wrapping and readable actions. These real fonts are not pixel-identical to raster-generated lettering.
- Layout: the desktop title, code rules, public roster and actions follow the reference composition. Light/dark share stable control dimensions. Narrow and short screens deliberately adapt the sequence and spacing; there is no enclosing decorative card.
- Color: dark forest-green, warm pale-sage light treatment, restrained gold and red primary actions. Text readability is provided by scoped scene overlays, not opaque nested panels. Focus remains a separate visible outline.
- Artwork: the approved room was edited into a clean dark plate, with a corresponding light plate. There is no baked interface text and no fake higher-resolution upscaling. Native 1487x1058 WebP delivery remains visually detailed; gold medallions reuse existing product artwork rather than new ornamental approximations.
- Copy/content: synthetic example labels are replaced by authoritative room previews at runtime. Public participant statuses, capacity, host, full/active/finished states and entry eligibility remain accurate. A direct copy-link control is intentionally retained in addition to sharing, unlike the static mock.

## Assets And Performance

- Provenance and canonical delivery are recorded in `assets/game-art-source/invitation/README.md`. The unused old lobby-banner source and both runtime derivatives were moved byte-for-byte into `assets/game-art-archive/lobby/`; active shared tavern art was not removed.
- An initial art-budget failure of 9332 bytes was corrected by a tighter exact-path 300 KiB encoding budget for the two new plates, using the unchanged Q82/78/74/70 loop and Q70 floor. Delivered dark is 205568 bytes at Q82; light is 268692 bytes at Q78. Masters and native dimensions are unchanged.
- Five focused optimizer cases passed. Two scoped canonical Linux regenerations matched byte-for-byte; unrelated runtime images remained unchanged. All 101 remaining AVIF/WebP pairs passed read-only dimension checks.
- Final production build and TypeScript compilation passed. Regression contracts, dictionary check (zero hard warnings) and scoped diff whitespace checks passed.
- Fresh `perf:budget` passed: JS 556.9 KiB, CSS 144.2 KiB, `/play` JS 131.5 KiB, art 74959.72/75000 KiB. Art headroom is only 40.28 KiB; existing warning-tier art/metadata findings remain. No baseline or release limit was raised.

## Acceptance Status

- Accepted coverage totals 30 unit cases and 96 distinct browser cases: 56 Chromium invitation, 8 affected auth/invitation, 16 Firefox and 16 WebKit. These are cumulative targeted runs, not duplicated rerun counts or a claim of one frozen full-suite execution. The final unit rerun again passed all 30 cases, and standalone web typecheck passed after test changes.
- Browser coverage includes both families/themes at 320, 390, 768, 844 landscape, 1024 and 1440px; ordinary/long names, increased text, entry eligibility, full/active/finished/missing/unavailable previews, retry, canonical copy/share payloads, keyboard focus, overflow, runtime errors and axe checks. Evidence and individual result directories are indexed in `E:/codex-temp/invitation-verification-summary.md`.
- Firefox reported 43.999969px for a 44px control after scrolling; the test normalizes numerical precision without reducing the 44px minimum. WebKit's native Tab policy skips links, independently reproduced with plain HTML; the existing repository programmatic link-focus pattern verifies tabindex and visible focus, while buttons retain keyboard activation. A crashed WebKit worker was followed by successful execution of all failed/unrun cases.
- Clipboard writes are instrumented: the tests prove canonical payloads and fallback invocation, not operating-system clipboard reads. Native WebKit Tab traversal through links is not claimed. These are explicit coverage limits, not unreported product failures.
- Production login, live multiplayer and the full release suite are outside this presentation-only verification. Local synthetic previews do not prove those flows. No commit, push or deploy was performed; the existing dev server remains running.
- Fidelity boundary: the composition follows the selected mock, but this is not a claim of exact raster equality. Shared navbar/footer, actual fonts, reused medallion texture, working copy-link command and responsive layouts are deliberate product differences. Generative cleanplate editing also changes some individual background pixels.

final result: passed

# Invitation Reference Fidelity Pass

Date: 2026-09-26. Follow-up to the approved request to match the invitation demo more closely. This entry supersedes the preceding typography and shared-chrome fidelity notes.

## Reference And Evidence

- Source remains `C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-86e25acc-e0a4-4aea-8553-f4c15037e7e3.png` (1487x1058).
- Before: `E:/codex-temp/invitation-fidelity-before.png`. Final real-browser captures: `E:/codex-temp/invitation-fidelity-final-dark.png` and `invitation-fidelity-final-light.png`, both 1487x1058 CSS/pixel viewport at density 1. Same synthetic private Werewolf invitation ABC234, Mila/Kamen/Anna, six of twelve places occupied. No production data or actual room was used.
- Opened the same-size full comparison `invitation-fidelity-final-comparison.png` (source left, implementation right) and focused `invitation-fidelity-final-detail.png` (equal 500x780 crops at x100/y105). The full comparison was displayed downscaled; the focused comparison preserves readable detail.
- Personally inspected 320/390px mobile, 768px tablet, 1024x768 short desktop, 1201/1280px navigation breakpoints and both full-size themes. Also inspected retained Mafia artwork on desktop and mobile. Intermediate evidence is under `E:/codex-temp/invitation-fidelity-*`.

## Findings And Corrections

- P2, fidelity: heading/code/button proportions, gold outlines, medallion spacing and the opaque footer differed from the reference. Refined only route presentation: 68px/650 Literata title, 20px/28px introduction, 54px room code, muted metal control borders, 52px monograms, 18px primary-action text and reference-aligned spacing. Actual product variable fonts remain unchanged; browser inspection confirmed custom Literata rendering rather than fallback.
- P2, navigation alignment: widened the desktop invitation navbar to the reference's content alignment while retaining the existing logo, Lucide icons and real navigation. Footer transparency now lets the scene continue through it. These shared-surface overrides apply only while the invitation pathname is active.
- P2, iteration regression: an extra 2px of content height introduced a desktop scrollbar and shifted centered content 7.5px left. Reduced bottom padding by 2px, without hiding overflow. Final dark/light reference state has code top y370, medallions y614.98, CTA x130.5/y735.98 with height58, footer y974 and total page height1058.
- P2, SPA regression: Cache Components preserves the previous route as hidden Activity content. The original `body:has(.lobby-invitation-page)` therefore continued styling the homepage after a logo click. Replaced these selectors with the established active `.site-chrome[data-route^="/lobby/"]` pattern. Added tests comparing fresh homepage body/header/footer styles with the same page after logo navigation and browser Back, while explicitly retaining the hidden invitation DOM.
- All corrected P2 findings were recaptured or reproduced after their fixes. No remaining actionable P0/P1/P2 visual discrepancy was found in the scoped comparison.

## Fidelity Surfaces

- Typography/layout: fixed sizes rather than viewport-scaled fonts; two-line title and ordinary desktop CTA positions match the measured reference anchors. Mobile keeps its deliberately different action-before-roster layout and 16/20px gutters. Long names, larger text and short screens retain wrapping and visible controls.
- Color/material: restrained brass rules and outlines, red primary actions, translucent dark footer and readable light green ink. The independent focus outline remains visible. No global font/token rewrite or decorative panel was added.
- Images: retained the existing purpose-generated scene plates and product medallion asset. No new raster bytes, compression changes, custom drawn artwork or decorative motion were introduced.
- Copy/behavior: unchanged natural Bulgarian, authoritative preview eligibility and canonical share/copy behavior. The direct copy-link command intentionally remains in addition to sharing. Screenshots are synthetic evidence, not an invitation to a real ABC234 room.
- P3 fidelity boundary: actual font rasterization, the reused fine-line medallion texture, existing brand/icon shapes, separately generated cleanplate details and the extra copy-link control differ from the generated mock. This is a faithful responsive implementation, not a claim of identical pixels.

## Verification

- 116 distinct browser cases passed across scoped runs: 60 Chromium, 28 Firefox and 28 WebKit. Includes both families/themes, six responsive sizes, long names, enlarged text, eligibility/error states, keyboard/share/copy, overflow, runtime errors and axe checks. Four new cases protect reference geometry and SPA style restoration; existing 56 cases were preserved. Report JSON files are `E:/codex-temp/invitation-fidelity-{chromium,chromium-reference-fixed,firefox,webkit,spa-chromium,spa-firefox,spa-webkit-ready}.json`.
- Initial reference failures corresponded to the reproduced 2px scrollbar regression and passed after the CSS correction. Initial WebKit SPA failures reported a session access-control console error during hard navigation; a trace diagnostic and explicit mocked-session readiness waits isolated a fixture race. Both affected cases passed after the fixture fix. No console error filter, assertion relaxation or production auth change was introduced.
- Final web typecheck, production build, regression contracts and fresh performance budget passed. JavaScript remains 556.9 KiB, CSS 144.6 KiB (previously 144.2), `/play` JavaScript 131.5 KiB and art 74959.72/75000 KiB. Existing art/metadata warning tiers remain; no hard limit or baseline was changed.
- No runtime JS, copy, image masters, auth logic or gameplay logic changed in this pass. Production login, real multiplayer and full release verification were not repeated for this CSS-only correction. No commit, push or deploy. Existing dev remains available at `http://127.0.0.1:3000`.

final result: passed

# Waiting Room Without Sidebar

Date: 2026-09-26. Scope: the pre-game lobby of `/play/[code]`, not the invitation route. The approved target is the second waiting-room mock, `exec-693b6ff0-6f09-4d96-9efa-413b40fca467.png` in the existing generated-images directory.

## Visual Evidence

- Before: `E:/codex-temp/waiting-room-demo-before.png`.
- Real final captures: `E:/codex-temp/waiting-shipped-{dark,light}-{1487,390}.png`. Synthetic ABC234 room, eight ready participants, host view. The navbar deliberately retains the real unauthenticated state rather than fabricating the mock's account session.
- Opened the same-size source/implementation comparison `E:/codex-temp/waiting-reference-comparison.png` and equal-resolution action-band crops in `waiting-reference-detail.png`. Full comparison was displayed downscaled; the detail comparison was inspected separately.
- Personally reviewed both desktop themes, mobile at 320/390, tablet at 768, narrow desktop and 12/30-person compositions. Further family captures are `waiting-final-{family}-{theme}-{width}-{players}.png` in `E:/codex-temp`.

## Implementation And Corrections

- Replaced the lobby sidebar with one full-width scene, DOM portraits, header invitation controls and a low readiness/action band. Active phases retain their existing table, personal role and interaction panel.
- Generated four clean scene plates: village tavern and city salon, each in light/dark. Existing profile portraits, fonts, navbar and UI tools are reused. Runtime art contains no baked-in controls or player identities.
- Corrected overlapping seats at intermediate widths and crowded counts. Compact grids are used below 1366px; large text can fall back to an unframed grid. The scene is capped at 1780px to avoid excessive upscaling.
- Corrected inherited mobile dock padding, orphaned setting separators, low-contrast light headers, menu stacking and a mobile repeating-background regression discovered in the actual screenshots. Added a non-repeating-background assertion.
- Observers no longer see the ready action which the server rejects. Readiness still comes from public authoritative flags; disconnected participants retain their distinct status. Host manual start, countdown cancellation, copy fallback, confirmation on leaving, rules and signals are preserved.
- Removed the unused lobby variant of PlayActionDock and its duplicate summary. Replaced obsolete presentation tests with tests for the new band; active command behavior remains covered.
- P3 reference differences: real catalog portraits and participant order differ from the generated example; existing brand/auth state and icons are preserved. Host management affordances are intentionally added. The light theme has a stronger reading wash, and mobile uses a compact portrait grid rather than shrinking the desktop table. This is not an identical-pixel claim.

## Verification

- 202 focused web tests passed for PlayStage, PlaySeat, client, visual fixtures, phase transitions and navigation guards. After removal of the obsolete dock variant, 81 overlapping client/dock tests passed. Web typecheck and final workspace production build passed.
- 59 distinct Chromium cases passed across waiting-room behavior (15), layout/accessibility (18), existing playroom confidence (22), and background quality across lobby/active phases (4). Final mobile background/grid changes were rechecked with 13 passing layout cases. Includes axe, keyboard, both themes/families, 320/390/768/1440, 200% text, privacy, observers, copy failure, dialogs, leave cancellation, reload and hydration. No baselines were updated.
- Twelve selected Firefox/WebKit cases completed. One Firefox viewport assertion was flaky once after closing the signals sheet, passed on retry and then passed three additional runs with retries disabled. No production behavior or assertion was relaxed to hide this; intermittent focus/scroll timing remains a monitoring note.
- Regression contracts and dictionary check passed (nine existing legacy dictionary notices). Asset worker's six focused pipeline/guard tests passed. Original master hashes were preserved; only four runtime WebPs were added. Six proven-unused empty-lobby derivatives were archived with their masters and verified hashes.
- One final build attempt exited in Next's page-data worker without a diagnostic. The same unchanged source built successfully on the next run. No configuration was weakened.
- Current art corpus: 74,993.18 / 75,000 KiB, about 6.82 KiB headroom. Four new plates total 879,322 bytes; archived derivatives reclaimed 845,065 bytes. Q70 floor is unchanged. The two Werewolf runtime plates use the explicit 1320px delivery policy; full-size PNG masters remain intact.
- Performance gate is NOT fully passing: total JavaScript 557.2 KiB passes its delta/cap; `/play/[code]` JavaScript is 131.8 KiB, below the 140 KiB absolute cap but **240 bytes above the allowed baseline growth**. CSS is 60.3 KiB for the route, within budget. No baseline or limit was changed. Prior recorded `/play` JS was about 131.5 KiB; the remaining violation belongs to this waiting-room pass.
- No real multiplayer, production auth, deployment or full release suite was claimed. Tests and screenshots use synthetic state. No commit, push or deploy. Existing dev remains running at `http://127.0.0.1:3000`.

Visual and interaction acceptance: passed. Release acceptance remains blocked by the stated JavaScript delta; remove at least 240 gzip bytes from the route before release, then rebuild and rerun perf:budget.

final result: passed (scoped visual and interaction QA only)

# Waiting Room Regression Corrections

Date: 2026-09-27. Follow-up to the waiting-room review, scoped to fixing its findings and comparing the implementation with the approved no-sidebar mock. Active gameplay was not redesigned.

## Confirmed Fixes

- Seat management menus are clamped from their actual rendered bounds, rather than relying only on a guessed CSS grid column. Resize remeasures from the unshifted bounds; Escape and focus return remain intact.
- Removed the obsolete short-phone lobby overrides which absolutely positioned a 20px status container after its text had been unhidden. Labels now stay below portraits at 320x568 and 390x600.
- Nine-player waiting tables now use the same 76px portrait size as the twelve-anchor geometry. Verified that seats do not overlap at 1366px for counts 9 through 12.
- A phase change clears the open seat menu. Hidden controls no longer consume Escape or reappear with stale state during mayor succession.
- Host/narrator tools and keyboard help share one deferred module. Loading failure leaves the table intact, provides retry, preserves intentional focus movement and ignores completions after disconnect. Existing consent and recipient guards remain in the parent; merely loading the module does not render private narrator state for ordinary players.
- The waiting-room preparation band is now a small presentation component using the same authoritative public flags and parent handlers. No gameplay command or eligibility rule changed.

## Verification

- Final focused unit run: 113 passed across the client orchestrator, lobby, seat privacy and PlaySeat tests. This includes asynchronous load failure/retry, keyboard-help failure recovery, disconnect, focus, menu cleanup and existing action behavior.
- 91 Chromium cases passed across waiting-room behavior, layout/accessibility and existing playroom confidence. After the final component/loading changes, all 37 affected behavior/confidence cases were rerun with retries disabled and passed. The 54 layout cases remain applicable because their CSS/geometry was unchanged afterwards.
- 40 additional Firefox/WebKit cases passed for short-phone status geometry and every management menu across the tested counts and widths. Result directories: `E:/codex-temp/waiting-final-fixes-results`, `waiting-cross-results`, and `waiting-corrected-final-behavior`.
- Final production build (including TypeScript), regression contracts, dictionary check and scoped diff whitespace check passed. Dictionary retains nine pre-existing legacy notices and zero hard warnings. No screenshots or performance baselines were updated.
- Personally inspected the final light/dark desktop captures and both game families on small screens. Fresh isolated 390px light/dark pages reported no runtime/console errors or horizontal overflow. Mobile control bounds retain the intended gutters; viewport captures were also used to avoid a full-page screenshot scrollbar/capture artifact.

## Reference Comparison

- Approved source: `C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-693b6ff0-6f09-4d96-9efa-413b40fca467.png`.
- Opened the source and real dark page at the same 1487x1058 viewport. Final desktop evidence: `E:/codex-temp/waiting-corrected-dark-1487.png` and `waiting-corrected-light-1487.png`. Mobile evidence includes `waiting-corrected-{dark,light}-390-{top,controls}.png` and family captures under the same prefix.
- The full-bleed room, physical oval table, surrounding portraits, invitation position and bottom action band match the approved composition. No sidebar was restored and no replacement artwork was generated.
- It is not pixel-identical: the real catalog portraits/order, authentication state, host management buttons, label shapes and primary button dimensions differ. The light theme intentionally uses a stronger reading wash; phones use an accessible grid. These are disclosed fidelity differences, not a claim that the mock and screenshot are interchangeable.

## Outstanding Budget

- The original route violation was 240 bytes. Final `/play/[code]` declared JavaScript is 131.1 KiB and now passes its route budget; route CSS is 60.2 KiB.
- The overall performance gate still FAILS: JavaScript corpus is 558.2 KiB, **840 bytes above the allowed baseline growth**. The previous total was 557.2 KiB; optional-tool splitting improves initial route delivery but adds corpus overhead. This is a remaining regression, not a passing release result.
- Consolidated optional chunks reduced the initial 1182-byte corpus overage. Trials of neighboring chunk-merging thresholds worsened total delivery and were fully reverted; `minChunkSize` remains 29000. No limit or baseline was relaxed. Further byte removal must be checked against both route and corpus measurements.
- Art remains 74993.18/75000 KiB, with roughly 6.82 KiB headroom. Existing art/metadata warning tiers remain. No runtime images were added or changed in this correction pass.
- Synthetic fixtures do not prove real multiplayer or production authentication. Neither was claimed or modified. No commit, push or deployment was performed; dev remains at `http://127.0.0.1:3000`.

Final result: UI regression fixes verified; release acceptance remains blocked by the 840-byte corpus delta.

# Active Playroom: Approved Scene Implementation

Date: 2026-09-27. Scope: implement the approved active-game composition, not another lobby redesign. Existing unrelated working-tree changes were preserved. No commit, push or deploy.

## Reference And Fidelity

- Approved source: `C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-149ac442-ec10-4d24-95b0-5a4e7ac28e8d.png`.
- Compared the source and actual Werewolf page at 1487x1058. The physical room, unframed oval seating, phase heading, room ledger, central timer and three-part bottom console follow the approved composition. The scene ends at y770, matching the reference. Existing family/theme waiting-room artwork is reused; no runtime assets were added.
- Desktop evidence: `E:/codex-temp/play-approved-{werewolves,mafia}-{dark,light}-1487.png`. Short-laptop evidence: `play-approved-werewolves-dark-1366.png` and `play-approved-mafia-light-1440.png` under the same directory.
- Personally reviewed both families/themes on desktop, representative 320/390/768 screens, the 1366x768 oval, and 320px at 200% text. Eighteen viewport captures plus four enlarged-text captures report no horizontal overflow or runtime exceptions. Explicitly awaited role-art decoding before judging the final images.
- Typography retains the established display serif and Bulgarian interface face. Red primary actions, restrained brass edges and green/charcoal console surfaces follow the existing brand. No decorative panel nesting or new sidebar was introduced.
- This is not a pixel-identical screenshot: real catalog portraits, synthetic names, vote counts and the actual authentication state differ. The real application retains skip confirmation, rules, signal preferences and role details absent from the mock. Mafia also retains its nominee controls. Light mode adds local contrast washes; narrow/crowded tables use an accessible grid. These are intentional functional/responsive differences.

## Regression Corrections

- Role conceal/reveal remains independent from public seating. The private result is visible in the personal console and disappears when concealed. Public seats never receive the role dossier.
- Selected and accepted votes are distinct. Only the existing authoritative acknowledgement supplies the accepted state; the visual fixture cannot invent acceptance.
- Fixed an inherited low-contrast active tab and the role-hide button being covered by header content. Tool hit targets remain 44px; tooltips identify rules and signals.
- Fixed private-chat scroll restoration when the remounted log is below the viewport. Read marking still requires actual visible intersection; restoration alone does not mark messages read.
- Fixed WebKit inline vote deselection collapsing the mobile command unexpectedly. A one-update selection intent replaces browser-dependent focus inference. Initial collapse, explicit collapse, phase transitions and two-target night selection remain covered.
- Preserved oval seating at 1366x768 rather than switching every short desktop to a grid. Adjusted the background crop without stretching its aspect ratio. Removed obsolete unreachable seat-layout code.
- Removed unwashed gaps between the narrow stage header and seat area, a stray secondary-button shine and misaligned selected-target text. At 200% text the mobile view switch wraps whole controls instead of clipping or splitting its labels.

## Verification

- Focused Stage/Seat suite: 146 passing tests. Client/role/voting integration run: 154 passing tests; final dock/client regression pass: 92 passing tests. Private-chat suites: 31 passing tests. Counts overlap and are not a unique-test total.
- Chromium interaction/confidence suite: 114/118 initially passed; both private-reading failures were fixed and both short-desktop viewport assertions were corrected to explicitly scroll the control to the center. All four passed on recheck. The latter was a one-pixel browser scroll-into-view threshold, not a hidden control.
- Final 47 play gate/interaction cases passed. Environment cases passed across 14 phases and both families/themes: 20 passed in the combined run, then all eight desktop cases passed with the intentional short-oval crop contract updated. Resolution/upscale, image visibility, privacy, runtime and accessibility assertions remain enforced.
- Twenty-four vote-selection browser cases passed with retries disabled: eight each in Chromium, Firefox and WebKit. All four Firefox/WebKit private-reading cases passed after the restoration fix. Enlarged-text navigation passed in both themes.
- Production frontend E2E passed all 18 checks, including six real local browser players reaching voting and reconnecting in each family, invitation/auth flows and create-token retry. The first run had one landing auth-request 429; the complete repeat passed without disabling limits or altering auth. Temporary local QA PostgreSQL/Redis containers were stopped afterwards. This is not production-account verification.
- Final production build, workspace typecheck, regression contracts and dictionary checks passed. Dictionary has zero hard warnings and nine existing legacy notices. No visual or performance baseline was updated.

## Budget And Completion

- Current JavaScript corpus: 522.5 KiB; `/play/[code]`: 130.7 KiB. Both pass the unchanged absolute and growth limits. The first build in this pass exceeded route growth by 419 bytes; removing the unreachable layout branch resolved it. Before this active-play pass the measured route was about 131.2 KiB.
- Route CSS is about 64 KiB: above its 62 KiB warning, below its 70 KiB hard limit. Runtime art remains 74,993.2/75,000 KiB, about 6.8 KiB headroom. Existing large-card and metadata PNG warnings remain; no artwork was added or recompressed here.
- The historical budget failures above are retained as audit history, not the current result. Final `perf:budget` passes without relaxed limits.
- Dev remains running at `http://127.0.0.1:3000`. Representative scene: `/play/VISUAL?visualGame=1&family=werewolves&phase=voting&players=8&voteTally=full&timer=90`.

Final result: passed for the scoped implementation, visual review, interaction regressions and budget checks. Full release verification was not requested or claimed.

# Approved Epic Chronometer

Date: 2026-09-27. Scope: implement the approved timer, preserving the active
playroom and real countdown. No server/protocol changes, commits or deployment.

## Reference And Result

- Reference: `C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-c51bbda5-660c-4401-8706-27cc5f15990e.png`.
- New brass bezel, green enamel face, crescent and lower engraving follow the
  approved object. Digits and the segmented arc are live DOM/SVG, never baked
  into the image. The existing display typeface is retained.
- The large clock is 196px, with responsive 180/112/104/88px presentations.
  Its desktop center is slightly lower than the mock to keep player names and
  hit targets separate. Dense tables retain a header clock; phones put it above
  the seats. No room background was regenerated or rearranged.
- The sixty marks represent the final minute, not a fabricated fraction of the
  whole phase. The same authoritative deadline and existing countdown hook drive
  both digits and arc. Unlimited, urgent, expired and replaced deadlines remain
  covered. The conversation view keeps its compact plain timer.
- Personally reviewed the reference against `E:/codex-temp/chronometer-werewolves-dark-1487.png`,
  plus both themes/families on desktop and 320/390px. Twelve final captures are
  `E:/codex-temp/chronometer-{werewolves,mafia}-{dark,light}-{1487,390,320}.png`;
  the detail capture is `E:/codex-temp/chronometer-detail.png`.

## Delivery And Regression Fixes

- Built-in imagegen produced the isolated transparent master. Full provenance
  and prompt are in `assets/game-art-source/play/chronometer-brass-v1.md`.
- Final runtime is a 448px, Q82 WebP at 34,220 bytes, generated with the pinned
  Linux toolchain. AVIF-only delivery failed in Windows WebKit and was rejected.
  The direct small WebP also avoids introducing the Next image-loader chunk.
- Archived the unreferenced desktop Mafia v1 inlay and its master byte-for-byte
  under `assets/game-art-archive/play-before-chronometer/`. Active Mafia v2 and
  every retained image are unchanged. Paired-inlay coverage now uses current v2.
- Corrected clock/seat overlap at tall 1366px, short oval and dense defense
  layouts. Removed overridden legacy timer styles instead of adding another
  permanent layer of CSS. No screenshot or performance baseline was relaxed.

## Verification

- Focused Timer/countdown/Stage suite: 52 passing tests.
- Combined Chromium timer and existing play gate: 93 passing tests. After the
  final asset-format change, 56/57 timer cases passed; a 320px check ran during
  hot reload and failed page overflow. The unchanged scenario passed twice on
  the settled build. Coverage includes both families/themes, 320 through 1487px,
  landscape, 8/12/30 participants, enlarged text, keyboard selection, no overlap,
  runtime exceptions, deadline updates and scoped accessibility checks.
- Firefox/WebKit timer suite: all 12 passed after rejecting AVIF-only delivery.
  Final direct-WebP desktop/mobile decoding and geometry: all four passed again.
- Asset tooling suite: 62 passed; both changed asset tests passed again against
  the final WebP and current paired inlays. Real plate Q82 bytes reproduce exactly,
  source bytes stay unchanged, and obsolete AVIF output is removed by the recipe.
- Final production build/typecheck, regression contracts and dictionary passed.
  Dictionary retains nine legacy notices, zero hard warnings.
- Final budget passes unchanged limits: JS corpus 522.9 KiB, play JS 131.1 KiB
  (about +0.4 KiB from before this timer), play CSS 64 KiB. Runtime art is
  74,607.7/75,000 KiB, leaving about 392.3 KiB. Existing CSS/art/metadata warning
  levels remain, but no hard or growth limit fails.
- Dev remains available at `http://127.0.0.1:3000/play/VISUAL?visualGame=1&family=werewolves&phase=voting&players=8&voteTally=full&timer=90`.
  These are synthetic visual checks, not a claim of a new multiplayer or release
  acceptance run. No confirmed timer regression remains in the tested scope.

# Endgame Fidelity Follow-Up

Date: 2026-09-28. Scope: closer correspondence to the eight approved endgame
references, including independent Jester victory, without changing game rules.

## Reference Comparison

- Approved reference set remains the eight generated images documented in the
  Endgame Edition section and `assets/game-art-source/endgame/scene-backdrops-v1.md`.
- Primary comparison: `exec-e9d7110e-f65c-46fc-892f-189e9cc38d0f.png` and the actual
  `endgame-fidelity/werewolves-werewolves-jester-dark-1488.png`, both 1488x1058 at
  device scale 1. Both were opened together. All eight reference images were reviewed.
- Current captures live under
  `C:/Users/Administrator/.codex/visualizations/2026/05/27/019e6aa0-15f1-7f70-9b9c-957902364c79/endgame-fidelity/`.
  Representative light capture: `mafia-village-solo-light-1488.png`; mobile capture:
  `werewolves-werewolves-jester-dark-390.png`. `results.json` contains 64 final
  light/dark, solo/Jester, 390/1488 samples. `results-320-768.json` adds eight samples.
- Personally reviewed representative final captures of every outcome, plus
  Werewolves/Jester and Town/Jester at 320 and 768. Final screenshot exports hide
  only Next's development indicator, not application controls or content.
- Adjusted headline scale/position, action dimensions, scene height, portrait
  scale, laurel placement, and Jester composition. The daylight wash is localized
  behind text instead of flattening the entire artwork. Portrait frames are consistent.
- This is not a pixel-identical replacement of the illustrated demo: the existing
  navbar, real player avatars, server-authored result, participant count and role
  badges remain functional. Previously generated clean plates also retain the
  documented tabletop-object shifts that accommodate the optional Jester.
  Phones deliberately place readable actions above a short, unobstructed scene.

## Defects Fixed

- Enlarged text could be clipped by a rigid scene ratio. Scene height now grows
  with content; long headings/names and action labels wrap within their containers.
- Town's mobile daylight scene inherited a dark background with dark text.
  Corrected the responsive cascade and checked both themes.
- Laurels covered portrait detail. They now sit behind the portraits and outside
  the face area, with distinct team/personal victory labels retained.
- An intermediate CSS cleanup hid the Jester behind the mobile backdrop.
  Restored its stacking level; added regression coverage beyond image decoding.
- AVIF-only endgame delivery failed decoding in the installed Windows WebKit.
  Next 16.3.3 bypasses AVIF optimization, so an optimizer URL was not a solution.
  Replaced only these eight runtime files with native-size WebP from unchanged
  PNG masters. Q75, effort 6, fixed quality and a 230 KiB per-scene cap; no
  additional mobile variants or duplicated formats. Provenance records exact hashes.
- Explicit zero tab stops preserve natural keyboard order for the three finale
  links, including WebKit's default mode that skipped implicit link tab stops.
- Stabilized the existing mobile geometry test by waiting for hydrated heading
  focus and comparing artwork/actions from one connected render, not stale boxes.

## Verification

- Final fidelity suite: 24 Chromium, 24 Firefox and 24 WebKit cases passed with
  zero retries. Each covers eight scenes, both themes, 320/390/768/1488 widths,
  native image decoding, Jester stacking, 24/30-player rosters, 200% text, long
  names, keyboard focus/activation and family-correct navigation. No baseline updates.
- Six existing endgame environment/geometry/replay/repeat cases passed. The
  initially flaky mobile geometry case passed twice after the test correction.
- Screenshot/axe capture: all 64 final samples passed overflow/runtime checks;
  scoped WCAG 2 A/AA and 2.1 AA checks passed on the selected representative scenes.
  Eight additional 320/768 samples passed; final mobile Jester layers were reviewed.
- Five focused web test files: 243 tests passed, including terminal results,
  conclusion/fallback/story rendering, replay eligibility and repeat-game links.
- Nine focused asset-tooling tests passed: exact reproduction, native dimensions,
  immutable masters, transparent ornaments and preservation of existing files when
  export fails. All 98 existing sibling AVIF/WebP pairs also passed dimension checks.
- Final web typecheck, production build, 24 regression contracts and dictionary
  check passed. Dictionary retains nine legacy notices and zero hard warnings.
  Budget test harness: nine passed. Scoped diff whitespace check passed.
- Final production budget passes unchanged gates: JS corpus 525.6 KiB (previously
  525.4), play JS 131.4 KiB (same rounded size), play CSS 64.3 KiB (previously 64.2).
  An intermediate 273-byte CSS growth violation was removed through local cleanup,
  not increased limits. Runtime art is 74,953.8/75,000 KiB, up 207.7 KiB due to
  browser-compatible replacement encodings, leaving about 46.2 KiB. Existing
  warning-tier CSS/art/metadata entries remain. No budget baseline was changed.

The earlier disk-space blocker was resolved by the separately authorized cleanup
before this pass. This pass did not delete additional caches or alter Next config.
Dev remains at `http://127.0.0.1:3000`; use `/play/VISUAL?visualGame=1&phase=game_over&family=werewolves&winner=werewolves&players=6&jesterWin=1`.
These synthetic checks do not establish a new production-login, database,
multiplayer or full release acceptance result. No commit, push or deploy.
