// @ts-nocheck
import { LEGIBILITY } from "./sprite-legibility";
import { drawPortalMarker, portalPalette } from './portal-marker';
import { drawPickup } from './pickup-animation';
import { BeatCue } from "./BeatCue";
import bellMusic from "@/assets/the-bell-that-never-rings-floor-one.mp3.asset.json";
import { useEffect, useRef, useState } from "react";
import { ForgePanel } from './ForgePanel';
import { subclasses } from './subclasses';
import { CARRY_LIMIT, SUPPLY_WEIGHT, itemWeight, sellPrice } from './carry';
import { placeMapLabel, type MapLabel } from './map-labels';
import { DisplayToggles, useStoredDisplay } from './DisplayToggles';
import { QuestPanel } from "./QuestPanel";
import { ClassPanel } from "./ClassPanel";
import { ProgressPanel } from "./ProgressPanel";
import { FloorProgressPanel } from "./FloorProgressPanel";
import { RunCard } from "./RunCard";
import { enterFullscreen, exitFullscreen, toggleFullscreen, installTouchFullscreen } from "./fullscreen";
import { XpPanel } from "./XpPanel";
import { EncounterPanel } from "./EncounterPanel";
import { questLabels } from "./quests";
import { Game, W, H, emptyInput, Input, MAP_SIZE } from "./engine";
import { CLASSES, SKILLS, SKILL_BRANCHES, RECIPES, MATERIALS, RARITY, AFFIXES, WOUND_FX, ATTRS, ENEMY_TYPES } from "./data";
import { PC_CONTROLS, PAD_CONTROLS, MECHANICS, type ControlGroup } from "./controls";

import { meleeMode } from './weapon-modes';
import { canUseWeapon, weaponLevel, weaponCategory, weaponLockInfo } from './weapon-access';
import { ART, SCENES } from './art';
import { loadAtlas } from './atlas';
import { LoadTracker, ZoneStreamer, loadImage, zonePlan } from './asset-loader';
import { REGIONS } from './regions';
import paper from '@/assets/hud-paper.jpg';
import { usesTouchControls } from './progression';
import { loadPadMap, buttonFor } from './pad-mapping';
import { PadTester } from './PadTester';
import { padActive, readPads, safePads, rumble, PAD_MENU, PAD_MAP, PAD_LEGEND } from './gamepad';
import { RetroAudio } from './audio';
import { loadTerrain } from './terrain';
import { loadProjectileSprites } from './projectile-sprites';
import { TAP_DASH_SECONDS } from './combat-fx';
import { DIFFICULTIES, getDifficulty, DODGE_MSG_MODES, type DifficultyId, type DodgeMsgMode } from './difficulty';
import { HUD_ART } from './hud-art';
import { PalimpsestPanel, PalimpsestBookCard } from './PalimpsestPanel';
import bookWorldUrl from '@/assets/palimpsest/book-world.png';
import { Button } from '@/components/ui/button';
import { HybridRenderer } from './gfx/hybrid';
import { GfxPanel, GfxStats } from './GfxPanel';
import { PerfOverlay, PerfAdvisor } from './PerfPanel';
import { LiveStrategist } from './LiveStrategist';
import { perf } from './perf-monitor';
import { gfxStore } from './gfx/settings';
import { CameraPanel } from './CameraPanel';
import { SpriteWorld } from './sprite-world';
import { LiveProgress } from './LiveProgress';
import { loadPlayerAtlas } from './player-sprite';
import { CAMERA_LABEL, type CameraMode } from './camera-view';
import playerAtlasAsset from '@/assets/player/el_desconocido_atlas.png.asset.json';
import { Volume2, VolumeX, BookOpen, ArrowRight, Home } from 'lucide-react';
import { ChroniclesPanel, ExpeditionStats } from './ChroniclesPanel';
import { AccountBar, WorldBoard } from './WorldBoard';
import { publishRun, publishFloor, setBeforeSync, publishLive, clearLive, recordFind, pushSave } from './cloud';
import { WeaponWiki } from './WeaponWiki';
import { AutoTranslate } from "./AutoTranslate";
import { classPassives } from "./class-passives";
import { pariahUnlocked, redeemPariahCode, PARIAH_UNLOCK_TEXT } from "./pariah";
import pariahFistUrl from '@/assets/refined/pariah-fist.png';
import pariahHammerUrl from '@/assets/refined/pariah-hammer.png';
import pariahPalmUrl from '@/assets/refined/pariah-palm.png';
import { useLang } from './i18n';
import { uiText } from './locale-text';
import { worldMarkers, nearestMarker } from './map-markers';
import { StatisticsPanel } from './StatisticsPanel';
import { NarrativeAction, FloorNarrative } from './NarrativeAction';
import { CloudSyncBadge } from './CloudSyncBadge';
import { ProfilePanel } from './ProfilePanel';
import { recordArmory } from './armory';
import { AdminPanel } from './AdminPanel';
import { readPlayer, readRunSave } from './run-save';
import { walkSway } from './walk-sway';
import { generateBarks } from '@/lib/barks.functions';
import { loadBarkCache, hasBarks, addBarks } from './barks';
import { mp } from './net/client';
import { MpEntry, MpConnect, MpLobby, MpHud, MpPanel, useMp } from './net/MpUi';

const load = (src: string) => new Promise<HTMLImageElement>((r, reject) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => reject(new Error('No se pudo cargar la ilustración')); i.src = src; });
let gfxRef: HybridRenderer | null = null;
const gfxStats = () => gfxRef?.stats() ?? null;
const RC = ["text-rarity-0", "text-rarity-1", "text-rarity-2", "text-rarity-3", "text-rarity-4"];

