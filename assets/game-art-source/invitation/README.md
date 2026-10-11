# Werewolf invitation threshold, v1

Clean background plates for the Werewolf `/lobby/[code]` invitation redesign.
The interface remains HTML/CSS, not baked into the artwork. Both PNG masters
are 1487 x 1058, full-color sRGB RGB, copied byte-for-byte from native ImageGen
outputs. Preserve their original dimensions and bytes.

## Provenance

The approved UI reference and generated plates were supplied by the owning
redesign task in this local ImageGen output directory:

`C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/`

| Purpose | ImageGen file | Preserved master | Bytes |
| --- | --- | --- | ---: |
| Approved UI reference, not a runtime asset | `exec-86e25acc-e0a4-4aea-8553-f4c15037e7e3.png` | Not copied into optimizer inputs | 2201485 |
| Dark cleanplate | `exec-7c8f556b-0195-42de-bf55-576acabed727.png` | `werewolf-threshold-v1-dark.png` | 2381771 |
| Light cleanplate | `exec-ff4ed4e2-9ef0-4f59-99ba-ac52bba4d7e4.png` | `werewolf-threshold-v1-light.png` | 2892364 |

SHA-256 of the supplied reference and unchanged master copies:

```text
reference  fc7dd88a7023b921e387c74891dcfed56da1f6e289bfbe49423dcb7e1a49aeda
dark       0c02346a0f90ec60feb0250eff7960f8f0f9b00df24489cf9b3cba5e5e798c99
light      0ee4b5dead57bbe2bd0876f05df4059626c68ef169a94dd511a0c38aae5ed3d6
```

### Prompt summaries, not verbatim prompts

- Dark: native ImageGen edit of the approved UI reference to remove only the
  interface, including navigation, typography, room details, buttons and footer.
  Preserve the room composition, left-hand plaster wall, timber framing,
  mountain-village window, table, chairs, textiles and candlelit atmosphere.
- Light: native ImageGen lighting/plaster edit of the cleanplate, retaining the
  same room and composition. Change the lighting to a brighter daytime treatment
  and the left-hand plaster to pale sage. Do not introduce interface elements.

These are summaries of the supplied generation history and intent, not a claim
that a generative edit leaves every background pixel identical. No new image
generation or creative image editing was performed during asset integration.

## Delivery contract

- Runtime files are `apps/web/public/game-art/invitation/` followed by each
  master basename with `.webp` instead of `.png`.
- WebP only: the existing optimizer classifies these exact non-`bg-` filenames
  without AVIF, mobile, thumbnail or public PNG derivatives.
- The exact two source paths have a 300 KiB WebP delivery budget. Use the existing
  default quality loop, Q82 -> Q78 -> Q74 -> Q70, selecting the first encoding
  that fits, with effort 6 and smart subsampling unchanged. The Q70 floor remains
  enforced. The native 1487 x 1058 dimensions are below the unchanged 1920px cap;
  do not upscale or shrink them.
- Use the canonical Linux environment from `scripts/run-asset-generators.mjs`
  and the root package's pinned Sharp version. Do not run unrelated generators.
- Run the scoped optimizer twice and compare the two WebP byte hashes, while
  checking that both master hashes remain those recorded above.

Scoped command, from the repository root in that environment:

```sh
node scripts/optimize-assets.mjs \
  --only invitation/werewolf-threshold-v1-dark.png \
  --only invitation/werewolf-threshold-v1-light.png
```

The CLI's `--only` options belong to `optimize-assets.mjs`; the broader asset
runner does not forward them. Do not use an unscoped runner invocation for this
delivery. When the runner copies the script into `/asset-tool`, use that copied
script with the same two `--only` arguments and the repository as working directory.

## Budget provenance

The unused `legal/lobby-banner` master and both previous runtime derivatives
are preserved, not discarded, in `assets/game-art-archive/lobby/`. See that
directory's README for original paths, archive paths and all three byte hashes.
The two retired derivatives free 377073 bytes (368.2353515625 KiB) from the
runtime corpus. Archives are outside public delivery and optimizer discovery.
No release gate, quality floor or expected digest was relaxed. The final scoped
recipe tightens only the two new source paths' per-file WebP budget.

## Initial Q82 delivery and overage history

Two successful scoped canonical optimizer runs produced byte-identical WebPs.
Both source hashes and all three archived hashes stayed unchanged. The canonical
container was `node:24.20.0-bookworm` pinned by
`sha256:be23f54a88d34e8824c741b19b91064094f92c1c97b194144bfc8b50d67258e2`,
with Sharp 0.35.4. The repository bind mount was read-only, with only
`apps/web/public/game-art/invitation/` writable.

