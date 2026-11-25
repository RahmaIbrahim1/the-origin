# Assets & licences

| File | Source | Author | Licence |
|---|---|---|---|
| `public/assets/models/bean.glb` | [“Coffee beans” on Sketchfab](https://sketchfab.com/3d-models/coffee-beans-8146e99925fb4b49839e4fa7ace83f0f), fetched from the [Objaverse](https://huggingface.co/datasets/allenai/objaverse) mirror | kouitimizuno (photogrammetry scan) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — credit required |
| `public/assets/models/bean-lod.glb` | Same scan, simplified to 2.2k triangles | kouitimizuno | CC BY 4.0 |
| `public/assets/textures/bark-normal.webp`, `bark-arm.webp` | [Poly Haven — Bark Brown 02](https://polyhaven.com/a/bark_brown_02) | Poly Haven | CC0 |
| `public/assets/textures/rock-normal.webp` | [Poly Haven — Cliff Side](https://polyhaven.com/a/cliff_side) | Poly Haven | CC0 |
| `public/assets/fonts/italiana.woff2` | Google Fonts via Fontsource | Santiago Orozco | SIL OFL 1.1 |
| `public/assets/fonts/instrument-sans.woff2` | Google Fonts via Fontsource | Instrument | SIL OFL 1.1 |

Changes to the bean: transform baked, recentred, long axis scaled to 2 units, tangents and the
second UV set removed, textures re-encoded to WebP. Its fragments are cut from this mesh at load time.

Made in code, no external file: canyon and lips, fibre arches, shards, fracture map, particles and grounds,
liquid funnel, ribbons and pool, smoke, the coffee pouch and its printed label, the studio
reflection environment, and all sound (synthesised with Web Audio).
