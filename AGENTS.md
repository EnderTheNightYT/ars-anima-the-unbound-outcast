<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- Shared pickup gestures live in `src/game/pickup-animation.ts`, separate from class effects; `portal-marker.ts` draws map symbols using global CSS tokens. Why: all classes and cameras share presentation without changing combat or portal access.
- AI, cloud-sync and backend rules live in `src/lib/AGENTS.md`; online multiplayer rules in `src/game/net/AGENTS.md`.
- Personal lifetime statistics live in browser-safe statistics.ts, keyed by run and weapon instance; cloud.ts merges these records before snapshot writes and restores. Why: resumed runs and repeated pickups must not duplicate totals, and counters survive account backup.
- Weapon damage examples use weapon-guide.ts with the live weapon and combo tables and explicit neutral-hit assumptions. Why: wiki damage stays tied to playable weapon rules without promising exact encounter outcomes.
- The game simulation and first-person raycaster remain in src/game/engine.ts; sprite-world.ts uses Three.js for non-first-person world geometry and the supplied sprite atlas, called by the existing GameView frame loop. Why: volumetric cameras reuse live rules, controls and assets without a second simulation.
- Route `/` uses `ssr: false` (game touches window/canvas); dev hook `window.__game` exposes the live Game.
- Subdirectories have their own `AGENTS.md`; read it before changing files there.
- Difficulty presets and dynamic challenge adaptation live in browser-safe `difficulty.ts` (tested in `difficulty.test.ts`); engine reads `chal` multipliers. Why: one tested place for challenge scaling.
- Startup and zone streaming live in `asset-loader.ts`: GameView shows the boot screen until required textures are downloaded, decoded and validated; region walls stream by `zonePlan` (active + neighbours, far zones released). Why: no incomplete scene on start and fewer hitches when changing zones.
- Light theme and RGB mode are classes on `<html>` (`theme-light`, `rgb-mode`) set by `DisplayToggles.tsx` and stored in localStorage. Why: purely presentational, no rule changes.
- Weapon forge variants live in browser-safe `weapon-forge.ts`: makeWeapon clones the base table entry and applies at most one variant, never mutating `WEAPONS`. Why: shared tables stay stable for wiki/balance while drops get thousands of combinations.
- Fullscreen helpers live in `fullscreen.ts`; GameView enters fullscreen on the first switch to play and re-requests pointer lock on every return to play. Why: browsers require a recent user gesture, which the start/close click provides.
- Per-floor rankings (`floorRankings` in cloud-save.ts) and profile summary are pure and tested in rankings.test.ts; `watchRuns` subscribes to realtime inserts on `runs`. Multiplayer standings (`mpStandings`) read `mp_profiles`, written only by `mp_record_match` via the room server. Found weapons/inscriptions persist in browser-safe `armory.ts` (`ars_anima_armory_v1`, synced via cloud). Why: live boards without polling, profile works offline.
- English UI uses `AutoTranslate` (DOM text swap from the dictionary `i18n-en.json`, rules in `auto-translate.ts`) around menus/overlays, not the live HUD. Why: hundreds of Spanish strings live inline in JSX; one dictionary translates them without rewriting every panel.
- Chronicle persistence is throttled for frequent combat events and caps live/stored events (`STORED_EVENTS`, `LIVE_EVENTS` in chronicles.ts); totals stay in `stats`. Why: writing the full archive on every hit grew memory without bound and froze long runs.
- `playthrough-floor1.test.ts` plays floor 1 with real inputs only (no teleports or stat edits) up to the portal and floor 2. Why: guards the full expedition loop end to end.
- Non-first-person cameras move the player along `Game.viewBasis` (screen forward/right written by sprite-world.ts each frame); first person keeps aim-relative movement. Why: stick/keys must match what the player sees.
- WorldEffects sanitizes NaN/Inf before bloom. Why: one bad pixel blacked out the whole alternate-camera frame.
- 3D view point lights never toggle visible (unused = intensity 0); the 3D view falls back to the 2D renderer on WebGL context loss. Why: changing the light count recompiles every shader, causing combat freezes on PC.
- Starting gear uses `starterStats` (weapon-forge.ts, tested in starter-gear.test.ts): class weapon type, rarity 0, no variant/inscriptions, stats rolled from the base. Why: runs start low-level but not identical.
- Live enemy limits live in browser-safe `enemy-cap.ts` (tested), enforced in `Game.spawn` for everything except the boss. Why: keeps screens from saturating without touching event logic.
- Custom gamepad bindings live in browser-safe `pad-mapping.ts` (`ars_anima_padmap_v1`, tested); GameView reads `loadPadMap()`, AI proposals are validated by `validateProposal` (one action per button, Start/Select fixed). Why: no button ever does two things.
- This project was imported from an earlier Lovable project; schema changes go through the Cloud migration tool (files in `drizzle/migrations/`) and media goes through `lovable-assets` pointers owned by this project. Why: old asset pointers and database belonged to the previous project.
- In the 3D view, actor billboards (player, remotes, enemies) use an unlit `MeshBasicMaterial` pool (`figureBoards`) and the first-person composite mixes lighting into sprites at 30 %. Why: lights, shadows, occlusion and reflections blurred pixel-art figures.
- Enemy dodge visuals come from `evadeMotion`/`evadeStyle` (combat-fx.ts, tested); engine stores `evadeMax`/`evadeStyle` when `updateEvade` fires and both renderers read `enemyEvadeOffset`. Why: the animation stays synced with the AI timer without moving hitboxes.