export default function GameView() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const mini = useRef<HTMLCanvasElement>(null);
  const labels = useRef<HTMLCanvasElement>(null);
  const gpuHost = useRef<HTMLDivElement>(null);
  const game = useRef<Game>(null as unknown as Game);
  if (!game.current) game.current = new Game();
  const audio = useRef<RetroAudio | null>(null);
  const input = useRef<Input>(emptyInput());
  const [, setTick] = useState(0);
  const [snap, setSnap] = useState<ReturnType<Game["snapshot"]> | null>(null);
  const [touch, setTouch] = useState(false);
  const [pad, setPad] = useState(false);
  const [muted, setMuted] = useState(false);
  useStoredDisplay();
  const [boot, setBoot] = useState({ pct: 0, status: "Inicializando...", done: 0, total: 0, ready: false, error: false });
  const rerender = () => setTick((t) => t + 1);
  const padUsedRef = useRef({ v: false }).current;

  useEffect(() => {
    const g = game.current; g.onUI = rerender;
    g.chronicles.onTitle = t => { g.msg(`TÍTULO ADQUIRIDO: ${t.name} · ${t.requirement}`); g.float(`TÍTULO ADQUIRIDO · ${t.name}`, '#ffe18b'); g.onSound('level'); };
    const sound = new RetroAudio(); audio.current = sound; mp.audio = sound; loadCue(g); g.onSound = (s, v) => { sound.retreatVol = g.retreatCue.volume; sound.sound(s, v); if (padUsedRef.v) rumble(s); }; sound.musicUrl = bellMusic.url; const menuClick = (ev: Event) => { if ((ev.target as HTMLElement)?.closest?.("button")) sound.sound("menu"); }; document.addEventListener("click", menuClick, true); sound.disposers.push(() => document.removeEventListener("click", menuClick, true)); g.beatCheck = () => sound.onBeat(); g.onMusic = (on) => { if (on) sound.startMusic(); else sound.stopMusic(); };
    loadBarkCache(); let barksOff = false, barksBusy = false;
    g.onRunEnd = (r) => { void publishRun(r, g); void clearLive();
      window.__lovableEvents?.track?.(r.outcome === "won" ? "project.run_won" : "project.run_died", { floor: r.floor, level: r.level, kills: r.kills, seconds: r.seconds, score: Math.round(r.score), class_id: g.cls.id, difficulty: g.difficulty.id }); };
    g.onFloorEnd = () => { void publishFloor(g); window.__lovableEvents?.track?.("project.floor_completed", { floor: g.floor, level: g.level, kills: g.kills, seconds: Math.round(g.time), score: Math.round(g.score.total), class_id: g.cls.id, difficulty: g.difficulty.id }); }; setBeforeSync(() => { if (g.mode === "play" || g.mode === "menu" || g.mode === "recap") g.saveRun(); });
    let lastPush = 0; g.onSave = () => { void publishLive(g); if (Date.now() - lastPush > 20000 || document.visibilityState === 'hidden') { lastPush = Date.now(); void pushSave(); } };
    g.onFind = (w) => { recordArmory(w); void recordFind(w); };
    g.onDialogue = async () => {
      if (barksOff) return 'Los diálogos de IA están pausados por la última respuesta del servicio.';
      if (barksBusy) return 'Hay una solicitud de diálogos en curso.';
      const kinds = [...new Set(g.enemies.filter(e => !e.dead).map(e => e.kind))].filter(k => ENEMY_TYPES[k]).slice(0, 4);
      if (!kinds.length) return 'No hay enemigos en este piso.';
      barksBusy = true;
      try {
        const r = await generateBarks({ data: { region: g.region.name.slice(0, 60), kinds: kinds.map(k => ({ id: k, name: ENEMY_TYPES[k].name })), context: { difficulty: g.difficulty.id, equipment: [g.melee?.name, g.ranged?.name, g.armor?.name].filter(Boolean).map(n => n.slice(0,100)), events: (g.chronicles.run?.events ?? []).filter(e => e.kind !== 'seconds').slice(-12).map(e => `${e.kind} ×${e.amount} ${e.context}`.slice(0,120)) } } });
        if (!r.ok) { barksOff = !!r.stop; return r.error; }
        for (const [k,v] of Object.entries(r.sets)) addBarks(k,v);
        return 'Diálogos contextuales actualizados.';
      } catch(e) { barksOff = true; return e instanceof Error ? e.message : 'Los diálogos de IA no están disponibles.'; }
      finally { barksBusy = false; }
    };
    const saveOnHide = () => { if (g.mode === "play" || g.mode === "menu") g.saveRun(); };
    window.addEventListener("pagehide", saveOnHide); const visSave = () => { if (document.visibilityState === "hidden") saveOnHide(); }; document.addEventListener("visibilitychange", visSave);
    const autoSave = window.setInterval(saveOnHide, 10000);
    const cleanupRun = () => { clearInterval(autoSave); window.removeEventListener("pagehide", saveOnHide); document.removeEventListener("visibilitychange", visSave); };
    setTouch(usesTouchControls(navigator.userAgent, matchMedia("(pointer: coarse)").matches, navigator.maxTouchPoints));
    let raf = 0, last = performance.now(), hudT = 0, pausedT = 0;
    const ctx = canvas.current?.getContext("2d", { willReadFrequently: false });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    let spriteWorld: SpriteWorld | null = null;
    try { spriteWorld = new SpriteWorld(); } catch (e) { console.warn('Vista 3D no disponible; se mantiene la perspectiva original.', e); }
    const renderWorld = () => { const alt=!!spriteWorld&&!spriteWorld.lost&&g.camera.mode!=='fp'&&g.mode!=='title'; if(canvas.current){canvas.current.style.objectFit=alt?'fill':'cover';canvas.current.dataset.camera=g.camera.mode;} if (alt) { spriteWorld.frame(g, ctx); drawPickup(g, ctx, W, H); } else {g.worldReticle=null;g.render(ctx);} if (canvas.current && g.mode === 'play') canvas.current.dataset.sceneReady = 'true'; };
    let zoneStreamer: ZoneStreamer | null = null; let cleanupBoot = () => {};
    const hybrid = gpuHost.current ? new HybridRenderer(gpuHost.current, matchMedia("(pointer: coarse)").matches) : null; gfxRef = hybrid;
    const occ = new Uint8Array(MAP_SIZE * MAP_SIZE * 2);
    const gpuFrame = (t: number) => { const host = gpuHost.current; if (!hybrid || !host || !g.gfxCam || !canvas.current) { if (host) host.hidden = true; return; }
      const drawn = hybrid.frame({ color: canvas.current, cam: g.gfxCam, W, H, gDepth: g.gDepth, gInfo: g.gInfo, sDepth: g.sDepth, lights: g.gfxLights(), occ: g.gfxOccupancy(occ), map: MAP_SIZE, palette: { ceiling: [...g.region.ceiling], fog: [...g.region.fog], floor: [...g.region.floor] } }, t);
      host.hidden = !drawn; };
    const streamer = new ZoneStreamer(g.regionTextures); zoneStreamer = streamer;
    const tracker = new LoadTracker(); let cancelled = false;
    const push = () => { if (!cancelled) setBoot(b => ({ ...b, pct: tracker.progress, status: tracker.status, done: tracker.done, total: tracker.total })); };
    (async () => {
      const t0 = performance.now();
      const urls = [...new Set([...Object.values(ART), ...Object.values(HUD_ART), paper, ...Object.values(SCENES).map(s => s.image)].filter((u): u is string => typeof u === 'string'))];
      ['atlas', 'player', 'proj', 'terrain', 'walls', 'anim', 'scene'].forEach(id => tracker.add(id, 4)); urls.forEach(u => tracker.add(u));
      tracker.status = 'Cargando texturas...'; push();
      // Recursos importantes: hasta 3 intentos. Si aun así fallan, se avisa y se juega igual (nunca se queda colgado).
      const step = async (id: string, fn: () => Promise<unknown>, required: boolean) => {
        for (let i = 0; ; i++) {
          try { await fn(); tracker.set(id, 'ready'); push(); return; }
          catch (e) { console.error('[assets]', id, `intento ${i + 1}`, e); if (!required || i >= 2) { tracker.failed.push(id); tracker.set(id, 'ready'); push(); return; } await new Promise(r => setTimeout(r, 800 * (i + 1))); }
        }
      };
      let pool = 0; const limited = async (fn: () => Promise<unknown>) => { while (pool >= 6) await new Promise(r => requestAnimationFrame(r)); pool++; try { return await fn(); } finally { pool--; } };
      try {
        await Promise.all([
          step('atlas', async () => { tracker.set('atlas', 'download'); const sprites = await loadAtlas(); tracker.set('atlas', 'validate'); if (!sprites.sombra || !sprites.sword) throw new Error('Sprites esenciales ausentes'); Object.assign(g.sprites, sprites); g.sprites.boss = sprites.librero; g.sprites.enemy = sprites.sombra; g.weaponImg = sprites.sword; try { const bi = await load(bookWorldUrl); const bc = document.createElement('canvas'); const k = 128 / Math.max(bi.width, bi.height); bc.width = Math.round(bi.width * k); bc.height = Math.round(bi.height * k); const bx = bc.getContext('2d'); if (bx) { bx.imageSmoothingEnabled = true; bx.drawImage(bi, 0, 0, bc.width, bc.height); } g.sprites.palimpsesto = bc; } catch { /* the book falls back to the generic tome */ g.sprites.palimpsesto = sprites.book; } }, true),
          step('player', async () => { if (!(await loadPlayerAtlas(playerAtlasAsset.url))) throw new Error('Sprite del jugador ausente'); }, true),
          step('proj', async () => { g.projSprites = await loadProjectileSprites(); }, false),
          step('pariah', async () => { const load1 = (u: string) => new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = u; }); const [f, h, p] = await Promise.all([pariahFistUrl, pariahHammerUrl, pariahPalmUrl].map(load1)); g.sprites.pariahFist = f; g.sprites.pariahHammer = h; g.sprites.pariahPalm = p; }, false),
          step('terrain', async () => { const t = await loadTerrain(); if (t.length < 4) throw new Error('Terreno incompleto'); g.groundTextures = t; }, true),
          step('walls', async () => { const ids = zonePlan(1).active.concat(zonePlan(1).preload).map(i => REGIONS[i].id); for (const id of ids) await streamer.ensure(id); if (!g.regionTextures[REGIONS[0].id]) throw new Error('Muro inicial ausente'); }, true),
          ...urls.map(u => step(u, () => limited(() => loadImage(u, p => { tracker.set(u, p); })), false)),
        ]);
        tracker.status = 'Preparando animaciones...'; push(); await new Promise(r => requestAnimationFrame(r));
        await step('anim', async () => { g.prepareAnimations(); }, false);
        tracker.status = 'Preparando escenario...'; push(); await new Promise(r => requestAnimationFrame(r));
        await step('scene', async () => { try { g.render(ctx); } catch (e) { console.error('[assets] primer dibujo', e); } }, false);
        // Sombreadores de la vista 3D compilados aquí, no al pulsar «Comenzar run» (evita el congelón inicial).
        tracker.status = 'Preparando gráficos 3D...'; push(); await new Promise(r => requestAnimationFrame(r));
        try { spriteWorld?.prewarm(g, ctx); g.render(ctx); } catch (e) { console.warn('[assets] precompilación 3D', e); }
        streamer.update(1);
        tracker.status = tracker.failed.length ? `Listo (no cargaron: ${tracker.failed.map(f => f.split('/').pop()).slice(0, 4).join(', ')})` : 'Todo verificado'; push();
        console.info(`[assets] carga completa en ${Math.round(performance.now() - t0)} ms`, { total: tracker.total, fallidos: tracker.failed });
        await new Promise(r => setTimeout(r, 350));
        if (!cancelled) setBoot(b => ({ ...b, ready: true }));
      } catch {
        tracker.status = 'No se pudieron cargar recursos esenciales. Revisa tu conexión y recarga.'; push();
        if (!cancelled) setBoot(b => ({ ...b, error: true }));
      }
    })();
    cleanupBoot = () => { cancelled = true; };
    let padUsed = false; padUsedRef.v = false; const padPrev: boolean[] = []; let padMoving = false; let navT = 0;
    const onPadConnect = (e: Event) => { padUsed = true; padUsedRef.v = true; setPad(true); g.float?.(`MANDO CONECTADO: ${((e as GamepadEvent).gamepad?.id ?? "").slice(0, 24)}`, "#7ad8ff"); };
    window.addEventListener("gamepadconnected", onPadConnect);
    /** Mueve el foco entre botones visibles de menús/elecciones con el mando. */
    const navFocus = (dir: number) => {
      const btns = [...document.querySelectorAll<HTMLButtonElement>(".overlay button, .menu-panel button, .game-root .choice-card, .game-root .title-screen button")].filter(b => b.offsetParent && !b.disabled);
      const all = btns.length ? btns : [...document.querySelectorAll<HTMLButtonElement>(".game-root button")].filter(b => b.offsetParent && !b.closest("[data-touch-controls]"));
      if (!all.length) return; const cur = all.indexOf(document.activeElement as HTMLButtonElement);
      const next = all[(cur < 0 ? 0 : cur + dir + all.length) % all.length]; document.querySelectorAll(".pad-focus").forEach(el => el.classList.remove("pad-focus")); next.focus(); next.classList.add("pad-focus"); next.scrollIntoView?.({ block: "nearest" });
    };
    const pollPad = (dt: number) => {
      const pads = safePads();
      if (!pads.length) return;
      const st = readPads(pads);
      if (!padUsed) { if (!padActive(st.axes, st.pressed)) return; padUsed = true; padUsedRef.v = true; setPad(true); }
      const i = input.current;
      if (g.mode !== "play") {
        navT -= dt; const v = st.dpadY || st.lsY, h = st.dpadX || st.lsX;
        if (navT <= 0 && (Math.abs(v) > .5 || Math.abs(h) > .5)) { navFocus((Math.abs(v) > .5 ? v : h) > 0 ? 1 : -1); navT = .22; }
        if (Math.abs(v) < .3 && Math.abs(h) < .3) navT = 0;
      }
      const mx = st.lsX, my = -st.lsY;
      if (g.mode === "play" && (mx || my || padMoving)) { i.mx = mx; i.my = my; padMoving = !!(mx || my); if (Math.hypot(mx, my) > .95 && !st.pressed[buttonFor(loadPadMap(), "slide")]) i.sprint = true; else if (!st.pressed[buttonFor(loadPadMap(), "slide")] && padMoving) i.sprint = false; }
      if (g.mode === "play") { i.lookX += st.rsX * dt * 2.8; i.lookY -= st.rsY * dt * 1.8; }
      const sel = !!st.pressed[PAD_MAP];
      st.pressed.forEach((p, n) => {
        if (p === !!padPrev[n]) return; padPrev[n] = p;
        if (n === PAD_MENU && p) { if (g.mode === "play" || g.mode === "menu") toggleMenu("personaje"); return; }
        if (n === PAD_MAP) { if (!p && g.mode !== "choice" && !padCombo) { if (g.mode === "play" || g.mode === "menu") toggleMenu("mapa"); } if (!p) padCombo = false; return; }
        if (g.mode !== "play") {
          if (n === 0 && p) { const el = document.activeElement as HTMLElement | null; if (el) { el.classList.add("pad-press"); setTimeout(() => el.classList.remove("pad-press"), 260); } rumble("hit", .6); el?.click?.(); if (!(document.activeElement instanceof HTMLButtonElement)) navFocus(0); }
          if (n === 1 && p && g.mode === "menu") toggleMenu("personaje");
          return;
        }
        if (sel && p && n === 3) { padCombo = true; toggleMenu("pactos"); return; }
        if (sel && p && n === 1) { padCombo = true; i.skill = true; setTimeout(() => { input.current.skill = false; }, 80); return; }
        if (sel && n === 4) { padCombo = true; i.sneak = p; return; }
        if (sel && n === 2) { padCombo = true; i.reload = p; return; }
        if (sel && p && n === 5) { padCombo = true; i.pact = true; setTimeout(() => { input.current.pact = false; }, 80); return; }
        if (!p && n === 4) i.sneak = false;
        const k = loadPadMap()[n]; if (k) { (i as unknown as Record<string, boolean>)[k] = p; if (k === "slide") i.pound = p; }
      });
    };
    let padCombo = false;
    let prevMode = g.mode, startedOnce = false; let frameAvg = 1 / 60; let miniSkip = 0, labelSkip = 0; const swayCache = { tf: "", bl: "", li: "" };
    const stopTouchFs = installTouchFullscreen(() => g.mode === "play");
    let frameErrors = 0; const idleInput = emptyInput(); let slowT = 0, lowFx = matchMedia?.("(pointer: coarse)").matches ?? false;
    const loop = (t: number) => {
      const raw = (t - last) / 1000; last = t; if (g.mode === "play" && !document.hidden) perf.sample(raw * 1000, t, () => ({ mode: g.mode, camera: g.camera.mode, enemies: g.enemies.reduce((n, e) => n + (e.dead ? 0 : 1), 0), floor: g.floor, online: mp.active, ping: Math.round(mp.rtt), quality: String(gfxStore.get().preset) })); frameAvg += (Math.min(.25, raw) - frameAvg) * .1;
      // Equipos lentos: sin el desenfoque de pantalla al caminar (filtro caro sobre toda la imagen).
      if (g.mode === "play") { slowT = frameAvg > 1 / 45 ? slowT + Math.min(.25, raw) : Math.max(0, slowT - Math.min(.25, raw) * .25); if (slowT > 2) lowFx = true; }
      const dt = Math.min(.05, raw);
      if (document.hidden) { raf = requestAnimationFrame(loop); return; }
      try {
      pollPad(dt);
      const inp = input.current;
      if (mp.active) mp.frame(g, dt, g.mode === "play" ? inp : idleInput); else g.update(dt, inp); if (g.mode === "play") zoneStreamer?.update(g.floor);
      { const cv = canvas.current, root = cv?.parentElement; if (cv && root) { const R = LEGIBILITY.swayActorRadius, crisp = g.mode === "play" && (g.enemies.some(e => !e.dead && Math.abs(e.x - g.px) < R && Math.abs(e.y - g.py) < R) || g.remotes.some(r => Math.abs(r.x - g.px) < R && Math.abs(r.y - g.py) < R));
        const s = g.mode === "play" ? walkSway(g.time, Math.hypot(g.vx, g.vy), g.pz <= 0.01, crisp) : walkSway(0, 0);
        const blurOn = !lowFx && s.blur > .05; const tf = s.lines || s.x ? `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) rotate(${s.rot.toFixed(2)}deg) scale(1.03)` : "", bl = blurOn ? s.blur.toFixed(2) : "0", li = s.lines.toFixed(2);
        if (tf !== swayCache.tf) { swayCache.tf = tf; cv.style.transform = tf; } if (bl !== swayCache.bl) { swayCache.bl = bl; root.style.setProperty("--walk-blur", `${bl}px`); root.classList.toggle("walk-blur-on", blurOn); } if (li !== swayCache.li) { swayCache.li = li; root.style.setProperty("--walk-lines", li); } } }
      if(g.mode!=="play" && document.pointerLockElement===canvas.current) { document.exitPointerLock?.(); input.current=emptyInput(); }
      if (g.mode !== prevMode) {
        const coarse = window.matchMedia?.("(pointer: coarse)").matches;
        // Primer inicio de partida: pantalla completa. Al volver a jugar desde un menú: recuperar el bloqueo del ratón.
        if (g.mode === "play" && !startedOnce) { startedOnce = true; enterFullscreen(); }
        if (g.mode === "play" && !coarse && document.pointerLockElement !== canvas.current) void Promise.resolve(canvas.current?.requestPointerLock?.()).catch(() => {});
        prevMode = g.mode;
      }
      sound.playing = g.mode === 'play' && !sound.musicPlaying; if (sound.musicPlaying && (g.mode === 'title' || g.mode === 'dead' || g.mode === 'won')) { sound.stopMusic(); g.musicOn = false; } sound.region = g.floor - 1;
      inp.lookX = 0; inp.lookY = 0;
      pausedT -= dt;
      if (g.mode === "play" || ((g.mode === "menu" || g.mode === "choice") && pausedT <= 0)) { renderWorld(); gpuFrame(t); pausedT = .2; if (frameAvg < 1 / 40 || (labelSkip ^= 1)) drawLabels(); }
      hudT -= dt; if (hudT <= 0) { const slow = frameAvg > 1 / 40; hudT = slow ? 0.25 : 0.125; if (g.mode !== "title") { setSnap(g.snapshot()); if (!slow || (miniSkip ^= 1)) drawMini(); } }
      frameErrors = Math.max(0, frameErrors - 1);
      } catch (err) {
        // Un error en un fotograma ya no congela la partida: se registra, se reparan valores inválidos y el bucle sigue.
        frameErrors += 30; console.error('Fotograma fallido; reparando estado', err);
        try { g.sanitize(); } catch { /* noop */ }
      }
      raf = requestAnimationFrame(loop);
    };
    // Crisp enemy labels/bars on a device-resolution overlay that matches the canvas 'cover' crop.
    const drawLabels = () => {
      const lc = labels.current, gc = canvas.current; if (!lc || !gc) return; const c = lc.getContext("2d"); if (!c) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1), cw = gc.clientWidth, ch = gc.clientHeight;
      if (lc.width !== Math.round(cw * dpr) || lc.height !== Math.round(ch * dpr)) { lc.width = Math.round(cw * dpr); lc.height = Math.round(ch * dpr); }
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, cw, ch);
      if (g.mode !== "play") return;
      const alt=g.camera.mode!=='fp',sc = Math.max(cw / W, ch / H), ox = alt?0:(cw - W * sc) / 2, oy = alt?0:(ch - H * sc) / 2;
      const scaleX=alt?cw/W:sc,scaleY=alt?ch/H:sc;
      const base = Math.max(15, Math.min(20, cw / 64));
      for (const L of g.enemyLabels) {
        const x = ox + L.x * scaleX, y = oy + L.y * scaleY; const bw = Math.max(46, Math.min(130, L.w * sc * 1.15)), bh = Math.max(5, Math.round(sc * 1.4));
        if (L.w > 0) {
        c.fillStyle = "rgba(8,4,8,.85)"; c.fillRect(x - bw / 2 - 1, y - 1, bw + 2, bh + 5);
        c.fillStyle = L.ally ? "#0a1f24" : "#3a0710"; c.fillRect(x - bw / 2, y, bw, bh);
        const hg = c.createLinearGradient(0, y, 0, y + bh); hg.addColorStop(0, L.ally ?? (L.boss ? "#ff6a4a" : "#ff4a5e")); hg.addColorStop(1, L.ally ? "#123a40" : L.boss ? "#a0140a" : "#9a0a1e"); c.fillStyle = hg; c.fillRect(x - bw / 2, y, bw * L.hp, bh);
        c.fillStyle = "#ff7ad9"; c.fillRect(x - bw / 2, y + bh + 1, bw * L.brk, 2);
        }
        c.textAlign = "center"; c.textBaseline = "alphabetic"; c.lineJoin = "round";
        const text = (t: string, ty: number, color: string, size: number, bold = true) => { t=uiText(t); c.font = `${bold ? "" : ""}${size}px "VT323", "Courier New", monospace`; c.lineWidth = 3; c.strokeStyle = "rgba(0,0,0,.9)"; c.strokeText(t, x, ty, cw-16); c.fillStyle = color; c.fillText(t, x, ty, cw-16); };
        let ty = y - 4;
        if (L.state) { text(L.state, ty, L.tele ? "#ffef5a" : L.retreat ? "#7ad8ff" : "#d8c8c0", base - 1, false); ty -= base; }
        if (L.name) { text(L.name, ty, L.ally ?? (L.elite ? "#ffd34a" : "#f2e4cc"), base); ty -= base; }
        if (L.miniBoss) { text("MINIJEFE", ty, "#ffd34a", base); ty -= base; }
        if (L.alert) text("!", ty - 2, "#ff3355", base + 8); else if (L.notice) text("?", ty - 2, "#ffd34a", base + 6);
      }
      for (const B of g.barkLabels) {
        const x = ox + B.x * scaleX, y = oy + B.y * scaleY - base * 2.6; const fs = Math.max(13, base - 1);
        c.font = `${fs}px "VT323", "Courier New", monospace`; c.textAlign = "center"; c.textBaseline = "middle";
        const tw = c.measureText(B.text).width + 14, bh = fs + 8; c.globalAlpha = Math.max(0, Math.min(1, B.a));
        c.fillStyle = "rgba(242,228,204,.94)"; c.strokeStyle = "rgba(20,8,12,.9)"; c.lineWidth = 2;
        c.beginPath(); c.roundRect(x - tw / 2, y - bh / 2, tw, bh, 5); c.moveTo(x - 5, y + bh / 2); c.lineTo(x, y + bh / 2 + 6); c.lineTo(x + 5, y + bh / 2); c.fill(); c.stroke();
        c.fillStyle = "#2a0a10"; c.fillText(B.text, x, y + 1); c.globalAlpha = 1;
      }
    };
    const drawMini = () => {
      const m = mini.current; if (!m || g.mode !== "play") return; const c = m.getContext("2d"); if (!c) return;
      const R = m.width / 2, s = 4.2; c.clearRect(0, 0, m.width, m.height);
      c.save(); c.beginPath(); c.arc(R, R, R - 2, 0, Math.PI * 2); c.clip();
      c.fillStyle = "rgba(14,8,14,0.9)"; c.fillRect(0, 0, m.width, m.height);
      c.translate(R, R); c.rotate(-g.ang - Math.PI / 2); c.translate(-g.px * s, -g.py * s);
      const radius = Math.ceil(R / s) + 2;
      for (let y = Math.max(0, Math.floor(g.py)-radius); y < Math.min(MAP_SIZE, g.py+radius); y++) for (let x = Math.max(0, Math.floor(g.px)-radius); x < Math.min(MAP_SIZE, g.px+radius); x++) { const v = g.map[y * MAP_SIZE + x]; if (v === 0) { c.fillStyle = "rgba(120,60,70,0.55)"; c.fillRect(x * s, y * s, s + .3, s + .3); } else if (v === 3) { c.fillStyle = "#c9a14a"; c.fillRect(x * s, y * s, s, s); } else if (v === 11) { c.fillStyle = "#ff9a3a"; c.fillRect(x * s, y * s, s, s); } }
      const col: Record<string, string> = { shop: "#ffd34a", chest: "#d79a4a", altar: "#c35bff", portal: g.collapse ? "#ffffff" : "#7ad8ff", key: "#63e08a", lore: "#e8d6b8", note: "#f2e4cc", cipherlock: "#ffb347", mapfrag: "#ffd34a", palimpsest: "#7ad8ff", folio: "#9ad8ff" };
      for (const p of g.pickups) if (!p.used && p.kind !== 'portal' && col[p.kind]) { c.fillStyle = col[p.kind]; c.beginPath(); c.arc(p.x * s, p.y * s, 2.6, 0, 7); c.fill(); }
      if (g.lairHint) { c.strokeStyle = "rgba(255,211,74,.85)"; c.lineWidth = 2; c.setLineDash([4, 3]); c.beginPath(); c.arc(g.lairHint.x * s, g.lairHint.y * s, g.lairHint.r * s, 0, 7); c.stroke(); c.setLineDash([]); }
      for (const h of g.hazards) { c.fillStyle = "rgba(255,60,40,.8)"; c.beginPath(); c.arc(h.x * s, h.y * s, 2.4, 0, 7); c.fill(); }
      for (const e of g.enemies) { if(e.dead || e.ambush)continue; c.fillStyle = e.kind === "librero" ? "#ff2a2a" : e.elite ? "#ff8a3a" : "#ff3355"; c.fillRect(e.x * s - 2, e.y * s - 2, e.kind === "librero" ? 6 : 3, e.kind === "librero" ? 6 : 3); }
      c.restore();
      c.fillStyle = "#7ad8ff"; c.beginPath(); c.moveTo(R, R - 6); c.lineTo(R - 4, R + 4); c.lineTo(R + 4, R + 4); c.fill();
      c.strokeStyle = "#8a5a3a"; c.lineWidth = 3; c.beginPath(); c.arc(R, R, R - 2, 0, Math.PI * 2); c.stroke();
      const palette = portalPalette(), a = -g.ang - Math.PI / 2;
      for (const p of g.pickups) if (!p.used && p.kind === 'portal') {
        const dx = (p.x - g.px) * s, dy = (p.y - g.py) * s;
        const sx = dx * Math.cos(a) - dy * Math.sin(a), sy = dx * Math.sin(a) + dy * Math.cos(a);
        const distance = Math.hypot(sx, sy), clamp = Math.min(1, (R - 18) / Math.max(1, distance));
        drawPortalMarker(c, R + sx * clamp, R + sy * clamp, 9, palette, 1 + Math.sin(g.time * 4));
      }
      c.fillStyle = "#e8d6b8"; c.font = "10px monospace"; c.textAlign = "center";
      const na = -g.ang - Math.PI / 2; c.fillText("N", R + Math.cos(na - Math.PI / 2) * (R - 9), R + Math.sin(na - Math.PI / 2) * (R - 9) + 3);
    };

    raf = requestAnimationFrame(loop);
    // teclado
    const keys = new Set<string>();
    const sync = () => {
      const i = input.current;
      i.my = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
      i.mx = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
      i.jump = keys.has("Space"); i.dash = dashPulse || keys.has("AltLeft"); i.slide = keys.has("KeyC") || keys.has("ControlLeft");
      i.sprint = keys.has("KeyR") || autoSprint || shiftSprint; i.sneak = keys.has("KeyN"); i.block = keys.has("KeyH"); i.parry = keys.has("KeyP"); i.reload = keys.has("KeyT"); i.pact = keys.has("KeyU");
      i.interact = keys.has("KeyE"); i.finisher = keys.has("KeyF"); i.grab = keys.has("KeyG"); i.kick = keys.has("KeyV") || midKick; i.swap = keys.has("KeyQ"); i.nova = keys.has("KeyZ"); i.bomb = keys.has("KeyX"); i.skill = keys.has("KeyB");
    };
    let autoSprint = false; let midKick = false;
    // Shift: hold to run, quick tap to dash (Alt also dashes instantly).
    let shiftT = 0, shiftSprint = false, dashPulse = false, shiftTimer = 0;
    const shiftDown = () => { if (shiftT) return; shiftT = performance.now(); shiftTimer = window.setTimeout(() => { if (shiftT) { shiftSprint = true; sync(); } }, TAP_DASH_SECONDS * 1000); };
    const shiftUp = () => { const held = performance.now() - shiftT; shiftT = 0; clearTimeout(shiftTimer); if (!shiftSprint && held < TAP_DASH_SECONDS * 1000) { dashPulse = true; sync(); window.setTimeout(() => { dashPulse = false; sync(); }, 70); } shiftSprint = false; sync(); };
    const kd = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && (e.target.closest('input,textarea,[role="combobox"],[role="listbox"]') || e.target.isContentEditable)) return;
      if (e.code === "F11") { e.preventDefault(); toggleFullscreen(); return; }
      if (e.code === "Escape") exitFullscreen();
      if (g.mode === "title" || g.mode === "dead" || g.mode === "won" || g.mode === "recap" || g.mode === "erased") return;
      if (e.code === "Tab" || e.code === "KeyI") { e.preventDefault(); toggleMenu("personaje"); return; }
      if (e.code === "Digit0" && mp.active) { toggleMenu("expedicion"); return; }
      if (e.code === "KeyJ") { toggleMenu("diario"); return; }
      if (e.code === "KeyM") { toggleMenu("mapa"); return; }
      if (e.code === "KeyO") { const order: CameraMode[] = ["fp", "shoulder", "front", "top", "iso"]; const next = order[(order.indexOf(g.camera.mode) + 1) % order.length] ?? "fp"; g.setCamera({ mode: next }); g.float(`CÁMARA: ${CAMERA_LABEL[next].toUpperCase()}`, "#7ad8ff"); return; }
      if (e.code === "KeyK") { toggleMenu("habilidades"); return; }
      if (e.code === "KeyY") { toggleMenu("crafteo"); return; }
      if (e.code === "Escape") { e.preventDefault(); toggleMenu("personaje"); keys.clear(); input.current = emptyInput(); return; }
      if (e.code === "ArrowLeft") input.current.lookX -= 0.06;
      if (e.code === "ArrowRight") input.current.lookX += 0.06;
      if ((e.code === "ShiftLeft" || e.code === "ShiftRight")) { if (!e.repeat) shiftDown(); return; }
      if (e.code === "AltLeft") e.preventDefault();
      if (e.code === "Digit1") g.use("venda"); if (e.code === "Digit2") g.use("racion"); if (e.code === "Digit3") g.use("agua"); if (e.code === "Digit4") g.use("antidoto"); if (e.code === "Digit5") g.use("espejo");
      if (e.code === "Space") e.preventDefault();
      if (!padUsed && /^Key|^Arrow|^Space/.test(e.code)) { padUsed = true; setPad(true); }
      keys.add(e.code); sync();
    };
    const ku = (e: KeyboardEvent) => { if (e.code === "ShiftLeft" || e.code === "ShiftRight") { shiftUp(); return; } keys.delete(e.code); sync(); };
    const toggleMenu = (tab: string) => { keys.clear(); input.current=emptyInput(); g.chargeT=g.aimT=0; if (g.mode === "play") { g.mode = "menu"; g.menuTab = tab; document.exitPointerLock?.(); } else if (g.mode === "menu") g.mode = "play"; rerender(); };
    const mm = (e: MouseEvent) => { if (document.pointerLockElement === canvas.current) { input.current.lookX += e.movementX * 0.0025; input.current.lookY -= e.movementY * 0.0025; } };
    const md = (e: MouseEvent) => { if (document.pointerLockElement !== canvas.current) return; if (e.button === 0) input.current.attack = true; if (e.button === 2) input.current.alternate = true; if (e.button === 1) { e.preventDefault(); midKick = true; sync(); } };
    const mu = (e: MouseEvent) => { if (e.button === 0) input.current.attack = false; if (e.button === 2) input.current.alternate = false; if (e.button === 1) { midKick = false; sync(); } };
    const unlockAudio = () => { sound.unlock(); void sound.loadMusic(bellMusic.url).then(() => { if (g.musicOn) sound.startMusic(); }); };
    const backToTouch = () => { if (padUsed) { padUsed = false; setPad(false); } };
    window.addEventListener('touchstart', backToTouch, { passive: true });
    const blur = () => { keys.clear(); input.current = emptyInput(); };
    window.addEventListener('pointerdown', unlockAudio); window.addEventListener('keydown', unlockAudio); window.addEventListener('blur', blur);
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku); window.addEventListener("mousemove", mm);
    window.addEventListener("mousedown", md); window.addEventListener("mouseup", mu);
    (window as unknown as { __game: Game }).__game = g;
    return () => { stopTouchFs(); spriteWorld?.dispose(); hybrid?.dispose(); if (gfxRef === hybrid) gfxRef = null; window.removeEventListener('touchstart', backToTouch); window.removeEventListener('gamepadconnected', onPadConnect); sound.dispose(); window.removeEventListener('pointerdown', unlockAudio); window.removeEventListener('keydown', unlockAudio); window.removeEventListener('blur', blur); cancelAnimationFrame(raf); cleanupBoot(); cleanupRun(); window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); window.removeEventListener("mousemove", mm); window.removeEventListener("mousedown", md); window.removeEventListener("mouseup", mu); };
  }, []);

  useMp();
  const g = game.current;
  const lock = () => { if (!touch && g.mode === "play") canvas.current?.requestPointerLock?.(); };

  return (
    <div className="game-root" data-platform={touch ? "mobile" : "pc"} onContextMenu={(e) => e.preventDefault()}>
      <canvas ref={canvas} width={W} height={H} className="game-canvas" onClick={lock} />
      <div ref={gpuHost} className="gpu-host" hidden />
      <canvas ref={labels} className="label-canvas" aria-hidden />
      <GfxStats stats={gfxStats} />
      <PerfOverlay />
      <AutoTranslate>
      <Button variant="ghost" size="icon" className="fullscreen-home" aria-label="Inicio · pantalla completa" title="Inicio · pantalla completa" onClick={() => toggleFullscreen()}><Home className="size-5" /></Button>
      {(g.mode === "play" || g.mode === "menu") && snap && <Hud s={snap} g={g} mini={mini} />}
      {g.mode === "play" && <BeatCue audio={audio} game={g} />}
      {g.mode === "play" && snap && <LiveProgress g={g} />}
      {g.mode === "title" && boot.ready && !mp.inRoom && <Title g={g} />}
      {boot.ready && mp.inRoom && mp.phase === "lobby" && !mp.active && <MpLobby />}
      {mp.active && g.mode !== "title" && <MpHud g={g} />}
      <BootScreen boot={boot} />
      {g.mode === "dead" && <Dead g={g} />}
      {g.mode === "erased" && <ErasedView g={g} />}
      {g.mode === "recap" && g.recap && <RecapView g={g} onNext={() => g.continueFloor()} next="SIGUIENTE NIVEL" />}
      {g.mode === 'won' && (g.recap ? <RecapView g={g} onNext={() => { g.mode = 'title'; g.recap = null; rerender(); }} next="VOLVER AL NUEVO AZAR" head={<><BookOpen className="text-rarity-2 size-12" /><h2 className="title-gothic text-3xl mt-2">EL LIBRO PERFECTO</h2><p className="font-pixel">{g.kills} muertes · Nivel {g.level} · {g.journal.length} recuerdos</p><RunCard g={g} kind="won" /></>} /> : <div className="overlay"><BookOpen className="text-rarity-2 size-12" /><h2 className="title-gothic text-3xl mt-4">EL LIBRO PERFECTO</h2><RunCard g={g} kind="won" /><Button className="btn-blood mt-6" onClick={() => { g.mode = 'title'; rerender(); }}>VOLVER AL NUEVO AZAR</Button></div>)}
      <Button size="icon" variant="ghost" title={muted ? 'Activar sonido' : 'Silenciar sonido'} aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'} className="audio-toggle" onClick={() => { audio.current?.unlock(); audio.current?.toggle(); setMuted(audio.current?.muted ?? false); }}>{muted ? <VolumeX /> : <Volume2 />}</Button>
      {g.mode === "choice" && g.choice && (
        <div className="overlay">
          <h2 className="title-gothic text-3xl">{g.choice.title}</h2>
          {g.choice.dialogue && <p className="font-pixel text-lg text-rarity-2 mt-4 max-w-2xl text-center whitespace-pre-line">{g.choice.dialogue}</p>}
          <div className="mt-6 grid gap-3 sm:grid-cols-3 w-full max-w-3xl">
            {g.choice.options.map((o, i) => (
              <Button variant="ghost" key={i} className="choice-card choice-option" onClick={() => g.choose(i)}>
                <div className="choice-title title-gothic">{o.name}</div>
                <div className="choice-desc">{o.desc}</div>
              </Button>
            ))}
          </div>
        </div>
      )}
      {(g.mode === "play" || g.mode === "menu") && snap && <div className="score-hud" aria-label="Puntaje"><span className="score-value">{snap.score}</span>{snap.scoreFx.map((f, i) => <small key={i} className={f.good ? "score-up" : "score-down"}>{f.text}</small>)}</div>}
      {g.mode === "menu" && (g.menuTab === "expedicion" && mp.active ? <MpPanel g={g} onClose={() => { g.mode = "play"; rerender(); }} /> : <Menu g={g} rerender={rerender} touch={touch} pad={pad} />)}
      {g.mode === 'play' && g.chronicles.run && <div className="chronicle-hud" aria-label="Identidad del personaje"><span className="whitespace-pre-wrap break-words">{g.chronicles.run.identity.name}</span><small>{g.cls.name} · {g.chronicles.run.identity.title}</small></div>}
      {g.mode === "play" && touch && !pad && <Touch input={input} g={g} rerender={rerender} />}
      </AutoTranslate>
    </div>
  );
}

