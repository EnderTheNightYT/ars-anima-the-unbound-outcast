import * as THREE from 'three';
import type { Game } from './engine';
import { ENEMY_TYPES } from './data';
import { PORTAL } from './expedition';
import { cellVolume } from './world-rules';
import { CELL_H, PLAYER_SPRITE_SCALE, remoteFrame } from './player-sprite';
import { rubbleHeight, RUBBLE_FALL } from './falling-rubble';
import { gfxStore } from './gfx/settings';
import { zoneSun } from './gfx/zones';
import { buildEnvMap } from './gfx/grading';
import { WorldEffects } from './world-effects';
import { traceAim, viewPosition } from './world-aim';
import { shotRange } from './camera';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { legible, enemyRim, LEGIBILITY, RIM } from './sprite-legibility';
import { WorldQualityGovernor } from './gfx/world-quality';

/** True world geometry; reuses the simulation, loaded artwork and its single frame loop. */
/** Brillo de las figuras sin iluminar en la vista 3D (1 = colores originales del sprite). */
const FIGURE_TONE = .94;

export class SpriteWorld {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(70, 1.6, .05, 45);
  private terrain = new THREE.Group();
  private actors = new THREE.Group();
  private box = new THREE.BoxGeometry(1, 1, 1);
  private plane = new THREE.PlaneGeometry(1, 1);
  private fogColor = new THREE.Color(); private fogObj = new THREE.Fog(0x000000, 8, 30);
  private stone = new THREE.IcosahedronGeometry(.16, 0);
  private stoneMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(.55, .49, .42) });
  private warningGeometry = new THREE.RingGeometry(.35, .55, 24);
  private warningMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(1, .12, .18), transparent: true, opacity: .7, side: THREE.DoubleSide, depthWrite: false });
  private warnings: THREE.Mesh[] = [];
  /** Polvo, piedritas, chispas y gotas del motor (g.parts) como cubitos instanciados. */
  private partMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: .9 }), 400);
  private partColor = new THREE.Color();
  private textures = new Map<CanvasImageSource, THREE.Texture>();
  private surfaces: THREE.MeshStandardMaterial[] = [];
  private billboards: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>[] = [];
  /** Figuras (jugador, compañeros, enemigos): sin luz, sombras recibidas, reflejos ni tono; sólo sus píxeles. */
  private figureBoards: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
  private figureIndex = 0;
  private stones: THREE.Mesh[] = [];
  private mapKey = '';
  private actorIndex = 0;
  private stoneIndex = 0;
  private playerTexture: THREE.CanvasTexture<HTMLCanvasElement | HTMLImageElement> | null = null;
  private aim = new THREE.Vector3();
  private effects: WorldEffects;
  private sun = new THREE.DirectionalLight();
  private ambient = new THREE.HemisphereLight();
  private lights: THREE.PointLight[] = [];
  lost = false;
  private reflection: Reflector;
  /** Baja reflejos, sombras y posproceso si el equipo no llega a ~45 fps (ver world-quality.ts). */
  private quality = new WorldQualityGovernor();
  private warmed = false;
  private environment: THREE.WebGLRenderTarget | null = null;
  private envRegion = '';
  private width = 320; private height = 200;
  private lastFrame = 0; private frameMs = 16;
  get stats() { const r=this.renderer.info; return {backend:'webgl2' as const,fps:Math.round(1000/this.frameMs),frameMs:this.frameMs,scale:gfxStore.get().renderScale,drsStep:this.quality.level,drawCalls:r.render.calls,lights:this.lights.filter(l=>l.intensity>0).length+2,shadowLights:this.sun.castShadow?1:0,memoryMB:(r.memory.textures*.1),width:this.width,height:this.height,lightW:this.width,lightH:this.height}; }
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ alpha: false, antialias: false, preserveDrawingBuffer: true });
    this.renderer.setSize(320, 200, false);
    this.renderer.setPixelRatio(1);
    // A lost GPU context (driver reset, tab switch on weak PCs) must not freeze the game: fall back until restored.
    const el=this.renderer.domElement; el.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;},false); el.addEventListener('webglcontextrestored',()=>{this.lost=false;},false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;
    // Leer el registro de cada sombreador obliga a esperar su compilación (congelaba el inicio de partida); sólo en desarrollo.
    this.renderer.debug.checkShaderErrors=!!import.meta.env?.DEV;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.scene.add(this.terrain, this.actors,this.sun,this.sun.target,this.ambient);
    this.partMesh.frustumCulled=false;this.partMesh.count=0;this.scene.add(this.partMesh);
    this.sun.shadow.mapSize.set(512,512);this.sun.shadow.camera.near=.1;this.sun.shadow.camera.far=45;
    this.sun.shadow.bias=-.001;this.sun.shadow.normalBias=.025;
    for(let i=0;i<8;i++){const light=new THREE.PointLight();this.lights.push(light);this.scene.add(light);}
    this.reflection=new Reflector(new THREE.PlaneGeometry(3,3),{textureWidth:256,textureHeight:256,color:new THREE.Color(.19,.25,.29),clipBias:.005});
    this.reflection.rotation.x=-Math.PI/2;this.reflection.visible=false;this.scene.add(this.reflection);
    this.effects=new WorldEffects(this.renderer,this.scene,this.camera);
  }
  private texture(image: CanvasImageSource) {
    const existing = this.textures.get(image); if (existing) return existing;
    const t = new THREE.Texture(image as HTMLCanvasElement);
    t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.NearestFilter; t.needsUpdate = true;
    this.textures.set(image, t); return t;
  }
  private pixels(data: Uint32Array | null | undefined) {
    if (!data) return null;
    const t = new THREE.DataTexture(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), 128, 128);
    t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.NearestFilter; t.needsUpdate = true;
    return t;
  }
  private rebuild(g: Game) {
    if(this.envRegion!==g.region.id){
      this.envRegion=g.region.id;this.environment?.dispose();
      const env=new THREE.DataTexture(buildEnvMap(128,64,[...g.region.ceiling],[...g.region.fog],[...g.region.floor],[[255,210,145],[110,150,210]]),128,64);
      env.colorSpace=THREE.SRGBColorSpace;env.mapping=THREE.EquirectangularReflectionMapping;env.needsUpdate=true;
      const pmrem=new THREE.PMREMGenerator(this.renderer);this.environment=pmrem.fromEquirectangular(env);this.scene.environment=this.environment.texture;env.dispose();pmrem.dispose();
    }
    let hash = g.floor; for (const c of g.map) hash = (hash * 31 + c) | 0;
    const key = `${g.floor}:${hash}:${g.camera.mode}:${Object.keys(g.regionTextures).join(',')}`; if (key === this.mapKey) return; this.mapKey = key;
    this.terrain.traverse(o => { if (o instanceof THREE.InstancedMesh) o.dispose(); }); this.terrain.clear();
    const overhead = g.camera.mode === 'top' || g.camera.mode === 'iso';
    // Los materiales se reutilizan (sólo cambian textura y color): desecharlos liberaba sus sombreadores y
    // cada piso o cambio de cámara los recompilaba, con un tirón visible.
    const wallMap = this.pixels(g.regionTextures[g.region.id] ?? g.tex), wallColor = new THREE.Color(...g.region.ceiling.map(v => Math.min(1, .55 + v / 300)) as [number, number, number]);
    const groundMaps = Array.from({ length: 4 }, (_, i) => this.pixels(g.groundTextures[i] ?? g.groundTextures[0] ?? g.tex));
    if (!this.surfaces.length) {
      this.surfaces.push(new THREE.MeshStandardMaterial({ map: wallMap, color: wallColor, roughness:.86, side: THREE.DoubleSide }),
        ...groundMaps.map((map, i) => new THREE.MeshStandardMaterial({ map, color: new THREE.Color(.8, .8, .8), roughness: i===1?.32:i===3?.48:.95, metalness:i===3?.12:0 })));
    } else {
      const maps = [wallMap, ...groundMaps];
      this.surfaces.forEach((m, i) => { const next = maps[i] ?? null; if ((m.map === null) !== (next === null)) m.needsUpdate = true; m.map?.dispose(); m.map = next; });
      this.surfaces[0]?.color.copy(wallColor);
    }
    const groups: { x: number; y: number; bottom: number; height: number }[][] = [[], [], [], [], []];
    for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) {
      const v = cellVolume(g.map[y * 40 + x] ?? 0);
      if (v && !(overhead && v[0] > 0)) groups[0]?.push({ x, y, bottom: v[0], height: overhead ? Math.min(v[1] - v[0], .9) : v[1] - v[0] });
      groups[1 + Math.max(0, Math.min(3, g.groundKind(x + .5, y + .5)))]?.push({ x, y, bottom: -.08, height: .08 });
    }
    const m = new THREE.Matrix4();
    groups.forEach((tiles, i) => { const surface = this.surfaces[i]; if (!surface) return; const mesh = new THREE.InstancedMesh(this.box, surface, tiles.length);
      tiles.forEach((t, n) => { m.compose(new THREE.Vector3(t.x + .5, t.bottom + t.height / 2, t.y + .5), new THREE.Quaternion(), new THREE.Vector3(1, t.height, 1)); mesh.setMatrixAt(n, m); });
      mesh.castShadow=i===0;mesh.receiveShadow=true;mesh.computeBoundingSphere(); this.terrain.add(mesh); });
  }
  private billboard(img: HTMLCanvasElement | HTMLImageElement | null | undefined, x: number, y: number, z: number, height: number, player = false, tilt = 0, live = false, glow = 0) {
    if (!img || Math.hypot(x - this.camera.position.x, y - this.camera.position.z) > 20) return;
    const actor = player || live || glow > 0;
    let mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial | THREE.MeshBasicMaterial> | undefined;
    if (actor) {
      // Figuras sin iluminación: luces, sombras, oclusión, reflejos y tono las emborronaban. Proyectan sombra igual.
      let f = this.figureBoards[this.figureIndex];
      if (!f) { f = new THREE.Mesh(this.plane, new THREE.MeshBasicMaterial({ transparent: false, alphaTest: .15, side: THREE.DoubleSide, toneMapped: false, fog: false, color: new THREE.Color(FIGURE_TONE, FIGURE_TONE, FIGURE_TONE) })); this.figureBoards.push(f); this.actors.add(f); }
      this.figureIndex++; f.receiveShadow = false; mesh = f;
    } else {
      let m = this.billboards[this.actorIndex];
      if (!m) { m = new THREE.Mesh(this.plane, new THREE.MeshStandardMaterial({ transparent: false, alphaTest: .15, side: THREE.DoubleSide, roughness:.8, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 0 })); this.billboards.push(m); this.actors.add(m); }
      this.actorIndex++; m.receiveShadow = true; m.material.envMapIntensity = .35; mesh = m;
    }
    mesh.visible = true; mesh.castShadow = true;
    if (player) { const texture = this.playerTexture ?? new THREE.CanvasTexture(img); if (texture.image !== img) texture.image = img; texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = texture.minFilter = THREE.NearestFilter; texture.needsUpdate = true; this.playerTexture = texture; mesh.material.map = texture; }
    else if (live) { const t = this.texture(img); t.needsUpdate = true; mesh.material.map = t; }
    else mesh.material.map = this.texture(img);
    // Same texture as emissive map on every scenery billboard (no shader recompiles).
    if (mesh.material instanceof THREE.MeshStandardMaterial) { mesh.material.emissiveMap = mesh.material.map; mesh.material.emissiveIntensity = 0; }
    mesh.position.set(x, z + height / 2, y); mesh.scale.set(height * img.width / img.height, height, 1);
    if(this.camera.position.y-z>4)mesh.quaternion.copy(this.camera.quaternion);
    else mesh.rotation.set(0, Math.atan2(this.camera.position.x - x, this.camera.position.z - y), 0);
    if (player && tilt) mesh.rotateX(-tilt * .6);
  }
  frame(g: Game, ctx: CanvasRenderingContext2D) {
    const now=performance.now(),gap=this.lastFrame?now-this.lastFrame:0;if(this.lastFrame)this.frameMs+=(gap-this.frameMs)*.1;this.lastFrame=now;
    // Sólo jugando: en menús se dibuja cada 0,2 s y no debe contar como lentitud.
    const lvl=g.mode==='play'&&gap>0&&gap<250?this.quality.update(this.frameMs,gap/1000):this.quality.level;
    const settings=gfxStore.get(), display={width:ctx.canvas.clientWidth,height:ctx.canvas.clientHeight}, aspect=display.width/Math.max(1,display.height);
    // Match the displayed aspect, so mobile no longer crops the player or aim ray.
    // Render 1:1 with the 320x200 output: no resampling, so sprites and textures keep crisp square pixels.
    const renderHeight=ctx.canvas.height,renderWidth=ctx.canvas.width;
    if(this.width!==renderWidth||this.height!==renderHeight){this.width=renderWidth;this.height=renderHeight;this.renderer.setSize(renderWidth,renderHeight,false);this.effects.resize(renderWidth,renderHeight);}
    this.camera.aspect=aspect;this.camera.updateProjectionMatrix();
    this.renderer.toneMapping=settings.tonemapper==='agx'?THREE.AgXToneMapping:THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=settings.exposure;
    this.renderer.shadowMap.enabled=settings.shadowQuality>0&&settings.backend!=='canvas2d'&&lvl<2;
    const shadowSize=settings.shadowQuality>1?1024:512;if(this.sun.shadow.mapSize.x!==shadowSize){this.sun.shadow.map?.dispose();this.sun.shadow.map=null;this.sun.shadow.mapSize.set(shadowSize,shadowSize);}
    this.rebuild(g); this.actorIndex = this.stoneIndex = this.figureIndex = 0;
    this.billboards.forEach(m => { m.visible = false; }); this.figureBoards.forEach(m => { m.visible = false; }); this.stones.forEach(m => { m.visible = false; }); this.warnings.forEach(m => { m.visible = false; });
    const mode = g.camera.mode, d = g.camera.distance, dx = Math.cos(g.ang), dy = Math.sin(g.ang);
    const view=viewPosition(mode,g.px,g.py,g.pz,g.ang,d);
    let x=view.x,y=view.y,h=view.z;
    if (mode === 'shoulder' || mode === 'front') {
      const tx = x, ty = y, n = Math.ceil(Math.hypot(tx-g.px,ty-g.py) / .05); x = g.px; y = g.py;
      for (let i = 1; i <= n; i++) { const nx = g.px + (tx - g.px) * i / n, ny = g.py + (ty - g.py) * i / n; if (g.solid(nx, ny, h - .15, .3)) break; x = nx; y = ny; }
    }
    this.camera.position.set(x, h, y);
    const ranged=g.slot===1, weapon=ranged?g.ranged:g.melee;
    const range=ranged?shotRange(weapon?.base?.range??8):weapon?.base?.range??1.5;
    const hit=traceAim({x:g.px,y:g.py,z:g.pz+.5-(g.crouching?.22:0)},g.ang,ranged?g.pitch:0,range,(x,y,z)=>g.solid(x,y,z,.02),g.enemies.filter(e=>!e.grabbed).map(e=>({x:e.x,y:e.y,z:e.z,radius:g.actorRadius(e),dead:e.dead})));
    // Rear view follows the weapon's forward pitch; spectator views keep the player in frame.
    if(mode==='shoulder')this.aim.set(g.px+dx*3,g.pz+.5+Math.tan(Math.max(-.7,Math.min(.7,g.pitch)))*3,g.py+dy*3);
    else this.aim.set(g.px,g.pz+.45,g.py);
    this.camera.lookAt(this.aim);this.camera.updateMatrixWorld();
    { const e=this.camera.matrixWorld.elements; let fx=-(e[8]??0),fy=-(e[10]??0); if(Math.hypot(fx,fy)<.2){fx=e[4]??0;fy=e[6]??0;} const fl=Math.hypot(fx,fy)||1; let rx=e[0]??1,ry=e[2]??0; const rl=Math.hypot(rx,ry)||1; rx/=rl;ry/=rl; g.viewBasis={fx:fx/fl,fy:fy/fl,rx,ry}; }
    const fog = this.fogColor.setRGB(...g.region.fog.map(v => Math.max(.08, v / 255)) as [number, number, number]); this.scene.background = fog; if(settings.fogQuality>0){this.fogObj.color.copy(fog);this.fogObj.far=26+4*settings.fogQuality;this.scene.fog=this.fogObj;}else this.scene.fog=null; // reused objects: a new Fog each frame forced material refreshes (stutter)
    const sun=zoneSun(g.region.id);if(sun){this.sun.color.setRGB(...sun.color);this.sun.intensity=.9+sun.intensity;this.sun.position.set(g.px-sun.dir[0]*8,g.pz+12,g.py-sun.dir[1]*8);this.sun.target.position.set(g.px,g.pz,g.py);}
    this.sun.castShadow=settings.shadowQuality>0&&lvl<2;const sd=settings.shadowDistance;Object.assign(this.sun.shadow.camera,{left:-sd,right:sd,top:sd,bottom:-sd});this.sun.shadow.camera.updateProjectionMatrix();
    this.ambient.color.setRGB(.55,.65,.78);this.ambient.groundColor.setRGB(.25,.18,.2);this.ambient.intensity=.8+settings.globalIllumination*.1;
    const sources=g.gfxLights().sort((a,b)=>(a.priority??2)-(b.priority??2)||Math.hypot(a.x-g.px,a.y-g.py)-Math.hypot(b.x-g.px,b.y-g.py)).slice(0,2+settings.lightQuality*2);
    // Lights stay visible (intensity 0 when unused): toggling visibility changes the light count and recompiles every shader, freezing combat.
    this.lights.forEach((l,i)=>{const src=sources[i];l.visible=true;if(!src){l.intensity=0;return;}l.position.set(src.x,src.z+.15,src.y);l.color.setRGB(src.r,src.g,src.b);l.intensity=src.intensity*2.4;l.distance=src.radius;l.decay=1.5;});
    const room=g.rooms.find(r=>g.px>=r.x&&g.px<r.x+r.w&&g.py>=r.y&&g.py<r.y+r.h);
    this.reflection.visible=lvl<1&&settings.reflectionQuality>0&&settings.backend!=='canvas2d'&&!!room&&(g.region.id==='port'||g.region.id==='aethryon'||g.groundKind(g.px,g.py)===3);
    if(room){const rx=room.x+room.w/2,ry=room.y+room.h/2;this.reflection.position.set(rx,g.floorHeight(rx,ry)+.012,ry);}
    const camAng = Math.atan2(g.py - y, g.px - x), pf = g.playerFrame(camAng);
    const ext = mode === 'top' || mode === 'iso' ? LEGIBILITY.aerialScale : LEGIBILITY.externalScale, glow = LEGIBILITY.emissive, cam = this.camera.position, focal = this.height / (2 * Math.tan(this.camera.fov * Math.PI / 360));
    /** Alto aproximado en pantalla (px de render) de una figura de `h` unidades en (ax, ay). */
    const shown = (h: number, ax: number, ay: number, az: number) => h * focal / Math.max(.3, Math.hypot(ax - cam.x, az + h / 2 - cam.y, ay - cam.z));
    if (pf?.img) { g.lastPlayerPose = { action: pf.action, dir: pf.dir }; this.billboard(legible(pf.img, RIM.self, true, shown(PLAYER_SPRITE_SCALE * ext * pf.img.height / CELL_H, g.px, g.py, g.pz)), g.px, g.py, g.pz, PLAYER_SPRITE_SCALE * ext * pf.img.height / CELL_H, true, pf.tilt, false, glow * .5); }
    g.enemyLabels = []; g.barkLabels = []; g.gfxCam = null;
    for (const r of g.remotes) { if (r.state === 'gone' || r.state === 'extracted') continue; const img = remoteFrame(r, Math.atan2(r.y - y, r.x - x), g.time + r.x * .37, g.floorHeight(r.x, r.y)); if (!img) continue;
      this.billboard(legible(img, r.color, true, shown(PLAYER_SPRITE_SCALE * ext * img.height / CELL_H, r.x, r.y, r.z)), r.x, r.y, r.z, PLAYER_SPRITE_SCALE * ext * img.height / CELL_H, false, 0, true, r.state === 'dead' ? 0 : glow);
      const p = new THREE.Vector3(r.x, r.z + 1.35 * ext, r.y).project(this.camera);
      if (p.z < 1 && p.z > -1) g.enemyLabels.push({ x: (p.x + 1) * 160, y: (1 - p.y) * 100, w: 22, depth: 1, hp: Math.max(0, r.hp / Math.max(1, r.hpMax)), brk: 0, name: g.remoteName(r), state: g.remoteLabel(r), elite: false, boss: false, miniBoss: false, tele: false, retreat: false, alert: false, notice: false, ally: r.color }); }
    for (const m of g.netMarks) { if (m.used) continue; this.billboard(g.sprites['rune'], m.x, m.y, g.floorHeight(m.x, m.y) + .2 + Math.sin(g.time * 3) * .05, .45);
      const p = new THREE.Vector3(m.x, g.floorHeight(m.x, m.y) + .9, m.y).project(this.camera);
      if (p.z < 1 && p.z > -1) g.enemyLabels.push({ x: (p.x + 1) * 160, y: (1 - p.y) * 100, w: 0, depth: 1, hp: 0, brk: 0, name: m.label, state: '', elite: true, boss: false, miniBoss: false, tele: false, retreat: false, alert: false, notice: false, ally: m.color }); }
    for (const e of g.enemies) { if (e.dead || e.ambush?.stage === 'hidden') continue; const t = ENEMY_TYPES[e.kind]; if (!t) continue;
      const image = g.cutEnemyFrame(e, g.frame(e.kind, e.tele > 0 ? 'attack' : e.hurt > 0 ? 'hurt' : e.aware ? 'alert' : 'idle', g.time * 8 % 12) ?? g.sprites[t.sprite]);
      const ev = g.enemyEvadeOffset(e);
      this.billboard(legible(image, enemyRim(e), false, shown(t.scale * ext, e.x, e.y, e.z)), e.x + ev.dx, e.y + ev.dy, e.z + ev.up, t.scale * ext, false, 0, false, glow);
      const p = new THREE.Vector3(e.x, e.z + t.scale * ext + .1, e.y).project(this.camera);
      if (p.z < 1 && p.z > -1) g.enemyLabels.push({ x: (p.x + 1) * 160, y: (1 - p.y) * 100, w: 24, depth: 1, hp: Math.max(0, e.hp / e.hpMax), brk: Math.max(0, e.brk / e.brkMax), name: t.name, state: '', elite: !!e.elite, boss: e.kind === 'librero', miniBoss: !!e.miniBoss, tele: e.tele > 0, retreat: false, alert: false, notice: false });
    }
    for (const b of g.barks) {
      const t = ENEMY_TYPES[b.e.kind]; if (!t) continue;
      const p = new THREE.Vector3(b.e.x, b.e.z + t.scale + .35, b.e.y).project(this.camera);
      if (p.z > -1 && p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1) g.barkLabels.push({ x: (p.x + 1) * 160, y: (1 - p.y) * 100, text: b.text, a: Math.min(1, b.t * 3), depth: 1 });
    }
    for (const k of g.pickups) { if (k.used) continue;
      const key = k.deco ?? ({ item: 'relic', shop: 'shop', portal: 'rune', note: 'book', folio: 'book', mapfrag: 'map', cipherlock: 'chest', palimpsest: 'palimpsesto', sanctuary: 'rose' } as Record<string, string>)[k.kind] ?? k.kind;
      this.billboard(g.frame(key, 'idle', k.bob * 12 % 12) ?? g.sprites[key], k.x, k.y, g.floorHeight(k.x, k.y) + (k.kind === 'decor' ? 0 : .08 + Math.sin(g.time * 2 + k.bob) * .03), k.kind === 'portal' ? PORTAL.height : k.kind === 'decor' || k.kind === 'shop' ? .65 : .28);
    }
    for(const p of g.scenicProps)this.billboard(g.frame(p.deco,'idle',g.time*8%12)??g.sprites[p.deco],p.x,p.y,g.floorHeight(p.x,p.y),.8);
    for (const p of g.projs) this.billboard(p.sprite ? g.projSprites[p.sprite] : g.sprites['rune'], p.x, p.y, p.z, p.size ?? .1);
    const rubble = [...(g.arena?.rubble ?? []), ...g.debris];
    rubble.forEach((r, i) => { let warning = this.warnings[i]; if (!warning) { warning = new THREE.Mesh(this.warningGeometry, this.warningMaterial); this.warnings.push(warning); this.actors.add(warning); } warning.visible = true; warning.rotation.x = -Math.PI / 2; warning.position.set(r.x, g.floorHeight(r.x, r.y) + .015, r.y); warning.scale.setScalar(1 + Math.sin(g.time * 15) * .15); });
    for (const r of rubble) { if (r.t > RUBBLE_FALL.duration) continue; let m = this.stones[this.stoneIndex]; if (!m) { m = new THREE.Mesh(this.stone, this.stoneMaterial); this.stones.push(m); this.actors.add(m); } this.stoneIndex++; m.visible = true; m.position.set(r.x, rubbleHeight(r.t, g.floorHeight(r.x, r.y)), r.y); m.rotation.set(g.time * 3, g.time * 2, 0); }
    { const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),pos=new THREE.Vector3(),sc=new THREE.Vector3(); let n=0;
      for(const p of (g.arcFx?.length?[...g.parts,...g.arcFx]:g.parts)){ if(n>=400)break; const sz=Math.max(.012,p.size)*(p.soft?1.4:1); pos.set(p.x,p.z,p.y);sc.setScalar(sz);q.setFromEuler(new THREE.Euler(p.x*7,p.y*5,0));m4.compose(pos,q,sc);this.partMesh.setMatrixAt(n,m4);this.partMesh.setColorAt(n,this.partColor.set(p.color));n++; }
      this.partMesh.count=n;this.partMesh.instanceMatrix.needsUpdate=true;if(this.partMesh.instanceColor)this.partMesh.instanceColor.needsUpdate=true; }
    if(lvl>=3)this.renderer.render(this.scene,this.camera);else this.effects.render(settings,g.region.id,g.time,g.hurtFlash); ctx.imageSmoothingEnabled=false; ctx.drawImage(this.renderer.domElement, 0, 0, ctx.canvas.width, ctx.canvas.height);
    if(g.mode==='play'){
      let projected=new THREE.Vector3(hit.x,hit.z,hit.y).project(this.camera);
      const offscreen=projected.z<=-1||projected.z>=1||Math.abs(projected.x)>.95||Math.abs(projected.y)>.95;
      if(offscreen){const near=Math.min(hit.distance,.8);projected=new THREE.Vector3(g.px+dx*near*Math.cos(ranged?g.pitch:0),g.pz+.5+Math.sin(ranged?g.pitch:0)*near,g.py+dy*near*Math.cos(ranged?g.pitch:0)).project(this.camera);}
      const sx=Math.max(10,Math.min(310,(projected.x+1)*160)),sy=Math.max(8,Math.min(192,(1-projected.y)*100));
      if(Number.isFinite(sx)&&Number.isFinite(sy)){
        g.worldReticle={x:sx/320,y:sy/200,enemy:hit.enemy&&!offscreen};
        if(mode!=='shoulder'){
          const start=new THREE.Vector3(g.px,g.pz+.5,g.py).project(this.camera);
          ctx.save();ctx.strokeStyle='rgba(242,228,204,.5)';ctx.lineWidth=.5;ctx.setLineDash([2,2]);ctx.beginPath();ctx.moveTo((start.x+1)*160,(1-start.y)*100);ctx.lineTo(sx,sy);ctx.stroke();ctx.restore();
        }
        // Logical canvas is stretched back to the screen after matching its aspect.
        ctx.save();ctx.translate(sx,sy);ctx.scale(1,aspect/1.6);ctx.lineWidth=.8;ctx.strokeStyle=hit.enemy?'#ffd34a':'#f2e4cc';ctx.fillStyle='#ff3355';ctx.fillRect(-.5,-.5,1,1);
        ctx.beginPath();if(ranged){ctx.moveTo(-4,0);ctx.lineTo(-2,0);ctx.moveTo(2,0);ctx.lineTo(4,0);ctx.moveTo(0,-4);ctx.lineTo(0,-2);ctx.moveTo(0,2);ctx.lineTo(0,4);}else ctx.arc(0,0,3,0,Math.PI*2);ctx.stroke();
        const charge=ranged?g.aimT:g.chargeT/(g.melee?.base?.rate??1);if(charge>.05){ctx.beginPath();ctx.arc(0,0,5,-Math.PI/2,-Math.PI/2+Math.min(1,charge)*Math.PI*2);ctx.stroke();}ctx.restore();
      }else g.worldReticle=null;
    }
  }
  /**
   * Compila en la pantalla de carga todos los sombreadores de la vista 3D (terreno, figuras, decorado,
   * escombros, reflejos, sombras y posproceso). Antes se compilaban al pulsar «Comenzar run» y la
   * partida se congelaba uno o varios segundos.
   */
  prewarm(g: Game, ctx: CanvasRenderingContext2D) {
    if (this.warmed || this.lost) return; this.warmed = true;
    try {
      // Cada nivel de calidad adaptable (sombras on/off, sin posproceso…) usa otras variantes de sombreador:
      // se compilan todas aquí para que bajar de calidad en plena partida no congele el juego varios segundos.
      const keep = this.quality.level;
      for (const l of [3, 2, 1, 0]) { this.quality.level = l; try { this.frame(g, ctx); } catch { /* sigue */ } }
      this.quality.level = keep;
      this.frame(g, ctx);
      const img = document.createElement('canvas'); img.width = img.height = 8; const c = img.getContext('2d'); if (c) { c.fillStyle = '#888'; c.fillRect(0, 0, 8, 8); }
      const fx = this.aim.x, fy = this.aim.z, fz = Math.max(0, this.aim.y - .5);
      this.billboard(img, fx, fy, fz, 1, true); this.billboard(img, fx, fy, fz, 1, false, 0, true, .4); this.billboard(img, fx, fy, fz, 1);
      const stone = new THREE.Mesh(this.stone, this.stoneMaterial), ring = new THREE.Mesh(this.warningGeometry, this.warningMaterial);
      stone.position.set(fx, fz + .3, fy); ring.position.set(fx, fz + .02, fy); this.actors.add(stone, ring);
      const refl = this.reflection.visible; this.reflection.visible = true; this.reflection.position.set(fx, fz + .01, fy);
      this.effects.render(gfxStore.get(), g.region.id, 0, 0);
      this.reflection.visible = refl; this.actors.remove(stone, ring);
      this.billboards.forEach(m => { m.visible = false; }); this.figureBoards.forEach(m => { m.visible = false; });
      this.playerTexture?.dispose(); this.playerTexture = null;
    } catch (err) { console.warn('[3d] precompilación omitida', err); }
  }
  dispose() {
    this.terrain.traverse(o => { if (o instanceof THREE.InstancedMesh) o.dispose(); });
    this.surfaces.forEach(m => { m.map?.dispose(); m.dispose(); }); this.textures.forEach(t => t.dispose()); this.playerTexture?.dispose();
    this.billboards.forEach(m => m.material.dispose()); this.figureBoards.forEach(m => m.material.dispose()); this.stoneMaterial.dispose(); this.warningMaterial.dispose(); this.warningGeometry.dispose();
    this.effects.dispose();this.reflection.geometry.dispose();this.reflection.dispose();this.environment?.dispose();this.sun.shadow.map?.dispose();this.box.dispose(); this.plane.dispose(); this.partMesh.geometry.dispose(); (this.partMesh.material as THREE.Material).dispose(); this.stone.dispose(); this.renderer.dispose();
  }
}