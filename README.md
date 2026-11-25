# The Origin

A scroll-driven WebGL film in six scenes. Vite, Three.js, GSAP ScrollTrigger, no framework.

    npm install
    npm run dev
    npm run build && npm run preview

- `src/timeline.js` is the master timeline: every value is placed on a 0–100 ruler, so the film reverses exactly.
- `src/scenes/` holds the six scenes. They live in four connected spaces (`src/scene.js`); scene 03 heats scene 02's world and scene 05 grows out of scene 04's.
- `src/state.js` is the only thing scenes read. Only the timeline writes to it.
- `src/config.js`: set `SHOP_URL` to make SHOP NOW a live link.
- `?q=low|medium|high` forces a quality tier.
- Asset sources and licences are in `ASSETS.md`. The bean scan is CC BY 4.0 and must be credited.
