# Archived lobby invitation artwork

The unused `legal/lobby-banner` artwork is preserved here to fund the dedicated
Werewolf invitation cleanplates without discarding the original or its delivery
encodings. These are byte-preserving moves, not re-encodings.

All source and destination absolute paths were checked to remain beneath
`E:/werewolf_mafia/`, with no reparse-point ancestors. This archive is outside
both `assets/game-art-source/` and `apps/web/public/`.

| Original repository path | Archive-relative path | Bytes | Dimensions |
| --- | --- | ---: | --- |
| `assets/game-art-source/legal/lobby-banner.png` | `source/legal/lobby-banner.png` | 3732529 | 1920 x 1080 |
| `apps/web/public/game-art/legal/lobby-banner.webp` | `runtime/legal/lobby-banner.webp` | 216086 | 1920 x 1080 |
| `apps/web/public/game-art/legal/lobby-banner.avif` | `runtime/legal/lobby-banner.avif` | 160987 | 1920 x 1080 |

SHA-256, verified before and after each move:

```text
source/legal/lobby-banner.png
eda120e4d59348fa92e055327599b601daeba13a58037255571b77d7f16271f6

runtime/legal/lobby-banner.webp
92a86919492ff690f2c5da6f534769e8eaf12528943e58ce113c4007a48ec01b

runtime/legal/lobby-banner.avif
d11c8b797f5d2f99af2b532425c09c9e59d031d7e34af2b9b2dd00963a0f5f74
```

## Retirement evidence and contracts

- No current runtime reference to `lobby-banner` was found in application
  metadata, components, styles, dynamic artwork mappings or service-worker
  precaching. Historical documentation is not an active consumer.
- `/lobby/[code]` has no page-specific social image and inherits the root
  `og/og-home.png` metadata. The public `legal/lobby-banner.png` was already absent.
- The source master must leave the active source tree along with its derivatives:
  otherwise the recursive optimizer recreates them and regression requires the
  source's WebP. No generator exception or pairing-gate change is needed.
- The retired runtime pair totals 377073 bytes (368.2353515625 KiB). The master
  was already outside the runtime corpus; its size is not additional savings.
- This directory is outside the runtime corpus and active optimizer discovery.
  The current root `.dockerignore` does not exclude `assets/game-art-archive`;
  exclusion from Docker build context is not claimed.

Replacement master provenance is recorded in
`assets/game-art-source/invitation/README.md`. Retain every archived file unchanged.