function HpBar({ v, max, beat }: { v: number; max: number; beat: number }) {
  const k = Math.max(0, Math.min(1, v / Math.max(1, max)));
  return (
    <div className={`hp-row ${k < .3 ? "is-low" : ""}`} aria-label={`Vida ${Math.ceil(v)} de ${Math.round(max)}`}>
      <img src={HUD_ART.heart} alt="" className="hud-icon hud-heart hp-heart" style={{ animationDuration: `${.35 + Math.max(0, beat) * 1.1}s` }} />
      <div className="hp-track"><div className="hp-fill" style={{ width: `${k * 100}%` }} /><div className="hp-ticks" /><span className="hp-num">{Math.ceil(v)} / {Math.round(max)}</span></div>
    </div>
  );
}

const EXP_STEPS = ["Documento", "Código", "Mapa", "Guarida", "Jefe", "Extracción"];
function ExpeditionHud({ s }: { s: ReturnType<Game["snapshot"]> }) {
  const e = s.expedition!; const tip = e.phase === 1 ? "Busca un documento con un código" : e.phase === 2 ? "Usa el código en la cámara o relicario sellado" : e.phase === 3 ? "Recoge el fragmento de mapa" : e.phase === 4 ? "Llega a la guarida (círculo dorado)" : e.phase === 5 ? "Derrota al guardián" : "¡Vuelve al portal del refugio!";
  return <div className="side-quest-hud paper-sheet expedition-hud"><span className="text-primary">EXPEDICIÓN · {e.phase}/6 {e.phaseName}</span><div className="exp-steps">{EXP_STEPS.map((n, i) => <i key={n} className={i + 1 < e.phase ? "is-done" : i + 1 === e.phase ? "is-now" : ""} title={n} />)}</div><small>{tip}</small></div>;
}
function CollapseHud({ c }: { c: { t: number; max: number; progress: number } }) {
  const m = Math.floor(c.t / 60), sec = Math.floor(c.t % 60);
  return <div className={`collapse-hud ${c.t < 20 ? "is-critical" : ""}`} role="timer" aria-live="polite"><div className="collapse-title">EXPEDITION COLLAPSE</div><div className="collapse-time">{m}:{String(sec).padStart(2, "0")}</div><div className="collapse-track"><div style={{ width: `${(1 - c.progress) * 100}%` }} /></div><div className="collapse-tip">Corre al portal marcado en el mapa e interactúa [E]</div></div>;
}

