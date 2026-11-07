/** Local narrative archive. Events are the source of truth; online sources can implement ArchiveStore later. */
export const ARCHIVE_KEY = 'ars_anima_chronicles_v1';
export const INITIAL_TITLE = "IL'INCONNU";
export const METRICS = {
  hits: 'Golpes acertados', combos: 'Combos realizados', comboRecord: 'Récord de combo', kills: 'Enemigos derrotados', executions: 'Ejecuciones', parries: 'Parry perfectos', dodges: 'Esquivas perfectas', counters: 'Contraataques', unharmedKills: 'Bajas sin recibir daño', damageDealt: 'Daño realizado', damageTaken: 'Daño recibido', bosses: 'Jefes derrotados',
  rooms: 'Habitaciones descubiertas', secrets: 'Secretos encontrados', maps: 'Mapas y fragmentos', documents: 'Documentos recogidos', chests: 'Cofres abiertos', mechanisms: 'Mecanismos activados', routes: 'Rutas alternativas', quietDoors: 'Puertas sigilosas', brokenDoors: 'Puertas derribadas', locks: 'Cerraduras forzadas', evaded: 'Encuentros evadidos', ambushes: 'Bajas por emboscada', alarms: 'Alertas provocadas',
  completed: 'Niveles completados', failed: 'Expediciones fallidas', seconds: 'Tiempo de supervivencia (s)', rests: 'Descansos', food: 'Alimentos consumidos', drinks: 'Bebidas consumidas', wounds: 'Heridas sufridas', criticalEscapes: 'Escapes con salud <5 %', books: 'Libros encontrados', investigated: 'Documentos investigados', puzzles: 'Acertijos resueltos', words: 'Palabras descubiertas', languages: 'Idiomas identificados', memories: 'Recuerdos recuperados', forbidden: 'Escrituras prohibidas', items: 'Objetos encontrados', resources: 'Unidades de recursos obtenidas', used: 'Objetos consumidos', heals: 'Objetos curativos usados', pacts: 'Pactos realizados', shots: 'Disparos efectuados', objectives: 'Objetivos cumplidos', objectiveFails: 'Objetivos fallidos', extraordinary: 'Hazañas extraordinarias',
} as const;
export type Metric = keyof typeof METRICS;
export type Stats = Record<Metric, number>;
export type Outcome = 'active' | 'transition' | 'won' | 'death' | 'collapse' | 'abandoned';
export interface Identity { playerId: string; characterId: string; name: string; classId: string; className: string; title: string }
export interface ChronicleEvent { id: string; kind: Metric | 'ending'; amount: number; at: number; floor: number; difficulty: string; context: string; conditions: Record<string, boolean | number | string> }
export interface Deed { id: string; eventId: string; label: string; count: number; text: string; at: number; floor: number; difficulty: string; context: string; conditions: ChronicleEvent['conditions'] }
export interface Title { id: string; name: string; meaning: string; language: string; fictional: boolean; requirement: string; deedId: string }
export interface Expedition { id: string; identity: Identity; startedAt: number; endedAt?: number; outcome: Outcome; cause: string; difficulty: string; floor: number; events: ChronicleEvent[]; deeds: Deed[]; stats: Stats; score: number; floorDamage: number; floorKills: number; cleanChain: number; resultText: string }
export interface Character { id: string; playerId: string; name: string; classId: string; className: string; equipped: string; titles: Title[] }
export interface Archive { v: 1; characters: Character[]; expeditions: Expedition[] }
export interface ArchiveStore { getItem(key: string): string | null; setItem(key: string, value: string): void }
const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const emptyStats = (): Stats => Object.fromEntries(Object.keys(METRICS).map(k => [k, 0])) as Stats;
export const TITLES: Title[] = [
  { id: 'unknown', name: INITIAL_TITLE, meaning: 'El Desconocido / Aquel cuya identidad no se conoce', language: 'Francés estilizado', fictional: false, requirement: 'Identidad inicial', deedId: '' },
  { id: 'incognito', name: 'INCOGNITO', meaning: 'Bajo identidad desconocida', language: 'Italiano / uso europeo', fictional: false, requirement: 'Completar un nivel sin disparar ni provocar alertas, abriendo un pasaje sigiloso', deedId: 'silent-passage' },
  { id: 'outis', name: 'OUTIS', meaning: 'Nadie', language: 'Griego antiguo (οὖτις)', fictional: false, requirement: 'Completar un nivel sin eliminar enemigos y descubrir una ruta alternativa', deedId: 'nobody' },
  { id: 'nemo', name: 'NEMO', meaning: 'Nadie', language: 'Latín', fictional: false, requirement: 'Escapar del colapso con menos del 5 % de salud', deedId: 'critical-return' },
  { id: 'absent', name: "L'ABSENT", meaning: 'El Ausente', language: 'Francés', fictional: false, requirement: 'Completar un nivel evadiendo un encuentro por una ruta alternativa', deedId: 'absent-route' },
  { id: 'forgotten', name: "L'OUBLIÉ", meaning: 'El Olvidado', language: 'Francés', fictional: false, requirement: 'Descifrar un documento sin pistas y recuperar su recuerdo', deedId: 'erased-memory' },
  { id: 'last', name: 'LE DERNIER', meaning: 'El Último', language: 'Francés', fictional: false, requirement: 'Atravesar el portal durante el último segundo del colapso', deedId: 'last-second' },
  { id: 'unknown-path', name: 'UNBEKANNT', meaning: 'Desconocido', language: 'Alemán', fictional: false, requirement: 'Completar un nivel con un secreto y el mapa descubierto', deedId: 'unmapped' },
  { id: 'nameless', name: 'LE SANS-NOM', meaning: 'El Sin Nombre', language: 'Francés', fictional: false, requirement: 'Vencer al jefe sin recibir daño durante el nivel', deedId: 'unscarred-boss' },
  { id: 'unknown-blade', name: "L'INCONNU DU FER", meaning: 'El Desconocido del Hierro', language: 'Francés', fictional: false, requirement: 'Vencer al jefe con golpes cuerpo a cuerpo y sin disparar en ese nivel', deedId: 'blade-strategy' },
  { id: 'unknown-motion', name: "L'INCONNU EN VOL", meaning: 'El Desconocido en Vuelo', language: 'Francés', fictional: false, requirement: 'Encadenar un golpe aéreo y un golpe en dash sin recibir daño entre ambos', deedId: 'moving-shadow' },
  { id: 'unknown-riposte', name: "L'INCONNU DU CONTRE-JOUR", meaning: 'El Desconocido a Contraluz', language: 'Francés; metáfora de una silueta irreconocible', fictional: false, requirement: 'Contraatacar tras un parry perfecto y derrotar al enemigo con ese golpe', deedId: 'riposte-strategy' },
];
export function readArchive(store?: ArchiveStore): Archive {
  try { const a = JSON.parse((store ?? localStorage).getItem(ARCHIVE_KEY) ?? 'null'); if (a?.v === 1 && Array.isArray(a.characters) && Array.isArray(a.expeditions)) return a; } catch { /* offline empty archive */ }
  return { v: 1, characters: [], expeditions: [] };
}
export function writeArchive(a: Archive, store?: ArchiveStore) { (store ?? localStorage).setItem(ARCHIVE_KEY, JSON.stringify(a)); }
export function scoreBreakdown(s: Stats, floor: number, difficulty: string, outcome: Outcome) {
  const mult = ({ historia: .75, facil: .85, normal: 1, dificil: 1.25, pesadilla: 1.5 } as Record<string, number>)[difficulty] ?? 1;
  const lines = [
    { label: 'Progresión', points: Math.max(0, floor - 1) * 200 + s.completed * 150 + s.objectives * 100 },
    { label: 'Combate', points: s.kills * 8 + s.bosses * 300 + s.executions * 20 + s.parries * 10 + s.dodges * 10 + s.combos * 20 + Math.min(200, s.comboRecord * 4) },
    { label: 'Exploración', points: s.rooms * 12 + s.secrets * 120 + s.maps * 80 + s.chests * 20 + s.mechanisms * 40 + s.routes * 80 },
    { label: 'Sigilo', points: s.quietDoors * 30 + s.evaded * 20 + s.ambushes * 25 },
    { label: 'Supervivencia', points: Math.min(300, Math.floor(s.seconds / 60) * 5) + s.criticalEscapes * 150 },
    { label: 'PALIMPSESTOS', points: s.books * 30 + s.documents * 20 + s.puzzles * 150 + s.words * 25 + s.memories * 100 },
    { label: 'Hazañas extraordinarias', points: s.extraordinary * 200 },
    { label: 'Penalizaciones', points: -s.objectiveFails * 50 -Math.floor(s.damageTaken / 5) -(outcome === 'death' || outcome === 'collapse' ? 100 : outcome === 'abandoned' ? 50 : 0) },
  ];
  return { lines, multiplier: mult, total: Math.max(0, Math.round(lines.reduce((n, l) => n + l.points, 0) * mult)) };
}
export function narrate(identity: Identity, label: string, count: number, execution: string, variant = 0) {
  const who = `${identity.name}, de la senda ${identity.className}, bajo el título ${identity.title}`;
  const endings = ['La tinta conserva lo que el mundo intenta borrar.', 'Hasta el olvido ha tomado nota.', 'Ningún testigo prometió contarlo. El archivo sí.', 'La discreción del destino deja mucho que desear.'];
  return `${who}, ha conseguido ${label}. Lo ha logrado ${count} ${count === 1 ? 'vez' : 'veces'}, mediante ${execution}. ${endings[variant % endings.length]}`;
}
export function resultNarrative(r: Expedition, outcome: Outcome) {
  const who = `${r.identity.name}, de la senda ${r.identity.className}, ${r.identity.title}`;
  const detail = `${r.stats.kills} adversarios derrotados, ${r.stats.rooms} habitaciones descubiertas y ${Math.floor(r.stats.seconds / 60)} minutos de supervivencia.`;
  if (outcome === 'transition') return `${who}, ha sobrevivido a otro fragmento de una creación moribunda. ${detail} Su camino continúa.`;
  if (outcome === 'won') return `${who}, ha abandonado el último lugar condenado al olvido. ${detail} Ha llegado más lejos de lo que sus propias huellas podían anticipar. Por ahora, su existencia continúa.`;
  if (outcome === 'collapse') return `${who}, no consiguió alcanzar el portal. El lugar ha dejado de existir. Esta vez, tampoco hubo regreso. ${detail}`;
  if (outcome === 'abandoned') return `${who}, dejó su camino inconcluso. El archivo conserva sus méritos, pero no inventa un regreso. ${detail}`;
  return `${who}, ha caído: ${r.cause || 'causa desconocida'}. Su expedición termina aquí. Sus huellas permanecerán en los registros, aunque su existencia no. ${detail}`;
}
/** Storage limits: totals live in stats, so old high-frequency events can be dropped safely. */
export const STORED_EVENTS = 150, LIVE_EVENTS = 1500, MAX_EXPEDITIONS = 25, PERSIST_EVERY_MS = 1500;
const FREQUENT = new Set<string>(['hits', 'shots', 'damageTaken', 'dodges', 'parries', 'combos', 'comboRecord', 'seconds']);
/** Keeps memory bounded: drops the oldest frequent events of previous floors first, then of any floor. */
export function trimEvents(r: Expedition) {
  if (r.events.length <= LIVE_EVENTS) return;
  const extra = r.events.length - LIVE_EVENTS; let removed = 0;
  r.events = r.events.filter(e => { if (removed < extra && FREQUENT.has(e.kind) && e.floor < r.floor) { removed++; return false; } return true; });
  if (r.events.length > LIVE_EVENTS) { const keep = r.events.filter(e => !FREQUENT.has(e.kind)); const freq = r.events.filter(e => FREQUENT.has(e.kind)).slice(-(LIVE_EVENTS - Math.min(keep.length, LIVE_EVENTS - 200))); r.events = [...keep.slice(-(LIVE_EVENTS - freq.length)), ...freq].sort((a, b) => a.at - b.at); }
}
export class ChronicleKeeper {
  onTitle: (title: Title) => void = () => {};
  run: Expedition | null = null;
  error = '';
  constructor(private store?: ArchiveStore) {}
  private lastPersist = 0; private flushHooked = false; private pending: ReturnType<typeof setTimeout> | null = null;
  /** Persist at most every ~1.5 s for high-frequency combat events (avoids hitches and memory growth). */
  persistSoon() {
    const now = Date.now(); if ((this.run?.events.length ?? 0) < 200 || now - this.lastPersist >= PERSIST_EVERY_MS) { this.persist(); return; }
    if (!this.flushHooked && typeof window !== 'undefined') { this.flushHooked = true; const flush = () => { if (this.pending) this.persist(); }; window.addEventListener('pagehide', flush); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); }); }
    if (!this.pending) this.pending = setTimeout(() => { this.pending = null; this.persist(); }, PERSIST_EVERY_MS);
  }
  persist() {
    if (!this.run) return;
    if (this.pending) { clearTimeout(this.pending); this.pending = null; } this.lastPersist = Date.now();
    trimEvents(this.run);
    const saved = structuredClone(this.run); if (saved.events.length > STORED_EVENTS) saved.events = saved.events.slice(-STORED_EVENTS);
    const a = readArchive(this.store); a.expeditions = [saved, ...a.expeditions.filter(r => r.id !== this.run?.id)].slice(0, MAX_EXPEDITIONS);
    try { writeArchive(a, this.store); this.error = ''; } catch { this.error = 'El archivo no pudo guardarse: el almacenamiento del dispositivo está lleno o bloqueado.'; }
  }
  start(playerId: string, name: string, classId: string, className: string, difficulty: string, id: string = uid()) {
    const a = readArchive(this.store);
    let c = a.characters.find(c => c.playerId === playerId && c.name === name && c.classId === classId);
    if (!c) { c = { id: uid(), playerId, name, classId, className, equipped: INITIAL_TITLE, titles: [TITLES[0] as Title] }; a.characters.push(c); }
    try { writeArchive(a, this.store); } catch { this.error = 'No se pudo guardar la identidad.'; }
    this.run = { id, identity: { playerId, characterId: c.id, name, classId, className, title: INITIAL_TITLE }, startedAt: Date.now(), outcome: 'active', cause: '', difficulty, floor: 1, events: [], deeds: [], stats: emptyStats(), score: 0, floorDamage: 0, floorKills: 0, cleanChain: 0, resultText: '' };
    this.persist(); return this.run;
  }
  restore(id: string) { this.run = readArchive(this.store).expeditions.find(r => r.id === id && r.outcome === 'active') ?? null; return this.run; }
  event(kind: Metric, amount = 1, context = '', conditions: ChronicleEvent['conditions'] = {}, id: string = uid(), floor = this.run?.floor ?? 1) {
    const r = this.run; if (!r || r.outcome !== 'active' || r.events.some(e => e.id === id) || !Number.isFinite(amount) || amount <= 0) return false;
    const e: ChronicleEvent = { id, kind, amount, at: Date.now(), floor, difficulty: r.difficulty, context, conditions }; r.events.push(e); r.floor = Math.max(r.floor, floor);
    if (kind === 'comboRecord') r.stats[kind] = Math.max(r.stats[kind], amount); else r.stats[kind] += amount;
    if (kind === 'damageTaken') { r.floorDamage += amount; r.cleanChain = 0; }
    if (kind === 'kills') { r.floorKills += amount; if (conditions['unharmed']) r.stats.unharmedKills += amount; if (conditions['ambush']) r.stats.ambushes += amount; }
    if (kind === 'hits') {
      r.cleanChain++; if (r.cleanChain % 15 === 0) this.deed('clean-combo', 'encadenar 15 ataques sin recibir daño', e);
      if (conditions['aerial'] || conditions['dash']) {
        const recent = r.events.slice(r.events.map(x => x.kind).lastIndexOf('damageTaken') + 1).filter(x => x.floor === floor && x.kind === 'hits');
        if (recent.some(x => x.conditions['aerial']) && recent.some(x => x.conditions['dash'])) this.deed('moving-shadow', 'combinar filo aéreo y dash sin recibir daño', e);
      }
    }
    if (kind === 'bosses' && r.floorDamage === 0) this.deed('unscarred-boss', 'derrotar al guardián sin recibir daño durante el nivel', e);
    if (kind === 'bosses' && r.events.some(x => x.floor === floor && x.kind === 'hits' && x.conditions['ranged'] === false) && !r.events.some(x => x.floor === floor && x.kind === 'shots')) this.deed('blade-strategy', 'vencer al guardián mediante armamento cuerpo a cuerpo, sin disparar', e);
    if (kind === 'kills' && conditions['riposte']) this.deed('riposte-strategy', 'eliminar mediante el contraataque de un parry perfecto', e);
    if (kind === 'puzzles' && conditions['noHints'] && conditions['memory']) this.deed('erased-memory', 'reconstruir un recuerdo borrado sin pistas', e);
    if (kind === 'combos' && conditions['complex']) this.deed('complex-combo', 'combinar tres mecánicas distintas en combate', e);
    if (['rests', 'food', 'drinks', 'pacts', 'puzzles', 'secrets'].includes(kind) && (r.stats[kind] === 1 || r.stats[kind] % 5 === 0)) this.deed(`recognition-${kind}`, METRICS[kind].toLowerCase(), e, false);
    r.score = scoreBreakdown(r.stats, r.floor, r.difficulty, r.outcome).total; if (FREQUENT.has(kind)) this.persistSoon(); else this.persist(); return true;
  }
  deed(id: string, label: string, e: ChronicleEvent, extraordinary = true) {
    const r = this.run; if (!r || r.deeds.some(d => d.id === id && d.eventId === e.id)) return;
    if (['moving-shadow', 'complex-combo'].includes(id) && r.deeds.some(d => d.id === id && d.floor === e.floor)) return;
    const previous = r.deeds.filter(d => d.id === id).length;
    const count = id.startsWith('recognition-') && e.kind !== 'ending' ? r.stats[e.kind] : previous + 1;
    r.deeds.push({ id, eventId: e.id, label, count, text: narrate(r.identity, label, count, e.context || 'las condiciones registradas en la expedición', r.deeds.length), at: e.at, floor: e.floor, difficulty: e.difficulty, context: e.context, conditions: e.conditions });
    if (extraordinary) r.stats.extraordinary++;
    const a = readArchive(this.store); const c = a.characters.find(c => c.id === r.identity.characterId);
    const t = TITLES.find(t => t.deedId === id); if (c && t && !c.titles.some(x => x.id === t.id)) { c.titles.push(t); try { writeArchive(a, this.store); this.onTitle(t); } catch { this.error = 'No se pudo guardar el título.'; } }
  }
  equip(titleId: string) {
    const r = this.run; if (!r || r.outcome !== 'active') return false;
    const a = readArchive(this.store), c = a.characters.find(c => c.id === r.identity.characterId), t = c?.titles.find(t => t.id === titleId);
    if (!c || !t) return false; c.equipped = t.name; r.identity.title = t.name;
    try { writeArchive(a, this.store); } catch { return false; } this.persist(); return true;
  }
  finish(outcome: Outcome, floor: number, seconds: number, cause = '', conditions: ChronicleEvent['conditions'] = {}) {
    const r = this.run; if (!r || r.outcome !== 'active') return r;
    this.syncTime(seconds); r.floor = floor; r.cause = cause;
    const e: ChronicleEvent = { id: `ending-${floor}-${outcome}`, kind: 'ending', amount: 1, at: Date.now(), floor, difficulty: r.difficulty, context: conditions['collapse'] ? 'el portal durante el derrumbe' : 'el objetivo y el portal del nivel', conditions };
    if (r.events.some(x => x.id === e.id)) return r;
    r.events.push(e);
    if (outcome === 'transition' || outcome === 'won') {
      r.stats.completed++;
      const fs = (k: Metric) => r.events.filter(x => x.floor === floor && x.kind === k).reduce((n,x) => n + x.amount, 0);
      if (r.floorKills === 0 && fs('routes') > 0) this.deed('nobody', 'atravesar un nivel sin eliminar enemigos por una ruta alternativa', e);
      if (fs('quietDoors') > 0 && fs('alarms') === 0 && fs('shots') === 0) this.deed('silent-passage', 'cruzar en silencio sin disparos ni alertas', e);
      if (fs('evaded') > 0 && fs('routes') > 0) this.deed('absent-route', 'evadir un encuentro mediante una ruta alternativa', e);
      if (fs('secrets') > 0 && fs('maps') > 0) this.deed('unmapped', 'cartografiar un nivel y descubrir su secreto', e);
      if (conditions['collapse'] && Number(conditions['healthShare']) < .05) { r.stats.criticalEscapes++; this.deed('critical-return', 'escapar del colapso con menos del 5 % de salud', e); }
      if (conditions['collapse'] && Number(conditions['remaining']) > 0 && Number(conditions['remaining']) <= 1) this.deed('last-second', 'escapar durante el último segundo del colapso', e);
      if (outcome === 'won' && r.stats.heals === 0) this.deed('no-healing', 'completar la expedición sin objetos curativos', e);
    } else r.stats.failed++;
    r.resultText = resultNarrative(r, outcome);
    if (outcome !== 'transition') { r.outcome = outcome; r.endedAt = Date.now(); }
    r.score = scoreBreakdown(r.stats, floor, r.difficulty, outcome).total; this.persist(); return r;
  }
  nextFloor(floor: number) { if (this.run?.outcome === 'active') { this.run.floor = floor; this.run.floorDamage = 0; this.run.floorKills = 0; this.run.cleanChain = 0; this.persist(); } }
  syncTime(seconds: number) {
    const r = this.run; if (!r || r.outcome !== 'active') return;
    const n = Math.floor(seconds); const delta = n - r.stats.seconds; if (delta > 0) this.event('seconds', delta, 'tiempo activo de juego', {}, `time-${n}`);
  }
}
export function leaderboard(a: Archive) {
  return a.characters.map(c => {
    const runs = a.expeditions.filter(r => r.identity.characterId === c.id);
    return { ...c, title: c.equipped, floor: Math.max(0, ...runs.map(r => r.floor)), bosses: runs.reduce((n,r) => n+r.stats.bosses,0), deeds: runs.reduce((n,r) => n+r.deeds.length,0), wins: runs.filter(r => r.outcome === 'won').length, losses: runs.filter(r => ['death','collapse','abandoned'].includes(r.outcome)).length, score: runs.reduce((n,r) => n+r.score,0), last: Math.max(0,...runs.map(r => r.endedAt ?? r.startedAt)) };
  }).filter(c => a.expeditions.some(r => r.identity.characterId === c.id));
}