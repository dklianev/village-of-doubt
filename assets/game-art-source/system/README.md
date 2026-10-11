# System-state artwork

These two synthetic scenes were generated with the built-in imagegen tool for
Senkite's recovery states. They do not represent real players or rooms.

- `missing-page-v1.png`: an illuminated inn doorway, an empty place at a wooden
  table, a brass lamp, and a glimpse of the village. Quiet green plaster on the
  left leaves room for the 404 message without a floating text card.
- `offline-lantern-v1.png`: a lantern on a village doorway at blue hour, stone
  lanes, distant houses and forest. The lit doorway is the focal point on mobile.

Masters are 1536x1024 PNG. Runtime files are optimized WebP under
`apps/web/public/game-art/system/`. Regenerate them through the existing asset
optimizer, not by placing source PNG files in the public directory:

```sh
node scripts/optimize-assets.mjs --only system/missing-page-v1.png --only system/offline-lantern-v1.png
```

Both themes use the same scenes. CSS provides readable surfaces when art is
unavailable and shortens the art on low-height phones to keep recovery visible.
The offline WebP is loaded directly and precached by the service worker; it must
not require a working image optimization endpoint.
