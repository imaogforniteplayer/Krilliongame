# DEEPER

**Answer rare. Dig deep.** DEEPER is a daily pixel-art trivia game. You get a question with many valid
answers and type one. The more unusual your correct answer, the bigger the machine your miner pulls out,
and the deeper the dig goes. **You only type. DEEPER does the digging.** There is no manual mining anywhere.

The game is inspired by the rare-answer idea and retro look of Krillion, but all art, code, UI and sound here
are original.

## Status

Runs fully in the browser in **local demo mode** (no account, no server). Progress is saved in `localStorage`.

| Area | State |
| --- | --- |
| Daily Dig (7 questions, 25 s each, one ranked attempt/day), Endless Dig, Practice | Working |
| Answer validation (aliases, plurals, spelling tolerance, exclusions, unknown-answer queue) | Working |
| Rarity (6 tiers, smoothed, "estimated" vs "observed" kept separate) and scoring (configurable, versioned) | Working |
| Six automatic equipment animations, 15 biomes, depth ruler, camera shake, particles, discoveries | Working |
| Synthesised sound effects and ambient music (Web Audio, no audio files) | Working |
| Results screen with explanations, shareable pixel card (PNG) and spoiler-free share text | Working |
| Museum (34 discoveries), biome map, stats, streaks, XP/levels, settings, reduced motion | Working |
| 110 curated questions across 11 categories, 12 themed Dig packs | Working |
| Local admin view (review queue, question browser, rules) | Working, read-only, no auth |
| Survival Dig (3 lives, questions get harder), themed packs, Friend Challenge by shareable code | Working. Challenge results are swapped by hand and are **not server-verified** |
| Garage (41 cosmetics, 7 pets, backpacks, trail effects, emotes), live preview, animated pets that follow the miner | Working. Cosmetics never affect scoring |
| 22 achievements with wearable titles, weekly missions, daily mystery reward, Daily Dig calendar, personal base | Working |
| Installable PWA with offline play (manifest, service worker, icons) | Working in production builds |
| Leaderboards (global, weekly, friends), Live Dig Duel, Squad Expedition, Community Excavation, accounts and sync, real-player rarity, admin editing | **Not built.** Needs the backend (`docs/BACKEND.md`). The UI says so and shows no fake players |
| Account page: Google sign-in, email sign-up / sign-in / password reset, cloud backup and restore | Built, **needs your Supabase and Google credentials** (`docs/AUTH.md`). Tested only against a stand-in server, never a live project. Shows "not connected" until configured |
| Seasonal events, limited-time biomes | Not built |

See `GAME_DESIGN.md` for how the rules work.

## Run it

Requires Node 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 130 unit tests (Node built-in runner via tsx)
npm run typecheck
npm run build      # outputs dist/
npm run preview    # serve the production build
```

## Deploy

It is a static site, so any static host works. For GitHub Pages, the included workflow
(`.github/workflows/deploy.yml`) builds and deploys on every push to `main`: in the repository go to
**Settings, Pages, Source: GitHub Actions**. The app uses hash routing, so no server rewrites are needed.
For a manual build on a project site, run `VITE_BASE=/your-repo-name/ npm run build`.

## Managing questions

Questions live in `src/game/questions/bank/*.ts` and are written with `defineQuestion`:

```ts
defineQuestion({
  id: 'animals-long-lived',
  text: 'Name an animal that can live for over 100 years.',
  category: 'Animals',
  difficulty: 'medium',
  packs: ['animals'],
  answers: ['Giant tortoise|4|galapagos tortoise;aldabra tortoise', 'Bowhead whale|2|'],  // name|commonness 1-6|aliases;...
  exclusions: ['house cat|Cats rarely reach 30.'],
  explanation: '...',
  verification: 'Source and any caveats.',
})
```

`commonness` (6 = most players say it, 1 = almost nobody) sets the starting rarity estimate. Add a new
bank file to `src/game/questions/index.ts`. `npm test` fails if two answers collide, a question has too
few answers, or the rarity range is too narrow. Unknown answers typed by players are queued (Admin page)
and score 0 until a human adds them.

## Rules in one place

All competitive numbers are in `src/game/config.ts` (points per tier, metres per point, thresholds,
timer, spelling tolerance). Bump `scoringVersion` / `rarityVersion` when you change them: every saved run
records the versions it was scored with.

## Backend (Supabase), not connected yet

`.env.example` and `supabase/migrations/0001_init.sql` are a starting point. The migration is a **draft that
has not been applied or tested**. `docs/BACKEND.md` lists what must be built before any online feature is
switched on. Never put a service-role key in browser code.

## Tech notes and deliberate deviations

- **React + TypeScript + Vite.** The game scene is a small custom **Canvas 2D** renderer
  (`src/game/render/`) with integer-scaled, nearest-neighbour drawing, rather than Phaser 3. All sprites,
  tiles and the pixel font are original and generated in code (`src/game/pixel/`), so there are no image
  files to license. Moving the renderer into Phaser later is possible: the UI only talks to
  `DigRenderer.play()`, `react()`, `walkIn()` and a few hooks.
- **Plain CSS** (`src/styles/app.css`) instead of Tailwind, because the pixel-border look is mostly custom.
- Game logic (`src/game/**` outside `render`, `pixel`, `audio`) is pure and has no browser dependencies, so it can
  run unchanged in a server function.

## Layout

```
src/game/            pure rules: questions, answerValidation, rarity, scoring, daily, session, storage
src/game/render/     Canvas renderer, miner and machines, pets, trail effects, particles
src/game/cosmetics/  cosmetic catalogue, unlock rules, mystery rewards
src/game/progression/ achievements, weekly missions, run finalisation
src/game/challenge/  Friend Challenge codes and result codes
src/game/base/       personal base rooms and themes
src/auth/            Supabase Auth client over plain fetch (no SDK)
src/game/pixel/      sprites, terrain tiles, pixel font
src/game/audio/      Web Audio sound engine
src/ui/              React app: pages, components, store, router, share card
supabase/ docs/      backend draft and notes
```
