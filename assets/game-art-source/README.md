# Original Artwork

These files are editing masters, not browser downloads. Preserve their native
resolution and full color. Do not palette-quantize, resize, or overwrite them
to meet a runtime transfer budget.

`pnpm optimize:assets` reads these masters and writes delivery derivatives to
`apps/web/public/game-art`. `pnpm optimize:phase-rail` generates the smaller
phase-board and phase-rail images. Windows generation uses the pinned Linux
container so CI can reproduce the outputs.

Review resolution, compression, crop, and device pixel ratio on the actual
page. A larger requested Next Image width does not guarantee that the source
contains that many pixels. Large role cards must not use thumbnail sources.

This directory is excluded from the production Docker context. Source file
size is not a runtime image budget. Store any intentional creative revision
as a new original and review it independently from delivery optimization.