function Bar({ v, max, cls, label, icon, beat }: { v: number; max: number; cls: string; label: string; icon?: string; beat?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {icon ? <img src={icon} alt={label} title={label} className={`hud-icon ${beat !== undefined ? "hud-heart" : ""} ${v / max < .25 ? "hud-icon-low" : ""}`} style={beat !== undefined ? { animationDuration: `${.35 + Math.max(0, beat) * 1.1}s` } : undefined} /> : <span className="w-7 text-[10px] text-muted-foreground">{label}</span>}
      <div className="hud-bar"><div className={cls} style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%` }} /></div>
      <span className="text-[10px] tabular-nums w-12">{Math.ceil(v)}/{Math.round(max)}</span>
    </div>
  );
}

function Hud({ s, g, mini }: { s: ReturnType<Game["snapshot"]>; g: Game; mini: React.RefObject<HTMLCanvasElement | null> }) {
  const w = s.weapon;
  const effects = [s.needBlur > 0 ? "need-blur" : "", s.mirror ? "mirror-dark" : "", s.sanityFx ? `sanity-${s.sanityFx}` : "", s.burn ? "paper-burning" : "", s.bleed || s.wounds.length ? "paper-blood" : "", s.poison || s.inked ? "paper-ink" : "", /LLUVIA|TORMENTA|NIEBLA/i.test(s.weather) ? "paper-wet" : "", s.hp < s.hpMax * .3 ? "paper-worn" : ""].join(" ");
  return (
    <div className={`game-hud pointer-events-none absolute inset-0 font-pixel ${effects}`} style={{ "--paper-image": `url(${paper})` }}>
      {s.classSkill && <div className={`class-skill-chip ${s.classSkill.ready ? "is-ready" : ""}`} title={s.classSkill.desc}><span>✦ {s.classSkill.name}</span><span className="class-skill-bar"><span style={{ width: `${Math.round(s.classSkill.pct * 100)}%` }} /></span><small>{s.classSkill.buff > 0 ? `activa ${s.classSkill.buff.toFixed(1)} s` : s.classSkill.ready ? "LISTA · B" : s.classSkill.charge === "time" ? `${Math.ceil(s.classSkill.need * (1 - s.classSkill.pct))} s` : `${Math.round(s.classSkill.pct * s.classSkill.need)}/${s.classSkill.need} ${s.classSkill.charge === "kills" ? "muertes" : s.classSkill.charge === "hurt" ? "golpes recibidos" : "daño"}`}</small></div>}
      <div className="hud-left-stack"><div key={s.level} className="paper-sheet vital-sheet space-y-0.5">
        <div className="flex justify-between items-center text-[11px]"><span className="flex items-center gap-1 text-primary"><span className="hud-lantern" style={{ "--lum": Math.max(0, Math.min(1, s.lumbre / Math.max(1, s.lumbreMax))) }}><img src={HUD_ART.lantern} alt="" /><b>{s.level}</b></span>{g.cls.name} · G{s.grado}</span><span className="text-rarity-2">{s.gold}✦</span></div>
        <HpBar v={s.hp} max={s.hpMax} beat={s.hp / s.hpMax} />
        <Bar v={s.stam} max={s.stamMax} cls="bar-stam" label="AGU" icon={HUD_ART.stam} />
        <Bar v={s.breakValue} max={s.breakMax} cls="bar-break" label="BRK" />
        <Bar v={s.mh} max={s.mhMax} cls="bar-mh" label="MENTE" icon={HUD_ART.mind} />
        <Bar v={s.lumbre} max={s.lumbreMax} cls="bar-lum" label="LUM" />
        <Bar v={s.xp} max={s.xpNext} cls="bar-xp" label="EXP" />
        <div className="flex gap-2 text-[10px] pt-0.5">
          <span className={s.food < 25 ? "text-destructive" : ""}>🍖{Math.round(s.food)}</span>
          <span className={s.thirst < 25 ? "text-destructive" : ""}>💧{Math.round(s.thirst)}</span><span className={s.fatigue >= 100 ? "text-destructive" : ""} title="Cansancio: siéntate en la banca o quédate quieto en el refugio">💤{Math.round(s.fatigue)}</span>
          <span>🗝{s.keys}</span><span>💣{s.bombs}</span><span>➶{s.magazine}/{s.magazineMax}+{s.ammo}</span>
        </div>
        <div className="flex justify-between gap-2 text-[9px] text-muted-foreground"><span>{s.soulState} · Ciclos {s.cycles}/100</span><span>✧ {s.resonance}/3</span></div>
        {(s.reloadT > 0 || s.activePact || s.playerStagger > 0) && <div className="text-[10px] text-rarity-2">{s.reloadT > 0 ? `RECARGA ${s.reloadT.toFixed(1)}s` : s.activePact ? `PACTO: ${s.activePact.toUpperCase()}` : "POSTURA ROTA"}</div>}
        {(s.wounds.length > 0 || s.burn || s.poison || s.bleed) && (
          <div className="text-[10px] text-destructive">
            {s.burn && "🔥QUEMADURA "}{s.poison && "☠VENENO "}{s.bleed && "🩸SANGRADO "}{s.wounds.map((x) => `✚${x} `)}
          </div>
        )}
      </div>
      {s.contract && <div className="contract-hud paper-sheet"><div className="text-primary flex items-center gap-1">{!s.contract.done && <img src={HUD_ART.hourglass} alt="" className={`hud-hourglass ${s.contract.t < 60 ? "hud-flip" : ""} ${s.contract.t < 30 ? "hud-shake" : ""}`} />}Contrato: {s.contract.name}</div><div>{s.contract.done ? "✓" : "○"} Elimina enemigos ({Math.min(s.contract.kills, s.contract.goal)}/{s.contract.goal})</div>{!s.contract.done && <div>○ Tiempo restante: {Math.floor(s.contract.t / 60)}:{String(Math.floor(s.contract.t % 60)).padStart(2, "0")}</div>}</div>}
{s.expedition && <ExpeditionHud s={s} />}{g.merchantQuest && <div className="side-quest-hud merchant-quest-hud paper-sheet"><span>{g.merchantQuest.complete ? "✓ " : "◆ "}Mercader: {g.merchantQuest.title}</span><small>{g.merchantQuest.complete ? "Vuelve a su farol a cobrar" : `${questLabels[g.merchantQuest.kind]} · ${g.merchantQuest.progress}/${g.merchantQuest.count}`}</small></div>}{g.sideQuest && <div className="side-quest-hud paper-sheet"><span>{g.sideQuest.complete ? "✓ " : "◇ "}{g.sideQuest.title}</span><small>{questLabels[g.sideQuest.kind]} · {g.sideQuest.progress}/{g.sideQuest.count}</small></div>}
      </div>
      {s.collapse && <CollapseHud c={s.collapse} />}
      <canvas ref={mini} width={140} height={140} className="absolute right-2 top-2 h-[88px] w-[88px] rounded-full sm:h-[130px] sm:w-[130px]" />
      <Compass ang={s.ang} />
      <StatusIcons s={s} />
      <BodyAndRelics s={s} />
      <HudEvents s={s} />
      <div className="hud-right-stack">
      <StatusList s={s} />
      <div className="paper-sheet region-sheet text-right space-y-0.5">
         <div>PISO {s.floor} · {s.weather}</div><div>Presión ×{s.pressure.damage.toFixed(1)} · Salas {s.clearedRooms}/{s.totalRooms}</div>
         <div className="text-primary">◈ {s.zone}</div>
         <div className={s.alerted ? "text-destructive" : s.watchers ? "text-rarity-2" : "text-muted-foreground"}>{s.alerted ? `ALERTA · ${s.alerted}` : s.watchers ? `TE OBSERVAN · ${s.watchers}` : s.sneaking ? "OCULTO" : "SIN DETECTAR"}{s.stillT > 0.8 ? " · PUNTERÍA" : ""}</div>
         <div className="text-muted-foreground">GANZÚA {s.lock.lvl} · {s.lock.xp}/{s.lock.need}</div>
         <div className="text-rarity-2">{s.regionName}</div>
         {s.sanctuaryT !== null && <div>AMANECER EN {Math.ceil(s.sanctuaryT)}s</div>}
        {s.alteration && <div className="text-rarity-1 max-w-[170px] ml-auto">{s.alteration.boon}<br /><span className="text-destructive">{s.alteration.bane}</span></div>}
        {s.event && <div className="text-accent animate-pulse">{s.event}</div>}
        {s.challenge && <div className="text-rarity-2">RETO: {s.challenge.kills}/{s.challenge.goal} · {Math.ceil(s.challenge.t)}s</div>}
        {s.onWall > 0 && <div className="text-secondary-foreground">{s.onWall === 2 ? "ESCALANDO" : "EN PARED"}</div>}
      </div>
      </div>
      {s.boss && (
        <div className="boss-hud absolute left-1/2 top-9 w-[45%] -translate-x-1/2 text-center">
          <div className="title-gothic text-xs text-primary">{s.bossRequired ? "OBLIGATORIO" : "OPCIONAL"} · {g.region.boss} · Fase {s.boss.hp < s.boss.hpMax / 2 ? 2 : 1}</div>
          <div className="hud-bar h-2 w-full"><div className="bar-hp" style={{ width: `${(s.boss.hp / s.boss.hpMax) * 100}%` }} /></div>
          {g.arena && <div className={`font-pixel text-xs ${g.arena.t <= 30 ? "text-destructive animate-pulse" : "text-primary"}`}>{g.arena.t > 0 ? `PUERTAS SELLADAS · ${Math.floor(g.arena.t / 60)}:${String(Math.floor(g.arena.t % 60)).padStart(2, "0")}` : "¡DERRUMBE! CAEN ESCOMBROS"}</div>}
        </div>
      )}
      {s.combo > 1 && <div className="combo absolute right-6 top-1/3">x{s.combo}<div className="text-[10px]">COMBO · EXP x{s.xpMult.toFixed(2)}</div></div>}
      {s.killStreak > 0 && s.streakT > 0 && <div className="combo frenzy-meter absolute right-6 top-[46%] text-rarity-2">{s.killStreak > 1 ? `FRENESÍ x${s.killStreak}` : "RACHA x1"}<div className="frenzy-track"><div className="frenzy-fill" style={{ width: `${Math.max(0, Math.min(100, (s.streakT / Math.max(0.01, s.streakMax)) * 100))}%` }} /></div><div className="text-[10px]">VEL +{Math.round((s.frenzy.move - 1) * 100)}% · ATQ +{Math.round((1 / s.frenzy.rate - 1) * 100)}% · CARGA +{Math.round((s.frenzy.charge - 1) * 100)}%</div><div className="text-[9px] text-muted-foreground">{s.streakT.toFixed(1)}s para la próxima muerte · FICHAS x{s.chipMult.toFixed(1)}</div></div>}
      {s.mirror && <div className="combo absolute left-1/2 top-[18%] -translate-x-1/2 text-center text-rarity-1">{s.mirror.name}<div className="text-[10px]">{s.mirror.desc} · {Math.ceil(s.mirror.t)}s</div></div>}
      {s.sitting && <div className="combo absolute left-1/2 bottom-[30%] -translate-x-1/2 text-center text-rarity-2">SENTADO · LUMBRE {Math.floor(s.lumbre)}/{s.lumbreMax}<div className="text-[10px]">muévete para levantarte</div></div>}

      {(s.swapStacks > 0 || s.crouching) && <div className="combo absolute left-1/2 bottom-[24%] -translate-x-1/2 text-center text-rarity-2 text-[11px]">{s.swapStacks > 0 && <div>⇄ ALTERNANCIA ×{s.swapStacks}</div>}{s.crouching && <div className="text-muted-foreground">AGACHADO · más sigilo y puntería</div>}</div>}
      <div className="journey-hud paper-sheet"><div className="text-rarity-2">{s.objective}</div>{s.interactionPrompt && <div className="text-foreground">E · {s.interactionPrompt}</div>}</div>
      <div className="hurt-floats absolute left-1/2 top-[58%] -translate-x-1/2 text-center pointer-events-none">
        {s.floats.filter(f => f.hurt).slice(-3).map((f, i) => <div key={i} className="float-text" style={{ color: f.color, opacity: Math.max(0, f.t), transform: `translate(${f.x}px, ${-(1 - f.t) * 24}px)` }}>{f.text}</div>)}
      </div>
      <div className="combat-floats absolute left-1/2 top-[38%] -translate-x-1/2 text-center">
        {s.floats.filter(f => !f.hurt).slice(-4).map((f, i) => <div key={i} className="float-text" style={{ color: f.color, opacity: Math.min(1, f.t * 2), transform: `translate(${f.x}px, ${-(1.2 - f.t) * 30 + f.y}px)` }}>{f.text}</div>)}
      </div>
      <div className="paper-sheet log-sheet text-[10px] space-y-0.5">
        {s.log.slice(0, 4).map((l, i) => <div key={i} style={{ opacity: 1 - i * 0.22 }}>{l}</div>)}
      </div>
      {w && <div className="paper-sheet weapon-sheet text-right text-[10px]">
        <div className={RC[w.rarity]}>{w.name}</div>
        <div className="text-muted-foreground">{w.base?.dice[0]}d{w.base?.dice[1]} ×{w.dmgMult} · crít {w.crit}% · {w.affixes?.join(" ")}</div>
        <div className="text-rarity-2">{s.aiming ? (s.aimT>=1 ? '◉ DISPARO CARGADO' : `◉ CARGANDO ${Math.round(s.aimT*100)}%`) : s.chargeT>0 ? `⚔ ${Math.round(s.chargeT/meleeMode(w.base,true).charge*100)}%` : w.base?.ranged ? 'MANTÉN APUNTAR · CARGAR' : `${meleeMode(w.base,false).shape==='circle'?'CÍRCULO':meleeMode(w.base,false).shape==='thrust'?'ESTOCADA':'CORTE'} · CARGADO`}{s.attackCd>0 && ` · ${s.attackCd.toFixed(1)}s`}</div>
      </div>}
    </div>
  );
}

// Silhouette-cut status sigils: invisible until the condition exists, then they materialize and pulse.
function StatusIcons({ s }: { s: ReturnType<Game["snapshot"]> }) {
  const icons: [string, string, boolean, boolean?][] = [
    [HUD_ART.bleed, "Sangrado: pierdes vida", !!s.bleed || s.wounds.length > 0, !!s.bleed],
    [HUD_ART.burn, "Quemadura", !!s.burn, true],
    [HUD_ART.cold, s.temp > 75 ? `Calor ${Math.round(s.temp)}°` : `Frío ${Math.round(s.temp)}°: menos aguante`, s.temp < 30 || s.temp > 75],
    [HUD_ART.poison, s.inked > 0 ? "Tinta: recibes más daño" : "Veneno", !!s.poison || s.inked > 0, true],
    [HUD_ART.shock, `Aguante bajo ${Math.ceil(s.stam)}/${Math.round(s.stamMax)}`, s.stam < s.stamMax * .3, s.stam < 1],
    [HUD_ART.eye, s.alerted ? `Te persiguen: ${s.alerted}` : `Te observan: ${s.watchers}`, !!s.alerted || !!s.watchers, !!s.alerted],
  ];
  return <div className="status-icons">{icons.map(([src, label, on, urgent]) => <img key={src} src={src} alt={label} title={label} className={`${on ? "is-on" : ""} ${on && urgent ? "is-urgent" : ""}`} />)}</div>;
}
// One-shot notices derived from snapshot changes: level, pact, discovery, new message, critical roll.
function HudEvents({ s }: { s: ReturnType<Game["snapshot"]> }) {
  const prev = useRef<{ level: number; pacts: number; visited: number; log: string } | null>(null);
  const [toasts, setToasts] = useState<{ id: number; img: string; text: string }[]>([]);
  const [letterT, setLetterT] = useState(0);
  useEffect(() => {
    const p = prev.current, cur = { level: s.level, pacts: s.pactCount, visited: s.visitedCount, log: s.log[0] ?? "" };
    prev.current = cur; if (!p) return;
    const add = (img: string, text: string) => { const id = Math.random(); setToasts((t) => [...t.slice(-2), { id, img, text }]); window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800); };
    if (cur.level > p.level) add(HUD_ART.level, "");
    if (cur.pacts > p.pacts) add(HUD_ART.pact, "");
    if (cur.visited > p.visited && p.visited > 0) add(HUD_ART.discover, s.zone);
    if (cur.log && cur.log !== p.log) setLetterT(Date.now());
  }, [s.level, s.pactCount, s.visitedCount, s.log, s.zone]);
  const letterOn = Date.now() - letterT < 3000;
  return <>
    <div className="hud-toasts">{toasts.map((t) => <div key={t.id} className="hud-toast"><img src={t.img} alt="" /><span>{t.text}</span></div>)}</div>
    <img src={HUD_ART.letter} alt="Nuevo mensaje" className={`hud-letter ${letterOn ? "is-on" : ""}`} key={letterT} />
    <div className={`hud-threat ${s.evoPulse ? "is-evolving" : ""}`} style={{ "--threat": Math.min(1, s.threat / 30) } as React.CSSProperties} title={`Amenaza enemiga ${s.threat}`}>
      <img src={HUD_ART.shock} alt="" /><b>{s.threat}</b>
      {s.evoPulse && s.evoTraits.length > 0 && <span className="hud-threat-traits">{s.evoTraits.join(" · ")}</span>}
    </div>
    <img src={HUD_ART.dice} alt="Tirada crítica" className={`hud-dice ${s.crit ? "is-on" : ""}`} />
    <div className={`hud-weather ${s.weather !== "SERENO" ? "is-on" : ""} ${/TORMENTA|LLUVIA/i.test(s.weather) ? "is-rain" : ""}`} title={s.weather}><img src={HUD_ART.cloud} alt={s.weather} /><i /><i /><i /></div>
  </>;
}
function BodyAndRelics({ s }: { s: ReturnType<Game["snapshot"]> }) {
  const hpK = Math.max(0, Math.min(1, s.hp / s.hpMax)), lumK = Math.max(0, Math.min(1, s.lumbre / Math.max(1, s.lumbreMax)));
  const marks: string[] = [];
  const showBody = s.wounds.length > 0 || hpK < .5;
  return <>
    <img src={HUD_ART.rose} alt={`Vida ${Math.round(hpK * 100)}%`} className="hud-rose" style={{ filter: `grayscale(${1 - hpK}) brightness(${.55 + hpK * .55})`, transform: `rotate(${(1 - hpK) * 18}deg)` }} />
    <img src={HUD_ART.candles} alt={`Lumbre ${Math.round(lumK * 100)}%`} className={`hud-candles ${lumK < .25 ? "hud-urgent" : ""}`} style={{ opacity: .35 + lumK * .65, filter: `brightness(${.5 + lumK * .7})` }} />
    {showBody && <div className={`hud-body ${hpK < .25 ? "hud-shake" : ""}`} style={{ "--hurt": 1 - hpK }}><img src={HUD_ART.body} alt="Estado del cuerpo" />
      {s.wounds.map((w) => <i key={w} className={`wound wound-${String(w).toLowerCase()}`} title={w} />)}
      <div className="hud-body-marks">{marks.map((m) => <img key={m} src={m} alt="" />)}</div>
    </div>}
  </>;
}

const DIRS = ["E", "SE", "S", "SO", "O", "NO", "N", "NE"];
function Compass({ ang }: { ang: number }) {
  const deg = ((ang * 180 / Math.PI) % 360 + 360) % 360;
  const marks = [];
  for (let i = 0; i < 8; i++) { let dlt = i * 45 - deg; dlt = ((dlt + 540) % 360) - 180; if (Math.abs(dlt) < 80) marks.push(<span key={i} className={DIRS[i] === "N" ? "text-destructive" : ""} style={{ left: `${50 + dlt / 1.6}%` }}>{DIRS[i]}</span>); }
  return <div className="compass-hud">{marks}<i /></div>;
}
function StatusList({ s }: { s: ReturnType<Game["snapshot"]> }) {
  const items: [string, string][] = [];
  if (s.safe) items.push(["✚", s.restHealed ? "Refugio seguro · descanso usado" : "Refugio seguro · descanso disponible"]);
  if (s.denial) items.push(["⊘", `${s.denial.action === "dash" ? "Dash" : s.denial.action === "magic" ? "Magia" : "Recarga"} sellado · ${Math.ceil(s.denial.t)}s`]);
  if (s.visionT > 0) items.push(["◉", "Visión alterada"]); if (s.need) items.push(["☾", s.fatigue >= 100 ? "Agotado: lento y débil" : "Hambre/sed: lento y débil"]);
  if (s.alteration) items.push(["◇", s.alteration.name]);
  if (s.weather !== "SERENO") items.push(["☁", s.weather]);
  if (s.temp > 75) items.push(["🌡", `Calor ${Math.round(s.temp)}°`]); else if (s.temp < 30) items.push(["❄", `Frío ${Math.round(s.temp)}°`]);
  if (s.thirst < 35) items.push(["💧", "Sed"]); if (s.food < 35) items.push(["🍖", "Hambre"]);
  if (s.bleed) items.push(["🩸", "Sangrado"]); if (s.poison) items.push(["☠", "Envenenado"]); if (s.burn) items.push(["🔥", "Quemadura"]);
  for (const w of s.wounds) items.push(["✚", `Herida: ${w}`]);
  if (!items.length) return null;
  return <div className="status-hud paper-sheet">{items.slice(0, 6).map(([i, t]) => <div key={t}><span>{i}</span> {t}</div>)}</div>;
}

/** Marcador del mapa bajo el punto (en casillas): devuelve el id de wiki o "". */
function mapMarkerAt(g: Game, x: number, y: number): string {
  return nearestMarker(worldMarkers(g),x,y)?.wiki ?? '';
}
function mapMarkerLabel(id: string) { const [k, v] = id.split(":"); return k === "enemy" ? `${ENEMY_TYPES[v as keyof typeof ENEMY_TYPES]?.name ?? v} · abrir wiki` : `${v} · abrir wiki`; }
function MapView({ g }: { g: Game }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { lang } = useLang();
  const markers = worldMarkers(g);
  const intel = g.roomIntel();
  useEffect(() => {
    const c = ref.current?.getContext("2d"); if (!c) return; const S = 10;
    c.fillStyle = "#0d080d"; c.fillRect(0, 0, MAP_SIZE * S, MAP_SIZE * S);
    const col: Record<number, string> = { 0: "#3a2530", 2: "#6a5a6a", 3: "#c9a14a", 5: "#7a4a5a", 7: "#5a3a44", 8: "#918690", 9: "#76a39b", 10: "#6b5a48", 11: "#ff9a3a" };
    for (let y = 0; y < MAP_SIZE; y++) for (let x = 0; x < MAP_SIZE; x++) { const v = g.map[y * MAP_SIZE + x]; if (col[v]) { c.fillStyle = col[v]; c.fillRect(x * S, y * S, S, S); } }
    for(const z of intel)if(z.visited){const theme=g.sceneryAt(z.x+.5,z.y+.5);c.fillStyle=`rgba(${theme.tint.join(',')},.22)`;c.fillRect(z.x*S,z.y*S,z.w*S,z.h*S);}
    for(const p of g.scenicProps){const z=intel.find(z=>p.x>=z.x&&p.x<z.x+z.w&&p.y>=z.y&&p.y<z.y+z.h);if(!z?.visited)continue;c.fillStyle=`rgb(${g.sceneryAt(p.x,p.y).tint.map(v=>Math.min(255,v*2)).join(',')})`;c.beginPath();c.arc(p.x*S,p.y*S,2,0,7);c.fill();}
    // Zone state overlays: locked = red hatch, unexplored = fog, cleared = green tint.
    for (const z of intel) {
      if (!z.accessible) { c.fillStyle = "#30000c99"; c.fillRect(z.x * S, z.y * S, z.w * S, z.h * S); c.strokeStyle = "#a01828"; c.lineWidth = 1; for (let k = -z.h; k < z.w; k += 1.2) { c.beginPath(); c.moveTo((z.x + Math.max(0, k)) * S, (z.y + Math.max(0, -k)) * S); c.lineTo((z.x + Math.min(z.w, k + z.h)) * S, (z.y + Math.min(z.h, z.w - k)) * S); c.stroke(); } }
      else if (!z.visited) { c.fillStyle = "#0008"; c.fillRect(z.x * S, z.y * S, z.w * S, z.h * S); }
      else if (z.cleared) { c.fillStyle = "#1f6a3a33"; c.fillRect(z.x * S, z.y * S, z.w * S, z.h * S); }
      c.strokeStyle = !z.accessible ? "#ff3355" : z.cleared ? "#63e08a" : z.visited ? "#e8d6b8" : "#6a5a6a"; c.lineWidth = 2; c.strokeRect(z.x * S + 1, z.y * S + 1, z.w * S - 2, z.h * S - 2);
    }
    const seen = new Set<number>();
    for (const z of intel) for (const d of z.doors) { if (seen.has(d.id)) continue; seen.add(d.id);
      c.fillStyle = d.open ? "#3fae6a" : d.blocked ? "#ff2a3a" : "#c9822a"; c.fillRect(d.x * S + 1, d.y * S + 1, S - 2, S - 2);
      if (d.blocked) { c.fillStyle = "#fff"; c.font = "bold 8px monospace"; c.textAlign = "center"; c.fillText("×", d.x * S + 5, d.y * S + 8); } }
    const pc: Record<string, string> = { shop: "#ffd34a", chest: "#d79a4a", altar: "#c35bff", portal: "#7ad8ff", key: "#63e08a", lore: "#e8d6b8", item: "#5aa7ff", note:'#e8d6b8', mapfrag:'#7ad8ff', cipherlock:'#d79a4a', palimpsest:'#c35bff', folio:'#e8d6b8', pactstone:'#c35bff', sanctuary:'#63e08a', trap:'#ff3355' };
    for (const p of g.pickups) if (!p.used && p.kind !== 'portal' && pc[p.kind]) { c.fillStyle = pc[p.kind]; c.beginPath(); c.arc(p.x * S, p.y * S, p.kind === "item" ? 3 : 4, 0, 7); c.fill(); }
    for (const e of g.enemies) if (!e.dead && !e.ambush) { c.fillStyle = e.kind === "librero" ? "#ff2a2a" : e.miniBoss ? "#ff8a2a" : e.aware ? "#ff3355" : "#a06070"; c.fillRect(e.x * S - 3, e.y * S - 3, 6, 6); if (e.tyrant) { c.strokeStyle = "#ffd34a"; c.lineWidth = 2; c.strokeRect(e.x * S - 5, e.y * S - 5, 10, 10); } }
    c.font = "bold 11px monospace"; c.textAlign = "center";
    const labels: MapLabel[] = [];
    const palette = portalPalette();
    for (const p of g.pickups) if (!p.used && p.kind === 'portal') {
      drawPortalMarker(c, p.x * S, p.y * S, 12, palette);
      labels.push({ x: p.x * S - 17, y: p.y * S - 17, w: 34, h: 34 });
      const label = placeMapLabel(p.x * S, p.y * S + 23, 60, MAP_SIZE * S, labels);
      if (label) { c.fillStyle = palette.ink; c.fillRect(label.x, label.y, label.w, label.h); c.fillStyle = palette.rim; c.fillText('PORTAL', label.x + label.w / 2, label.y + 11); }
    }
    for (const z of intel) { const name=uiText(z.name,lang); const r = placeMapLabel((z.x + z.w / 2) * S, (z.y + z.h / 2) * S, c.measureText(name).width + 8, MAP_SIZE * S, labels); if (!r) continue; c.fillStyle = "#000a"; c.fillRect(r.x, r.y, r.w, r.h); c.fillStyle = z.accessible ? "#e8d6b8" : "#ff7a8a"; c.fillText(name, r.x + r.w / 2, r.y + 11, r.w - 8); }
    c.fillStyle = "#7ad8ff"; c.beginPath(); c.arc(g.px * S, g.py * S, 5, 0, 7); c.fill();
    c.strokeStyle = "#7ad8ff"; c.lineWidth = 2; c.beginPath(); c.moveTo(g.px * S, g.py * S); c.lineTo((g.px + Math.cos(g.ang) * 2) * S, (g.py + Math.sin(g.ang) * 2) * S); c.stroke();
  }, [g, intel, lang]);
  const here = g.zoneAt();
  return <div className="font-pixel"><h3 className="title-gothic text-xl text-rarity-2">{g.region.name} · {here}</h3>
    <div className="map-layout">
      <div>
        <canvas ref={ref} width={MAP_SIZE * 10} height={MAP_SIZE * 10} onClick={(ev) => { const r = ev.currentTarget.getBoundingClientRect(); const id = mapMarkerAt(g, (ev.clientX - r.left) / r.width * MAP_SIZE, (ev.clientY - r.top) / r.height * MAP_SIZE); if (id) g.openWiki(id); }} onMouseMove={(ev) => { const r = ev.currentTarget.getBoundingClientRect(); const id = mapMarkerAt(g, (ev.clientX - r.left) / r.width * MAP_SIZE, (ev.clientY - r.top) / r.height * MAP_SIZE); ev.currentTarget.style.cursor = id ? "pointer" : "default"; ev.currentTarget.title = id ? mapMarkerLabel(id) : ""; }} className="mt-2 w-full max-w-[420px] border border-border" />
        <div className="flex flex-wrap gap-1 mt-2" aria-label="Marcadores del mapa">{markers.map(m=><Button variant="outline" size="sm" className="text-xs h-auto py-1" key={m.key} onClick={()=>g.openWiki(m.wiki)}><span aria-hidden>{m.kind==='enemy'?'⚔':m.kind==='door'?'▥':m.kind==='shop'?'⚖':'◆'}</span> {m.label} · {m.x.toFixed(1)}, {m.y.toFixed(1)}</Button>)}</div>
        <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">Rojo rayado: zona bloqueada · Oscuro: sin explorar · Verde: despejada · Naranja: conducto bajo (agáchate o barre) · Recuadro dorado: Tirano · Puertas: verde abierta, ámbar cerrada, roja sellada · Puntos: dorado tienda, cobre cofre, azul objeto, violeta altar, cian portal</p>
      </div>
      <div className="room-list">
        {intel.map((z) => {
          const known = z.visited || z.accessible;
          const tags: [string, string, string?][] = [];
          if (z.boss) tags.push(["☠", `Jefe ${z.boss}`]);
          if (z.miniBoss) tags.push(["⚔", "Minijefe"]);
          if (z.shop) tags.push(["⚖", "Mercader", "world:El Mercader"]);
          { const shown = z.enemies - (z.visited ? 0 : z.ambushers); if (shown) tags.push(["✦", `${shown} enemigos${!z.visited && z.ambushers ? " + presencias ocultas" : ""}`]); else if (z.enemies) tags.push(["✦", "Presencias ocultas"]); }
          if (z.visited && z.ambushers) tags.push(["⚠", `${z.ambushers} acechando`]);
          for(const kind of z.enemyKinds) tags.push(['⚔', ENEMY_TYPES[kind].name, `enemy:${kind}`]);
          if (z.chests) tags.push(["▣", `${z.chests} cofre${z.chests > 1 ? "s" : ""} · ${z.chestQuality.map((q) => RARITY[q] ?? RARITY[0]).join(", ")}`, "world:Cofre"]);
          if (z.items) tags.push(["◆", `${z.items} objeto${z.items > 1 ? "s" : ""} · ${z.qualities.map((q) => RARITY[q]).join(", ")}`]);
          if (z.resources) tags.push(["•", `${z.resources} recursos`]);
          if (z.traps) tags.push(["⚙", `${z.traps} trampas`]);
          if (z.alteration) tags.push(["◇", z.alteration]);
          if(z.visited) tags.push(['◈',g.sceneryAt(z.x+.5,z.y+.5).name]);
          for (const o of z.objectives) tags.push(["✎", o]);
          const reqs = z.doors.filter((d) => d.blocked && d.requirement).map((d) => d.requirement);
          const status = !z.accessible ? "BLOQUEADA" : z.cleared ? "DESPEJADA" : z.visited ? "EXPLORADA" : "ACCESIBLE";
          return <div key={z.name} className={`room-card ${!z.accessible ? "room-locked" : ""} ${z.name === here ? "room-here" : ""}`}>
            <div className="flex justify-between gap-2"><span className="text-rarity-2">{z.name}</span><span className={!z.accessible ? "text-destructive" : z.cleared ? "text-rarity-1" : "text-muted-foreground"}>{status}</span></div>
            <div className="text-[10px] text-muted-foreground"><button type="button" className="wiki-link" onClick={() => g.openWiki("world:Puerta")}>Puertas</button>: {z.doors.filter((d) => d.open).length} abiertas · {z.doors.filter((d) => !d.open && !d.blocked).length} cerradas · {z.doors.filter((d) => d.blocked).length} selladas</div>
            {[...new Set(reqs)].map((r) => <div key={r} className="text-[10px] text-destructive">🔒 {r}</div>)}
            {known ? tags.map(([i, t, id]) => <div key={t} className="text-[11px]"><span className="text-rarity-2">{i}</span> {id ? <button type="button" className="wiki-link" onClick={() => g.openWiki(id)}>{t}</button> : t}</div>) : <div className="text-[11px] text-muted-foreground">Contenido desconocido</div>}
          </div>;
        })}
      </div>
    </div></div>;
}
function Legacy({ g }: { g: Game }) {
  const L = g.legacy;
  const rows: [string, number][] = [["Partidas", L.runs], ["Enemigos derrotados", L.kills], ["Piso máximo", L.maxFloor], ["Nivel máximo", L.maxLevel], ["Asesinatos sigilosos", L.backstabs], ["Robos", L.steals], ["Cerraduras forzadas", L.picks], ["Nivel de ganzúa", L.lockLvl]];
  return <div className="font-pixel"><h3 className="title-gothic text-xl text-rarity-2">LEGADO PERSISTENTE</h3><p className="text-xs text-muted-foreground">Se guarda en este dispositivo entre partidas.</p>
    <div className="grid grid-cols-2 gap-1 mt-3">{rows.map(([k, v]) => <div key={k} className="item-row"><span className="flex-1">{k}</span><span className="text-rarity-2">{v}</span></div>)}</div></div>;
}

function Title({ g }: { g: Game }) {
  const [statistics, setStatistics] = useState(false);
  const [profile, setProfile] = useState(false);
  const [online, setOnline] = useState(false);
  useEffect(() => { if (new URLSearchParams(location.search).get("sala")) setOnline(true); }, []);
  const [sel, setSel] = useState(0);
  const [code, setCode] = useState(""); const [codeMsg, setCodeMsg] = useState(""); const [, setUnlockTick] = useState(0);
  const [pxFx, setPxFx] = useState(() => { try { return localStorage.getItem("ars_anima_pariah_fx") ?? "normal"; } catch { return "normal"; } });
  const classes = CLASSES.filter(c => c.id !== "pariah" || pariahUnlocked());
  const [sub, setSub] = useState(0);
  const [diff, setDiff] = useState<DifficultyId>("normal");
  const [dmsg, setDmsg] = useState<DodgeMsgMode>("todos");
  useEffect(() => { setDiff(getDifficulty(localStorage.getItem("ars_anima_diff")).id); const m = localStorage.getItem("ars_anima_dodgemsg"); if (m === "cerca" || m === "off") setDmsg(m); }, []);
  const anima = typeof window !== "undefined" ? Number(localStorage.getItem("ars_anima_meta") || 0) : 0;
  const { lang, t, setLang } = useLang();
  if (online) return <div className="overlay overflow-y-auto justify-start pt-10 p-4"><MpConnect onBack={() => setOnline(false)} /></div>;
  if (profile) return <div className="overlay overflow-y-auto justify-start pt-10 p-4"><ProfilePanel onBack={() => setProfile(false)} /></div>;
  if (statistics) return <div className="overlay overflow-y-auto justify-start pt-10 p-4"><StatisticsPanel g={g} onBack={() => setStatistics(false)} /></div>;
  return (
    <div className="overlay title-screen overflow-y-auto justify-start pt-10">
      <img src={SCENES.port.image} alt="Port Veilance, torres góticas junto al agua" className="title-landscape" />
      <h1 className="title-gothic text-4xl sm:text-7xl text-primary drop-glow mt-2 leading-normal">Ars. Anima. : -</h1>
      <p className="font-pixel text-2xl sm:text-4xl text-primary drop-glow mt-1">&quot; IL'INCONNU. &quot;</p>

      <p className="font-pixel text-sm text-muted-foreground mt-1">{t("EL JUEGO DE LOS DADOS ETERNOS · v0.5")}</p>
      <p className="font-pixel text-xs text-rarity-2 mt-2">Port Veilance → Cogspire → The Abyssal Pits → Última Rosa → Babel → Aethryon</p>
      <p className="font-pixel text-xs text-rarity-2 mt-1">{t("Vestigios acumulados")}: {anima} · {t("Grado y Ciclos persisten entre vidas")}</p>
      <LegacyLine />
      <DisplayToggles className="mt-3" />
      <div className="mt-2"><CloudSyncBadge /></div>
      <div className="mt-3 w-full max-w-xl text-left"><CameraPanel g={g} /></div>
      <div className="mt-2 flex items-center gap-2 font-pixel text-xs"><span className="text-muted-foreground">{t("IDIOMA")}</span>{(["es","en"] as const).map(l => <Button key={l} variant="ghost" aria-pressed={lang === l} onClick={() => setLang(l)} className={`choice-card text-xs ${lang === l ? "choice-active" : ""}`}>{l === "es" ? "Español" : "English"}</Button>)}</div>
      <AccountBar />
      <Button variant="outline" className="mt-3" onClick={() => setStatistics(true)}>{t("ESTADÍSTICAS")}</Button>
      <Button variant="outline" className="mt-2" onClick={() => setProfile(true)}>{t("MI PERFIL")}</Button>
      <MpEntry onOpen={() => setOnline(true)} />
      <WorldBoard />
      <WeaponWiki />
      <AdminPanel />
      <div className="w-full max-w-5xl mt-4"><ChroniclesPanel g={g} naming /></div>
      <div className="mt-5 class-grid w-full max-w-5xl">
        {classes.map((c, i) => (
          <Button variant="ghost" key={c.id} onClick={() => setSel(i)} className={`choice-card text-left ${sel === i ? "choice-active" : ""}`}>
            <div className="title-gothic class-name text-primary">{c.name}</div>
            <div className="text-xs text-muted-foreground">{c.desc}</div>
            <div className="text-[10px] mt-1 font-pixel">{c.melee} + {c.ranged}</div>
            <div className="text-[10px] font-pixel text-rarity-2">{c.perk}</div>
          </Button>
        ))}
      </div>
      {(classes[sel] ?? classes[0])?.id === "pariah" && <div className="mt-3 w-full max-w-5xl choice-card text-left"><div className="title-gothic text-primary">P.A.R.I.A.H · THE UNBOUND OUTCAST</div><div className="text-[10px] font-pixel text-muted-foreground mt-1">FUE 112 · RES 108 · AGI 84 · VOL 80 · PRE 78 · PER 66 · INT 60 · SUE 60 · Puños + Arsenal de Ruinas · sin armadura</div><ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">{classPassives("pariah").map(p => <li key={p.id}><b className="text-rarity-2">{p.name}:</b> {p.desc}</li>)}</ul></div>}
      <div className="mt-4 w-full max-w-xl flex flex-col items-center gap-2">
        <div className="font-pixel text-xs text-muted-foreground">{t("CÓDIGO SECRETO")}</div>
        <form className="flex gap-2 w-full" onSubmit={(e) => { e.preventDefault(); if (redeemPariahCode(code)) { setCodeMsg(PARIAH_UNLOCK_TEXT); setUnlockTick(n => n + 1); setCode(""); } else setCodeMsg("El códice no reconoce esas palabras."); }}>
          <input aria-label="Código secreto" value={code} onChange={(e) => setCode(e.target.value)} placeholder="…" className="flex-1 h-9 rounded border border-border bg-background px-2 font-pixel text-sm" maxLength={40} />
          <Button type="submit" variant="outline">{t("PROBAR")}</Button>
        </form>
        {codeMsg && <p className="font-pixel text-xs text-rarity-2 text-center max-w-xl">{codeMsg}</p>}
        {pariahUnlocked() && <div className="flex items-center gap-2 font-pixel text-xs"><span className="text-muted-foreground">Efectos visuales intensos de P.A.R.I.A.H</span>{(["normal", "reduced"] as const).map(m => <Button key={m} variant="ghost" aria-pressed={pxFx === m} className={`choice-card text-xs ${pxFx === m ? "choice-active" : ""}`} onClick={() => { localStorage.setItem("ars_anima_pariah_fx", m); setPxFx(m); }}>{m === "normal" ? "Normales" : "Reducidos"}</Button>)}</div>}
      </div>
      <div className="mt-4 font-pixel text-xs text-muted-foreground">{t("SUBCLASE")}</div>
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-3xl">
        {subclasses((classes[sel] ?? classes[0]).id).map((s, i) => <Button variant="ghost" key={s.id} aria-pressed={sub === i} onClick={() => setSub(i)} className={`choice-card text-left ${sub === i ? 'choice-active' : ''}`}><div className="title-gothic text-primary">{s.name}</div><div className="text-xs text-muted-foreground">{s.desc}</div></Button>)}
      </div>
      <div className="mt-4 font-pixel text-xs text-muted-foreground">{t("DIFICULTAD")}</div>
      <div className="mt-1 grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-3xl">
        {DIFFICULTIES.map((d) => (
          <Button variant="ghost" key={d.id} onClick={() => setDiff(d.id)} className={`choice-card text-left ${diff === d.id ? "choice-active" : ""}`}>
            <div className="title-gothic text-sm text-primary">{t(d.name)}</div>
            <div className="text-[10px] text-muted-foreground">{t(d.desc)}</div>
          </Button>
        ))}
      </div>
      <p className="font-pixel text-[10px] text-rarity-2 mt-1">{t("El reto se ajusta solo: si sufres se suaviza, si arrasas se endurece. Cada 20 s se revisa tu rendimiento.")}</p>
      <div className="mt-3 font-pixel text-xs text-muted-foreground">{t("AVISOS DE ESQUIVE")}</div>
      <div className="mt-1 flex flex-wrap gap-3">
        {DODGE_MSG_MODES.map((m) => (
          <Button variant="ghost" key={m.id} onClick={() => setDmsg(m.id)} className={`choice-card text-xs ${dmsg === m.id ? "choice-active" : ""}`}>{t(m.name)}</Button>
        ))}
      </div>
       {readRunSave() ? <p className="font-pixel text-xs text-rarity-2 mt-5 max-w-xl text-center">{t("Tienes una run en curso: sólo termina al morir. Reanúdala arriba para jugar.")}</p>
       : <Button className="btn-blood mt-5" onClick={() => { localStorage.setItem("ars_anima_diff", diff); localStorage.setItem("ars_anima_dodgemsg", dmsg); g.dodgeMsgs = dmsg; g.runName = readPlayer().name || "IL'INCONNU"; const cls = classes[sel] ?? classes[0]; g.start(cls, diff, false, subclasses(cls.id)[sub]?.id); g.saveRun(); window.__lovableEvents?.track?.("project.run_started", { class_id: cls.id, difficulty: diff }); }}>{t("COMENZAR RUN")} <ArrowRight /></Button>}

      <div className="controls-help mt-6 w-full max-w-5xl">
        <div className="title-gothic text-xl text-primary">{t("CONTROLES Y MECÁNICAS")}</div>
        <div className="controls-cols mt-2">
          <ControlsBlock title={t("PC · TECLADO Y RATÓN")} groups={PC_CONTROLS} />
          <ControlsBlock title={t("MANDO / JOYSTICK")} groups={PAD_CONTROLS} />
          <ControlsBlock title={t("MECÁNICAS")} groups={MECHANICS} />
        </div>
      </div>


    </div>
  );
}

function Dead({ g }: { g: Game }) {
  const head = <><h2 className="title-gothic text-4xl sm:text-5xl text-primary drop-glow">LA TINTA SE SECA</h2><p className="font-pixel mt-1">Piso {g.floor} · Nivel {g.level} · {g.kills} muertes · Ánima total: {g.anima}</p><RunCard g={g} kind="death" /></>;
  if (g.recap) return <RecapView g={g} head={head} next="NUEVA RUN" onNext={() => { g.recap = null; g.mode = "title"; g.onUI(); }} />;
  return <div className="overlay">{head}<Button variant="ghost" className="btn-blood mt-6" onClick={() => { g.mode = "title"; g.onUI(); }}>NUEVA RUN</Button></div>;
}

function RecapView({ g, head, next, onNext }: { g: Game; head?: React.ReactNode; next: string; onNext: () => void }) {
  const [recount, setRecount] = useState(false);
  const r = g.recap; if (!r) return null;
  if (!recount && g.chronicles.run) return <div className="overlay overflow-y-auto"><img src={HUD_ART.letter} alt="" className="size-20 object-contain mb-5" /><h2 className="title-gothic text-2xl text-rarity-2">REGISTRO DE EXPEDICIÓN</h2><p className="max-w-2xl my-6 font-pixel text-xl whitespace-pre-wrap break-words">{g.chronicles.run.resultText}</p><NarrativeAction g={g} /><Button className="btn-blood mt-3" onClick={() => setRecount(true)}>ABRIR RECUENTO</Button></div>;
  const gain = r.lines.filter(l => l.points > 0), loss = r.lines.filter(l => l.points < 0);
  const sum = (ls: typeof r.lines) => ls.reduce((a, l) => a + l.points, 0);
  const scope = r.reason === "floor" ? `NIVEL ${r.floor} COMPLETADO · ${Math.floor(r.seconds / 60)}:${String(r.seconds % 60).padStart(2, "0")}` : "RECUENTO DE LA PARTIDA";
  return (
    <div className="overlay overflow-y-auto justify-start">
      {head}
      <p className="font-pixel text-xs text-muted-foreground mt-2">{scope}</p>
      {g.chronicles.run && <FloorNarrative g={g} />}
      {r.reason === "floor" && <RunCard g={g} kind={g.mode === "won" ? "won" : "floor"} />}
      {g.chronicles.run && <div className="w-full max-w-3xl mt-4"><ExpeditionStats run={g.chronicles.run} /></div>}
      <div className={`recap-grade grade-${r.grade}`}>{r.grade}</div>
      <h3 className="title-gothic text-2xl text-primary">{r.title}</h3>
      <p className="font-pixel text-sm mt-1 max-w-xl text-center">{r.message}</p>
      <div className="recap-grid mt-3 w-full max-w-3xl">
        <div className="recap-col"><h4 className="title-gothic text-sm text-rarity-2">HAZAÑAS · +{sum(gain)}</h4>{gain.length ? gain.map(l => <div key={l.key} className="recap-line"><span>{l.label} ×{l.count}</span><b className="score-up">+{l.points}</b></div>) : <p className="text-xs text-muted-foreground">Ninguna esta vez.</p>}</div>
        <div className="recap-col"><h4 className="title-gothic text-sm text-destructive">PÉRDIDAS · {sum(loss)}</h4>{loss.length ? loss.map(l => <div key={l.key} className="recap-line"><span>{l.label} ×{l.count}</span><b className="score-down">{l.points}</b></div>) : <p className="text-xs text-muted-foreground">Ninguna. Impecable.</p>}</div>
      </div>
      {(() => { const hc = Object.entries(g.hurtCounts).sort((a, b) => b[1] - a[1]); return (r.reason === "death" || hc.length > 0) && <div className="recap-col mt-2 w-full max-w-3xl"><h4 className="title-gothic text-sm text-destructive">HERIDAS</h4>{r.reason === "death" && <div className="recap-line"><span>Causa de la muerte</span><b className="score-down">{g.deathCause || "Desconocida"}</b></div>}{hc.length ? <div className="recap-line"><span>Vida perdida por causa</span><b>{hc.map(([k, n]) => `${k} ×${n}`).join(" · ")}</b></div> : <p className="text-xs text-muted-foreground">No perdiste vida.</p>}</div>; })()}
      {g.recapChecks.length > 0 && r.reason !== "death" && <div className="recap-checks mt-2">{g.recapChecks.map(c => <span key={c.label} className={c.ok ? "score-up" : "text-muted-foreground"}>{c.ok ? "✓" : "✗"} {c.label}</span>)}</div>}
      <p className="font-pixel mt-3">{r.reason === "floor" ? `Puntos del nivel: ${r.floorScore} · ` : ""}Puntaje total: <b className="text-primary">{r.total}</b></p>
      <p className="font-pixel text-xs text-rarity-2 mt-1 max-w-xl text-center">Consejo: {r.advice}</p>
      <p className="font-pixel text-sm mt-2">{r.bonus > 0 ? `Bono por calificación: +${r.bonus} fichas ${r.reason === "floor" ? "para el siguiente nivel" : "para tu próxima partida"}` : "Sin bono de fichas esta vez."}</p>
      <Button variant="ghost" className="btn-blood mt-4 mb-6" onClick={onNext}>{next}</Button>
    </div>
  );
}

function Menu({ g, rerender, touch, pad }: { g: Game; rerender: () => void; touch: boolean; pad: boolean }) {
  const tabs = ["crónicas", "estadísticas", "wiki", "progreso", "pisos", "xp", "personaje", "mapa", "legado", "mochila", ...(g.palim.hasBook ? ["palimpsestos"] : []), "clase", "pactos", "habilidades", "crafteo", "diario", "misiones", "encuentros", "estratega", "ajustes", "mando", ...(g.shopStock.length || g.menuTab === "tienda" ? ["tienda"] : [])];
  const act = (f: () => void) => () => { f(); rerender(); };
  const [invType, setInvType] = useState<'todas' | 'cuerpo' | 'distancia' | 'otro'>('todas');
  const [invState, setInvState] = useState<'todas' | 'disponibles' | 'bloqueadas'>('todas');
  const [invSort, setInvSort] = useState<'entrada' | 'tipo' | 'estado' | 'requisito' | 'cercania'>('entrada');
  const bagShown = g.bag
    .filter((it) => invType === 'todas' || weaponCategory(it) === invType)
    .filter((it) => invState === 'todas' || (invState === 'bloqueadas') === !canUseWeapon(it, g.level));
  if (invSort === 'tipo') bagShown.sort((a, b) => weaponCategory(a).localeCompare(weaponCategory(b)) || a.name.localeCompare(b.name));
  if (invSort === 'estado') bagShown.sort((a, b) => Number(canUseWeapon(b, g.level)) - Number(canUseWeapon(a, g.level)) || a.name.localeCompare(b.name));
  if (invSort === 'cercania') bagShown.sort((a, b) => Math.max(0, weaponLevel(a) - g.level) - Math.max(0, weaponLevel(b) - g.level) || weaponLevel(a) - weaponLevel(b));
  if (invSort === 'requisito') bagShown.sort((a, b) => weaponLevel(b) - weaponLevel(a) || a.name.localeCompare(b.name));
  const W = ({ it }: { it: Game["armor"] | undefined }) => it ? (
    <div>
      <div className="text-xs text-muted-foreground">Peso {itemWeight(it)} · Venta {sellPrice(it)}✦</div>
      <div className={`${RC[it.rarity]} text-sm flex items-center gap-2`}><img className="item-sprite" src={ART.relic} alt="" />{it.name} <span className="text-[10px] text-muted-foreground">({RARITY[it.rarity]})</span></div>
      {it.kind === "weapon" && it.base ? (
        <div className="text-[11px] text-muted-foreground">{it.base!.ranged ? "Distancia" : "Cuerpo a cuerpo"} · {it.base!.dice[0]}d{it.base!.dice[1]} ×{it.dmgMult} · crít +{it.crit}% · prec +{it.acc} · Break {it.base!.breakB}
          {it.affixes?.map((a) => <div key={a} className="text-accent">◆ {a}: {AFFIXES[a]}</div>)}
          {weaponLevel(it) > 1 && (() => { const lock = weaponLockInfo(it, g.level, g.xp, g.xpNext); return (
            <div className={lock.locked ? 'text-destructive' : 'text-rarity-1'}>
              {lock.locked ? 'Bloqueada' : 'Disponible'} · Requiere nivel {lock.req} · Tu nivel: {g.level}
              {lock.locked && <span className="text-rarity-2"> · Te faltan {lock.missing} nivel{lock.missing === 1 ? '' : 'es'} ({lock.xpMissing} XP)</span>}
            </div>
          ); })()}
        </div>
      ) : <div className="text-[11px] text-muted-foreground">DEF +{it.def}</div>}
    </div>
  ) : null;
  return (
    <div className="overlay items-stretch justify-start p-2 sm:p-6">
      <div className="menu-panel mx-auto w-full max-w-4xl flex-1 overflow-y-auto p-3 sm:p-5">
        <div className="flex flex-wrap gap-1 mb-4">
          {tabs.map((t) => <Button variant="ghost" key={t} onClick={act(() => (g.menuTab = t))} className={`tab ${g.menuTab === t ? "tab-active" : ""}`}>{t.toUpperCase()}</Button>)}
          <Button variant="ghost" className="tab ml-auto" onClick={act(() => { g.saveRun(); g.mode = "title"; document.exitPointerLock?.(); })}>GUARDAR Y SALIR AL MENÚ</Button>
          <Button variant="ghost" className="tab" onClick={act(() => (g.mode = "play"))}>✕ VOLVER</Button>
          <LangToggle />
        </div>
        {(pad) && <div className="pause-controls font-pixel">{PAD_LEGEND.map(l => <span key={l}>{l}</span>)}</div>}
        {!touch && <div className="pause-controls font-pixel"><span>WASD · mover</span><span>Ratón · mirar / clic · ataque básico</span><span>Der · cargar / apuntar · quieto 1s: crítico</span><span>P · parry · H · bloquear</span><span>Espacio · saltar (aguante)</span><span>Shift mantener · correr · tocar · dash</span><span>Alt · dash · C · barrida</span><span>E · interactuar · Q · arma</span><span>F · remate · G · escudo</span><span>Clic rueda o V · patada</span><span>T · recarga · U · pacto · B · habilidad de clase</span><span>X · bomba · Z · nova · N · sigilo</span><span>1–4 · consumibles · 5 · espejo · Esc · pausa / salir de pantalla completa</span><span>F11 · pantalla completa</span></div>}
        {g.menuTab === "mapa" && <MapView g={g} />}
        {g.menuTab === "estratega" && <LiveStrategist g={g} />}
        {g.menuTab === "mando" && <PadTester />}
        {g.menuTab === 'crónicas' && <ChroniclesPanel g={g} initial="expedición" />}
        {g.menuTab === "pactos" && <PactPanel g={g} rerender={rerender} />}
        {g.menuTab === "palimpsestos" && <PalimpsestPanel g={g} view={g.palimView ?? "diario"} setView={(v) => { g.palimView = v; rerender(); }} rerender={rerender} />}
        {g.menuTab === "legado" && <Legacy g={g} />}
        {g.menuTab === "estadísticas" && <StatisticsPanel g={g} />}
        {g.menuTab === "wiki" && <WeaponWiki focus={g.wikiFocus} focusKey={g.wikiFocusKey} owned={[g.melee, g.ranged, ...g.bag].filter(Boolean)} floor={g.floor} skillOpen={(id) => g.skillOpen(id)} level={g.level} />}
        {g.menuTab === 'diario' && <div className="font-pixel"><h3 className="title-gothic text-xl text-rarity-2">MEMORIAS DEL NUEVO AZAR</h3><div className="journal-scene"><img src={SCENES[g.region.id].image} alt={g.region.name} /><div><h4 className="title-gothic">{g.region.name}</h4><p>{g.region.desc}</p><p className="text-rarity-2 mt-3">{g.region.objective}</p></div></div><div className="space-y-2 mt-4">{g.journal.length === 0 && <p className="text-muted-foreground">El viaje aún no ha dejado recuerdos.</p>}{g.journal.map((entry, i) => <div key={i} className="item-row"><img className="item-sprite" src={ART[entry.icon]} alt="" /><div className="flex-1"><div className="text-rarity-2">{entry.name}</div><p className="text-muted-foreground">{entry.text}</p></div></div>)}</div></div>}
        {g.menuTab === "personaje" && (
          <div className="grid gap-4 sm:grid-cols-2 font-pixel text-sm">
            <div>
              <h3 className="title-gothic text-xl text-primary">{g.cls.name} · Nivel {g.level} · Grado {g.grado}</h3>
              <div className="text-xs mt-2 text-muted-foreground">Atributos de tu personaje (base de clase ± azar){g.attrPoints > 0 && <span className="text-rarity-2"> · {g.attrPoints} punto(s) para repartir</span>}</div>
              <div className="grid grid-cols-4 gap-1 mt-1">{ATTRS.map((a) => { const base = (g.cls.raw as Record<string, number>)[a] ?? 60, cur = g.attrs[a] ?? base, diff = cur - base; return <div key={a} className="stat-box"><div className="text-[10px] text-muted-foreground">{a}</div>{g.mod(a) >= 0 ? "+" : ""}{g.mod(a)}<div className="text-[9px]">{cur} <span className={diff >= 0 ? "text-rarity-1" : "text-destructive"}>({diff >= 0 ? "+" : ""}{diff})</span></div>{g.attrPoints > 0 && cur < 120 && <Button variant="ghost" className="tab mt-1 h-auto px-1 py-0 text-[10px]" onClick={act(() => g.raiseAttr(a))}>+5</Button>}</div>; })}</div>
              <div className="mt-3 space-y-0.5 text-xs">
                <div>PV {Math.ceil(g.hp)}/{g.hpMax} <span className="text-muted-foreground">(20 + RES×5 + Grado×3)</span></div>
                <div>AGU {g.stamMax} · Lumbre {g.lumbreMax} · DEF {g.def} · Break {g.breakMax}</div>
                <div>Salud mental {Math.ceil(g.mh)}/{g.mhMax} · Capacidad arcana {g.capacity} · Maestría {g.mastery}</div>
                <div>Grado {g.grado}/10 · MT {g.mt}/3 · Ciclos {g.cycles}/100 · {g.soulState()}</div>
                <div>Resonancia {g.resonance}/3 · Comida {Math.round(g.food)} · Sed {Math.round(g.thirst)}</div>
                <div>Fichas {g.gold} · Cargador {g.ranged.mag ?? 0}/{g.ranged.magMax ?? 0} · Reserva {g.ammo}</div>
                <div>Muertes {g.kills} · Piso {g.floor}</div>
              </div>
              <h4 className="title-gothic mt-3 text-primary">Heridas y estados</h4>
              <div className="text-xs">{Object.keys(g.wounds).length ? Object.keys(g.wounds).map((w) => <div key={w}>✚ {w}: {WOUND_FX[w]}</div>) : "Sin heridas"}</div>
            </div>
            <div className="space-y-3">
              <div><h4 className="title-gothic text-primary">Equipo</h4><W it={g.melee} /><div className="h-2" /><W it={g.ranged} />{g.armor && <><div className="h-2" /><W it={g.armor} /></>}</div>
              <div><h4 className="title-gothic text-primary">Pactos · U / botón Pacto para activar</h4><div className="text-xs">{g.pacts.length ? g.pacts.map((p) => <div key={p.id} className="mb-2">☩ {p.name}: {p.boon}<div className="text-muted-foreground">Activador: {p.trigger} · Precio: {p.price}</div><div className="text-destructive">Deuda: {p.rupture}</div><div className="text-muted-foreground">Reparación: {p.repair}</div></div>) : "Ninguno (altares y cada 3 niveles)"}</div></div>
              <div><h4 className="title-gothic text-primary">Epifanías</h4><div className="text-xs">{g.epiph.length ? g.epiph.map((p) => <div key={p.id} className="mb-2">✧ {p.name} · Rango {p.rank}: {p.desc}<div className="text-muted-foreground">Origen: {p.source} · Activador: {p.activation} · Coste: {p.cost} · Límite: {p.limit}</div></div>) : "Se despiertan con Recuerdos, Ciclos y Grado, no por combo aislado."}</div></div>
            </div>
          </div>
        )}
        {g.menuTab === "mochila" && (
          <div className="font-pixel space-y-3">
            <div className="text-sm text-rarity-2">Capacidad {g.carryWeight().toFixed(1)} / {CARRY_LIMIT}</div>
            <progress className="unlock-progress w-full" aria-label="Capacidad de mochila" max={CARRY_LIMIT} value={g.carryWeight()} />
            <PalimpsestBookCard g={g} open={(v) => { g.palimView = v; g.menuTab = "palimpsestos"; rerender(); }} />
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 text-xs">
              {(["venda", "racion", "agua", "antidoto", "tonico", "espejo"] as const).map((k) => <Button variant="ghost" key={k} className="stat-box" onClick={act(() => g.use(k))}>{k.toUpperCase()} ×{g.cons[k] ?? 0} · {SUPPLY_WEIGHT[k]} peso<div className="text-[9px] text-muted-foreground">usar</div></Button>)}
            </div>
            <div className="flex flex-wrap gap-1 text-[10px] items-center">
              <span className="text-muted-foreground mr-1">TIPO</span>
              {([['todas', 'Todas'], ['cuerpo', 'Cuerpo a cuerpo'], ['distancia', 'Distancia'], ['otro', 'Otros']] as const).map(([id, label]) => (
                <Button variant="ghost" key={id} className={`tab ${invType === id ? 'tab-active' : ''}`} onClick={() => setInvType(id)}>{label}</Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 text-[10px] items-center">
              <span className="text-muted-foreground mr-1">ESTADO</span>
              {([['todas', 'Todas'], ['disponibles', 'Disponibles'], ['bloqueadas', 'Bloqueadas']] as const).map(([id, label]) => (
                <Button variant="ghost" key={id} className={`tab ${invState === id ? 'tab-active' : ''}`} onClick={() => setInvState(id)}>{label}</Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 text-[10px] items-center">
              <span className="text-muted-foreground mr-1">ORDEN</span>
              {([['entrada', 'Recogida'], ['tipo', 'Tipo'], ['estado', 'Estado'], ['requisito', 'Requisito ↓'], ['cercania', 'Más cerca de desbloquear']] as const).map(([id, label]) => (
                <Button variant="ghost" key={id} className={`tab ${invSort === id ? 'tab-active' : ''}`} onClick={() => setInvSort(id)}>{label}</Button>
              ))}
            </div>
            {g.bag.length === 0 && <div className="text-muted-foreground text-sm">Mochila vacía. Abre cofres y mata élites.</div>}
            {g.bag.length > 0 && bagShown.length === 0 && <div className="text-muted-foreground text-sm">Ningún objeto coincide con los filtros.</div>}
            {bagShown.map((it) => (
              <div key={it.uid} className="item-row">
                <W it={it} />
                <div className="flex gap-1 shrink-0"><Button variant="ghost" className="tab" disabled={!canUseWeapon(it, g.level)} onClick={act(() => g.equip(it.uid))}>EQUIPAR</Button><Button variant="ghost" className="tab" onClick={act(() => g.sell(it.uid))}>VENDER</Button></div>
              </div>
            ))}
          </div>
        )}
        {g.menuTab === "progreso" && <ProgressPanel g={g} />}
        {g.menuTab === "pisos" && <FloorProgressPanel g={g} />}
        {g.menuTab === "xp" && <XpPanel g={g} />}
        {g.menuTab === "clase" && <ClassPanel g={g} rerender={rerender} />}
        {g.menuTab === "habilidades" && (
          <div className="font-pixel">
            <div className="mb-2 text-sm">Puntos: <span className="text-rarity-2">{g.sp}</span></div>
            <div className="grid gap-3 sm:grid-cols-3">
              {SKILL_BRANCHES.map((b, bi) => (
                <div key={b}><h4 className="title-gothic text-primary mb-1">{b}</h4>
                  {SKILLS.filter((s) => s.branch === bi).map((s) => {
                    const owned = g.has(s.id), can = !owned && g.sp >= s.cost && (!s.req || g.has(s.req));
                    return <Button variant="ghost" key={s.id} disabled={!can} onClick={act(() => g.learn(s.id))} className={`skill-node ${owned ? "skill-owned" : can ? "" : "opacity-40"}`}>
                      <div className="text-sm">{s.name} <span className="text-[10px] text-muted-foreground">({s.cost})</span></div><div className="text-[10px] text-muted-foreground">{s.desc}</div>
                    </Button>;
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
        {g.menuTab === "crafteo" && (
          <div className="font-pixel">
            <div className="text-xs mb-3 flex flex-wrap gap-2">{Object.entries(MATERIALS).map(([k, n]) => <span key={k} className="stat-box">{n} ×{g.mats[k] ?? 0} · 0.25 peso/u</span>)}</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {RECIPES.map((r) => <Button variant="ghost" key={r.id} disabled={!g.canCraft(r.id)} onClick={act(() => g.craft(r.id))} className={`item-row text-left ${g.canCraft(r.id) ? "" : "opacity-40"}`}>
                <div><div className="text-sm text-primary">{r.name}</div><div className="text-[10px] text-muted-foreground">{r.desc}</div><div className="text-[10px]">{Object.entries(r.needs).map(([k, v]) => `${MATERIALS[k]} ×${v}`).join(" · ")}</div></div>
              </Button>)}
            </div>
            <div className="mt-4"><ForgePanel g={g} rerender={rerender} /></div>
          </div>
        )}
        {g.menuTab === "misiones" && <QuestPanel g={g} />}
        {g.menuTab === "ajustes" && <CameraPanel g={g} />}
        {g.menuTab === "ajustes" && <DisplayToggles className="mb-4 justify-start" />}
        {g.menuTab === "ajustes" && <CueSettings g={g} rerender={rerender} />}
        {g.menuTab === "ajustes" && <div className="mt-4"><GfxPanel stats={gfxStats} /><PerfAdvisor g={g} /></div>}
        <div hidden={g.menuTab !== "encuentros"}><EncounterPanel g={g} /></div>
        {g.menuTab === "tienda" && (
          <div className="font-pixel space-y-2">
            <div className="text-sm">Mercader de Babel · Fichas: <span className="text-rarity-2">{g.gold}</span></div>
            {g.shopStock.map((s, i) => <div key={i} className="item-row" onMouseEnter={() => g.onSound("shopSelect")} onFocus={() => g.onSound("shopSelect")}><span className="text-sm">{s.name} · {s.weight} peso</span><Button variant="ghost" aria-disabled={g.gold < s.price || !g.canCarry(s.weight)} className="tab" onClick={act(() => g.buy(i))}>{s.price}✦</Button></div>)}
            <div className="mt-3"><ForgePanel g={g} rerender={rerender} /></div>
          </div>
        )}
      </div>
    </div>
  );
}

const ICONS: Partial<Record<string, string>> = { attack: ART.icon_attack, jump: ART.icon_jump, dash: ART.icon_dash, nova: ART.icon_magic };
function TouchBtn({ k, label, cls = "", input }: { k: keyof Input; label: string; cls?: string; input: React.RefObject<Input> }) {
  const downAt = useRef(0); const ids = useRef(new Set<number>());
  const set = (v: boolean) => { (input.current as unknown as Record<string, boolean>)[k] = v; };
  const down = (e: React.PointerEvent<HTMLButtonElement>) => { e.preventDefault(); e.stopPropagation(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ } ids.current.add(e.pointerId); downAt.current = performance.now(); set(true); navigator.vibrate?.(8); };
  const up = (e: React.PointerEvent<HTMLButtonElement>) => { e.stopPropagation(); ids.current.delete(e.pointerId); if (ids.current.size) return; const held = performance.now() - downAt.current; if (held >= 70) set(false); else setTimeout(() => { if (!ids.current.size) set(false); }, 70 - held); };
  const icon = ICONS[k as string];
  return <Button variant="ghost" aria-label={label} title={label} className={`touch-btn ${cls}`} onPointerDown={down} onPointerUp={up} onPointerCancel={up} onContextMenu={(e) => e.preventDefault()}>{icon ? <img className="touch-icon" src={icon} alt="" draggable={false} /> : label}</Button>;
}

function Touch({ input, g, rerender }: { input: React.RefObject<Input>; g: Game; rerender: () => void }) {
  const stick = useRef<{ id: number; x: number; y: number } | null>(null);
  const look = useRef<{ id: number; x: number; y: number } | null>(null);
  const knob = useRef<HTMLDivElement>(null);
  const setKnob = (x: number, y: number) => { if (knob.current) knob.current.style.transform = `translate(${x}px, ${y}px)`; };
  const onStart = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('button')) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
    if (target?.closest('.touch-stick')) { if (!stick.current) stick.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; }
    else if (!look.current) look.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stick.current?.id === e.pointerId) {
      let dx = e.clientX - stick.current.x, dy = e.clientY - stick.current.y; const l = Math.hypot(dx, dy);
      if (l > 50) { dx = dx / l * 50; dy = dy / l * 50; }
      const m = Math.hypot(dx, dy) < 6 ? 0 : 1; // zona muerta
      input.current.mx = m * dx / 50; input.current.my = m * -dy / 50; input.current.sprint = l > 46; setKnob(dx, dy);
    } else if (look.current?.id === e.pointerId) {
      input.current.lookX += (e.clientX - look.current.x) * 0.006; input.current.lookY -= (e.clientY - look.current.y) * 0.006;
      look.current.x = e.clientX; look.current.y = e.clientY;
    }
  };
  const onEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stick.current?.id === e.pointerId) { stick.current = null; input.current.mx = 0; input.current.my = 0; input.current.sprint = false; setKnob(0, 0); }
    if (look.current?.id === e.pointerId) look.current = null;
  };
  const B = (p: { k: keyof Input; label: string; cls?: string }) => <TouchBtn {...p} input={input} />;
  const go = (tab: string) => (e: React.PointerEvent) => { e.stopPropagation(); input.current = emptyInput(); g.mode = "menu"; g.menuTab = tab; rerender(); };
  const stampede = (e: React.PointerEvent) => { e.stopPropagation(); input.current.sprint = true; input.current.dash = true; setTimeout(() => { input.current.dash = false; if (!stick.current) input.current.sprint = false; }, 140); };
  // Every Input action has exactly one visible button; groups: movement (left), combat 3×3 (right), utilities (above combat), menus (top-left).
  return (
    <div className="absolute inset-0 touch-none select-none" data-touch-controls onPointerDown={onStart} onPointerMove={onMove} onPointerUp={onEnd} onPointerCancel={onEnd} onLostPointerCapture={onEnd} onContextMenu={(e) => e.preventDefault()}>
      <div className="touch-zone touch-stick tc-stick"><div ref={knob} className="touch-knob" /><span className="touch-hint">mover · borde corre</span></div>
      <div className="tc-move">
        {B({ k: "sprint", label: "Correr", cls: "touch-sm touch-lbl" })}
        <Button variant="ghost" className="touch-btn touch-sm touch-lbl" aria-label="Estampida" onPointerDown={stampede}>Estam&shy;pida</Button>
        {B({ k: "sneak", label: "Sigilo", cls: "touch-sm touch-lbl" })}
        {B({ k: "slide", label: g.crouching ? "Levantar" : "Agachar", cls: `touch-sm touch-lbl ${g.crouching ? "touch-on" : ""}` })}
      </div>
      <div className="tc-aux">
        {B({ k: "swap", label: g.slot === 1 ? "⇄ Espada" : "⇄ Disparo", cls: "touch-sm touch-lbl" })}
        {B({ k: "reload", label: "Recarga", cls: "touch-sm touch-lbl tc-reload" })}
        {B({ k: "parry", label: "Parry", cls: "touch-sm touch-lbl" })}
        {B({ k: "grab", label: "Escudo", cls: "touch-sm touch-lbl" })}
        {B({ k: "bomb", label: "Bomba", cls: "touch-sm touch-lbl" })}
        {B({ k: "nova", label: "Nova", cls: "touch-sm touch-lbl" })}
        {B({ k: "skill", label: "✦ Habilidad", cls: "touch-sm touch-lbl touch-pact" })}
        {B({ k: "pact", label: "Pacto", cls: "touch-sm touch-lbl touch-pact" })}
        <Button variant="ghost" className="touch-btn touch-sm touch-lbl touch-pact" aria-label="Ver pactos" onPointerDown={go("pactos")}>Ver pactos</Button>
      </div>
      <div className="tc-pad">
        {B({ k: "interact", label: "Usar", cls: "touch-lbl" })}
        {B({ k: "block", label: "Guardia", cls: "touch-lbl" })}
        {B({ k: "finisher", label: "Remate", cls: "touch-lbl" })}
        {B({ k: "pound", label: "Machacar", cls: "touch-lbl touch-pound" })}
        {B({ k: "dash", label: "Dash" })}
        {B({ k: "jump", label: "Saltar" })}
        {B({ k: "kick", label: "Patada", cls: "touch-lbl touch-kick" })}
        {B({ k: "alternate", label: g.slot === 1 ? "Apuntar" : "Cargar", cls: "touch-alt" })}
        {B({ k: "attack", label: "Atacar", cls: "touch-big" })}
      </div>
      <div className="touch-menu tc-menu">
        <Button variant="ghost" className="touch-btn touch-sm" aria-label="Menú" onPointerDown={go("personaje")}>☰</Button>
        <Button variant="ghost" className="touch-btn touch-sm" aria-label="Mapa" onPointerDown={go("mapa")}>⌖</Button>
        <Button variant="ghost" className="touch-btn touch-sm" aria-label="Curar" onPointerDown={(e) => { e.stopPropagation(); g.use("venda"); }}>✚</Button>
      </div>
    </div>
  );
}

function LegacyLine() {
  const [L, setL] = useState<{ runs?: number; kills?: number; maxFloor?: number; lockLvl?: number } | null>(null);
  useEffect(() => { try { setL(JSON.parse(localStorage.getItem("ars_anima_legacy") || "null")); } catch { setL(null); } }, []);
  if (!L) return null;
  return <p className="font-pixel text-xs text-muted-foreground mt-1">Legado: {L.runs ?? 0} partidas · {L.kills ?? 0} bajas · piso máx. {L.maxFloor ?? 1} · ganzúa {L.lockLvl ?? 1}</p>;
}

const CUE_KEY = "ars_anima_retreat_cue";
export function loadCue(g: Game) { try { Object.assign(g.retreatCue, JSON.parse(localStorage.getItem(CUE_KEY) || "{}")); } catch { /* noop */ } }
function CueSettings({ g, rerender }: { g: Game; rerender: () => void }) {
  const c = g.retreatCue;
  const set = (patch: Partial<typeof c>) => { Object.assign(c, patch); try { localStorage.setItem(CUE_KEY, JSON.stringify(c)); } catch { /* noop */ } rerender(); };
  const Slider = ({ k, label, min, max }: { k: "volume" | "size" | "intensity"; label: string; min: number; max: number }) => (
    <label className="flex items-center gap-3"><span className="w-28">{label}</span><input type="range" min={min} max={max} step={0.05} value={c[k]} onChange={(e) => set({ [k]: Number(e.target.value) })} className="flex-1" /><span className="w-10 text-right">{Math.round(c[k] * 100)}%</span></label>
  );
  return (
    <div className="font-pixel space-y-3">
      <h3 className="title-gothic text-xl text-rarity-2">SEÑALES DE RETIRADA</h3>
      <label className="flex items-center gap-2"><input type="checkbox" checked={c.sound} onChange={(e) => set({ sound: e.target.checked })} /> Sonido de retirada</label>
      <Slider k="volume" label="Volumen" min={0} max={1.5} />
      <label className="flex items-center gap-2"><input type="checkbox" checked={c.visual} onChange={(e) => set({ visual: e.target.checked })} /> Señal visual («» y barra)</label>
      <Slider k="size" label="Tamaño" min={0.6} max={2} />
      <Slider k="intensity" label="Intensidad" min={0.2} max={1} />
    </div>
  );
}

function PactPanel({ g, rerender }: { g: Game; rerender: () => void }) {
  return (
    <div className="font-pixel space-y-3">
      <h3 className="title-gothic text-xl text-primary">PACTOS SELLADOS</h3>
      {g.activePact && <p className="text-rarity-2">Pacto activo: {g.pacts.find(p => p.id === g.activePact?.id)?.name} · {Math.ceil(g.activePact.t)}s</p>}
      {!g.pacts.length && <p className="text-muted-foreground">Ninguno. Busca sellos de pacto en el suelo, altares, o sube cada 3 niveles.</p>}
      {g.pacts.map(p => { const cd = Math.ceil(g.pactCooldowns[p.id] ?? 0); return (
        <div key={p.id} className="item-row flex-col items-start gap-1">
          <div className="title-gothic text-primary">☩ {p.name}</div>
          <div className="text-xs"><span className="text-rarity-2">PRO:</span> {p.boon}</div>
          <div className="text-xs text-destructive">CONTRA: {p.bane} · Precio: {p.price}</div>
          <div className="text-xs text-muted-foreground">ACTIVACIÓN: {p.trigger}{cd > 0 ? ` · recarga ${cd}s` : ""}</div>
        </div>); })}
      {g.pacts.length > 0 && <Button className="btn-blood" onClick={() => { g.mode = "play"; g.activatePact(); rerender(); }}>Activar pacto ahora</Button>}
    </div>
  );
}

function BootScreen({ boot }: { boot: { pct: number; status: string; done: number; total: number; ready: boolean; error: boolean } }) {
  const pct = Math.round(boot.pct * 100);
  return (
    <div className={`boot-screen ${boot.ready ? 'boot-screen--out' : ''}`} aria-hidden={boot.ready} role="status" aria-live="polite">
      <h1 className="title-gothic boot-title">ARS ANIMA</h1>
      <p className="font-pixel boot-sub">IL'INCONNU</p>
      <div className="boot-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div className="boot-bar-fill" style={{ width: `${pct}%` }} /></div>
      <div className="font-pixel boot-meta"><span>{boot.status}</span><span>{pct}%</span></div>
      <p className={`font-pixel boot-count ${boot.error ? 'text-destructive' : ''}`}>{boot.done}/{boot.total} recursos verificados</p>
    </div>
  );
}

function ControlsBlock({ title, groups }: { title: string; groups: ControlGroup[] }) {
  return (
    <div className="controls-col">
      <div className="controls-col-title font-pixel">{title}</div>
      {groups.map((g) => (
        <div key={g.title} className="controls-grp">
          <div className="controls-grp-title font-pixel">{g.title}</div>
          <ul className="font-pixel">{g.lines.map((l) => <li key={l}>{l}</li>)}</ul>
        </div>
      ))}
    </div>
  );
}


function ErasedView({ g }: { g: Game }) {
  const go = () => { if (g.mode === "erased") g.finishFloor(); };
  useEffect(() => { const t = window.setInterval(() => { if (g.mode === "erased" && performance.now() - g.erasedAt > 4800) g.finishFloor(); }, 200); return () => clearInterval(t); }, [g]);
  return <div className="erased-screen" onClick={go} role="button" tabIndex={0}>
    <p className="erased-line">Ese lugar ha dejado de existir.</p>
    <p className="erased-line erased-second">El próximo podría volver a ser yo.</p>
  </div>;
}

/** Cambio de idioma dentro del menú de pausa (wiki, mochila, Mercader y menús se traducen al instante). */
function LangToggle() {
  const { lang, setLang } = useLang();
  return <span className="flex items-center gap-1 font-pixel text-xs" data-no-translate>{(["es", "en"] as const).map(l => <Button key={l} variant="ghost" aria-pressed={lang === l} onClick={() => setLang(l)} className={`tab ${lang === l ? "tab-active" : ""}`}>{l === "es" ? "ES" : "EN"}</Button>)}</span>;
}
