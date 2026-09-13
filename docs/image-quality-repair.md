# Image Quality Repair

## Root Causes

- The asset optimizer resized and palette-quantized PNG masters in place to
  satisfy a source-size limit. Every subsequent export began with degraded
  artwork rather than the original.
- The roles catalog used 520px thumbnails for both grid cards and the large
  detail view. Next Image could request a larger width but could not recover
  missing source pixels.
- Mobile landscape backgrounds were stretched over the full height of long
  create forms. Their crop and magnification depended on the amount of text.
- Homepage illustrations and phase boards lacked suitably dense candidates.

## Recovery

The existing compositions were preserved. 172 masters were recovered from
matching Git blobs, primarily from the parent of `3b97e1ea`, before destructive
optimization was introduced. Another 61 were recovered from their matching
generated originals. The dark invitation was recovered using its documented
1536x512 crop at `(0, 280)`, without palette conversion.

One additional portrait, `mobile/werewolf/bg-hero-v3.png`, previously existed
only as runtime WebP/AVIF files. Its matching 1086x1448 original was recovered
from the generation archive and added to the source set, so this hero now
participates in reproducible generation too.

Each candidate was compared with the current artwork before replacement.
The largest mean RGB difference after normalizing both versions to 64x64 was
0.00692 on a 0-1 scale. This is a composition check, not a perceptual quality
score. Dimensions, palette metadata, original file paths and before/after
SHA-256 digests were recorded separately. The pre-repair masters remain
backed up outside the repository.

The two light mobile family heroes had no recoverable clean original in Git
or the available generation archive. Their restoration is documented in
`image-quality-mobile-restoration.md`; it is a separate image edit, not claimed
as lossless recovery. The existing clean logo and composited mobile landing
master were retained.

## Delivery Contract

- Source masters are immutable inputs and excluded from the production Docker
  context. Their storage size is not a browser-transfer budget.
- Export resolution never exceeds the source. Runtime size limits cannot
  silently shrink dimensions or lower WebP quality below the quality floor.
- Metadata PNGs are separate bounded derivatives, not resized source masters.
  Social-preview PNGs have a 500 KiB hard cap and a 450 KiB warning. The
  existing 400 KiB hard cap for optimized WebP/AVIF interface art is unchanged.
- Roles use full-resolution sources with responsive Next Image delivery.
  Small avatar and seat imagery can still use thumbnails.
- Homepage theme images use density-aware candidates and load only the
  selected theme. The existing visible scene and layout are retained.
- Phase boards have 560x400 and 1120x800 variants with identical central crop;
  small phase-rail icons remain 128x128. Boards use WebP quality 74, with
  measured transfer caps of 56 and 180 KiB respectively.
- Create and catalog backdrops use viewport-bounded geometry and full-quality
  sources where a portrait crop needs the extra pixels.

The corrected runtime corpus measures about 65,000 KiB, versus roughly
44,324 KiB before restoration. Its warning/hard limits were deliberately
revised to 70,000/75,000 KiB. This is a deployment-storage guard across all
routes and variants, not a claim about first-load bandwidth. Responsive
delivery and the unchanged individual interface-image cap remain essential.

The measured production build declares 78.2 KiB JS for `/create` and 40.4 KiB
for `/werewolf/rules`, versus their older 69.4/34.1 KiB baselines. Both now
include the shared Next Image client chunk (12.9 KiB including its other
shared code). The create measurement also includes the pre-existing create
changes in the working tree; not all of its delta is attributed to this repair.
The two route baselines explicitly acknowledge the measured current build.
Their 3 KiB delta guards and 95/42 KiB hard caps are unchanged. No animation,
image-processing, or other runtime dependency was added. Total JS is 543.3 KiB.

## Verification

Asset verification regenerates delivery files in the canonical Linux
environment and rejects source mutations or non-reproducible outputs.
Browser checks fetch and decode the actual selected image, comparing its
physical pixel dimensions with the rendered size and device pixel ratio.
Checking only `naturalWidth` or the Next Image `w` parameter is insufficient.

Evidence and recovery manifests for this repair are stored at
`E:/codex-temp/image-quality-repair-2026-09-08/`.

### Verified Locally

- All 239 source PNGs are non-palette masters, 575.82 MiB in total.
- Full native Windows regeneration reproduced all runtime outputs and kept
  every source byte unchanged. Final runtime corpus: 513 files, 65,622.4 KiB.
- 42 asset-generation and verification tests passed, including failed-budget
  preservation, immutability, density limits and phase-board detail.
- 78 browser density scenarios passed across 390/640/820/1080/1920px where
  applicable, both themes and DPR 1/2/3. These exercise catalog dossiers,
  phase selection, homepage navigation and hidden-theme request suppression.
- 62 backdrop scenarios passed, plus 13 geometry/accessibility checks and
  two homepage visibility tests covering 11 responsive widths per theme.
  The tutorial test waits for the selected background request to finish;
  reading resource timing immediately after changing scenes was a test race.
- 12 existing visual snapshots passed for family homepages, Werewolf roles
  and rules, including mobile and themed variants. No baseline was changed
  to make these comparisons pass.
- Homepage/create snapshot review covered 16 additional cases. Thirteen
  passed unchanged. The three dark desktop create baselines were updated
  after reviewing their diffs: the changed peripheral backdrop is the
  intended viewport-bounded background; controls and content geometry stay
  unchanged. The broader, unrelated snapshot suite was not rerun.
- Web tests: 882 assertions passed, four skipped. The full run had one
  browser cleanup-hook timeout under concurrent load; that suite passed all
  four tests when rerun alone. No production change was made for the timeout.
- Root typecheck, production build, regression contracts and performance
  budgets passed. Existing warning thresholds remain visible.

### Remaining Environment Gate

The final canonical Linux regeneration has not run after the metadata PNG
and critical-mobile finishing step. Docker Desktop fails to start because
its stale `sailor-ingest.sock` cannot be accessed, and the available Ubuntu
WSL registration points to a missing `ext4.vhdx`. No Docker data, WSL disk,
or user data was deleted or reset. The native Windows result above is not
presented as a Linux result. Run `pnpm verify:assets` once Docker is healthy.
The pinned Linux command and fail-closed CI policy remain unchanged.