| Runtime file | Bytes | KiB | Dimensions |
| --- | ---: | ---: | --- |
| `werewolf-threshold-v1-dark.webp` | 205568 | 200.75 | 1487 x 1058 |
| `werewolf-threshold-v1-light.webp` | 319268 | 311.78515625 | 1487 x 1058 |
| Combined | 524836 | 512.53515625 | |

```text
werewolf-threshold-v1-dark.webp
a918eef48fee1d4b3057f5a735526189332cc474e8204aed22a18c90022af307

werewolf-threshold-v1-light.webp
a7a3a3efa34eb782302684cee462b9e804eb2f2a82a3054c70f07aefb494c4b0
```

Both files decode as WebP at native dimensions and match the unchanged Q82,
effort 6, `smartSubsample: true` encoding. The reference, source plates and
delivered WebPs were visually inspected: no baked interface remains, the
composition is retained, and the light plate preserves the room with brighter
lighting and pale-sage plaster. No AVIF, mobile, thumbnail or public PNG was
generated. One intervening repeat attempt hit a Windows file lock held by the
metadata reader; the successful retry used buffer-based reads to avoid it.

Measured art corpus at integration:

| Measurement | Bytes | KiB |
| --- | ---: | ---: |
| Before retirement | 76661569 | 74864.8134765625 |
| Archived runtime pair | -377073 | -368.2353515625 |
| New runtime pair | 524836 | 512.53515625 |
| Result | 76809332 | 75009.11328125 |
| Unchanged hard limit | 76800000 | 75000 |
| Overage | 9332 | 9.11328125 |

The initial runtime corpus budget did not pass. The earlier estimate
of 194726 bytes dark and 301476 bytes light was reproduced exactly in memory
only when `smartSubsample` was false. That is not the canonical optimizer's
setting; those alternative encodings were not written, and no setting was
changed during that initial delivery. The 9332-byte overage is retained here
as history; the approved resolution below changes only the new plates' budget.

## Final bounded delivery

The narrowly keyed recipe in `scripts/optimize-assets.mjs` sets 300 KiB for
`invitation/werewolf-threshold-v1-dark.png` and
`invitation/werewolf-threshold-v1-light.png`. Other paths, versions and families
retain their existing rules. The normal Q82 -> Q78 -> Q74 -> Q70 loop keeps dark
at Q82 and selects Q78 for light, with no dimension, format or quality-floor
change. No unrelated artwork was archived or regenerated.

Two further scoped canonical runs produced identical output hashes using the
same pinned Linux container and Sharp version as the initial delivery. Master
hashes and all archived bytes remained unchanged. Before/after inventories
confirmed that every runtime file outside this pair was byte-identical and that
the corpus gate script was unchanged. Buffer-based metadata inspection confirmed
both native dimensions and WebP formats. The updated light WebP was visually
inspected against the cleanplate; the composition, pale-sage plaster, mountain
view and table details remain intact. Dark is byte-identical to its inspected
initial delivery.

| Runtime file | Quality | Bytes | KiB | Dimensions |
| --- | ---: | ---: | ---: | --- |
| `werewolf-threshold-v1-dark.webp` | 82 | 205568 | 200.75 | 1487 x 1058 |
| `werewolf-threshold-v1-light.webp` | 78 | 268692 | 262.39453125 | 1487 x 1058 |
| Combined | | 474260 | 463.14453125 | |

Final runtime SHA-256:

```text
werewolf-threshold-v1-dark.webp
a918eef48fee1d4b3057f5a735526189332cc474e8204aed22a18c90022af307

werewolf-threshold-v1-light.webp
3f63afc636dcdd7b99b85bd56872483c8ade19db1e292b3d00359ae9c4069341
```

| Final measurement | Bytes | KiB |
| --- | ---: | ---: |
| Savings from initial Q82 pair | 50576 | 49.390625 |
| Runtime corpus, 568 files | 76758756 | 74959.72265625 |
| Unchanged hard limit | 76800000 | 75000 |
| Remaining headroom | 41244 | 40.27734375 |

Focused verification passed all five selected tests: exact-path recipe coverage,
two-pass reproduction from immutable masters with no extra formats, and the
existing quality-floor and impossible-budget safeguards.

```sh
node --test --test-name-pattern='invitation threshold|quality overrides|an impossible delivery budget|encodes at the quality floor' scripts/optimize-assets.test.mjs
```

Page integration/browser QA and fresh-build release checks remain with the
owning redesign task. No full asset or release pipeline was run here.
