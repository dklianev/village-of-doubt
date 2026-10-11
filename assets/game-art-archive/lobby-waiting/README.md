# Archived unused waiting-room artwork

Only the two `empty-lobby` masters and their six runtime derivatives were moved.
Every source and destination was resolved beneath `E:/werewolf_mafia/`, checked
for reparse-point ancestors and destination collisions, and checked against its
expected byte length before moving. SHA-256 matched before and after each move.
No re-encoding took place. Preserve these files unchanged.

| Original repository path | Archive-relative path | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| assets/game-art-source/empty-lobby.png | source/empty-lobby.png | 2457624 | c55d14570e6cdab9acef7d9d93f073e9349542dd85a6c461c5efb6fe8c56ef0c |
| assets/game-art-source/mafia/empty-lobby.png | source/mafia/empty-lobby.png | 2352773 | ae403e1ac179d5b405d821a506f725b64b7ba79115bcd634a94b8eacf5501a0b |
| apps/web/public/game-art/empty-lobby.webp | runtime/empty-lobby.webp | 209398 | 285b52e36d2abdbd33e51e8817f6a73fa1a4e3c6b5be23dc1da0911981a9e3de |
| apps/web/public/game-art/empty-lobby.avif | runtime/empty-lobby.avif | 151860 | 6f08815f409c0298530b2cd850c51acde84a9620f0598dd153b392140127f3ac |
| apps/web/public/game-art/mobile/empty-lobby.webp | runtime/mobile/empty-lobby.webp | 113502 | b8b2ecc265fa311e8dee0e1a017ee6ecd93c9de3f31833ef4cbfc1ed82c9648a |
| apps/web/public/game-art/mafia/empty-lobby.webp | runtime/mafia/empty-lobby.webp | 165754 | 0f0fcefa9cbed62cc1ce823c3d9c21e34b50d1f4399399f07a339efa7f2fd298 |
| apps/web/public/game-art/mafia/empty-lobby.avif | runtime/mafia/empty-lobby.avif | 127275 | e9ac8bd41bc743c0598d75270290d34a555299a0864b7aa0b99172938caa04ec |
| apps/web/public/game-art/mobile/mafia/empty-lobby.webp | runtime/mobile/mafia/empty-lobby.webp | 77276 | e2334e345d2c7f39eae5ef7b1514b013d384cccb89d0d9bd51755266c5ba9d49 |

Masters and desktop derivatives are 1254 x 1254; mobile WebPs are 960 x 960.
Only runtime derivatives count as savings: 845065 bytes (825.2587890625 KiB).
This archive is outside active optimizer discovery and the public runtime corpus.

## Usage evidence

Before removal, the only implementation references to `empty-lobby` were four
unused `--empty-lobby` declarations in `apps/web/app/globals.css`. No variable
consumer, dynamic empty-art mapping, metadata reference or service-worker
precache entry was found. `PlayStage.tsx` renders its empty state as text.
Those four declarations were removed along with the assets. Keeping the source
masters in the active source tree would recreate the retired outputs.

Shared tavern backgrounds, phase icons, play backgrounds, inlays and existing
archives were not changed. Replacement provenance and encoding status live in
`assets/game-art-source/lobby/README.md`.
