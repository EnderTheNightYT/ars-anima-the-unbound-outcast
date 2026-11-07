import { detectBeats, musicFades, onBeat, RHYTHM } from './beat';
export type Sound = 'swing' | 'shot' | 'hit' | 'break' | 'kill' | 'hurt' | 'dash' | 'jump' | 'land' | 'pickup' | 'portal' | 'explosion' | 'level' | 'event' | 'parry' | 'block' | 'reload' | 'pact' | 'terror' | 'retreat' | 'rubble' | 'cloud' | 'step' | 'merchant' | 'eat' | 'drink' | 'bandage' | 'mirror' | 'sit' | 'book' | 'map' | 'craft' | 'loot' | 'lootRare' | 'lootEpic' | 'coin' | 'combo' | 'pound' | 'ricochet' | 'boss' | 'enemy' | 'notice' | 'drip' | 'menu' | 'charged' | 'resource' | 'chest' | 'aim' | 'shotCharged' | 'chargeTick' | 'chargeReady' | 'shopBuy' | 'shopSell' | 'shopSelect' | 'shopDeny' | 'bonk' | 'chargedShotRelease';
/** Voces por arma/estilo: [pitch, onda, ruido(cutoff), duración×]. */
const WEAPON_VOICE: Record<string, [number, OscillatorType, number, number]> = {
  sword: [1.3, 'sawtooth', 5200, .9], dagger: [1.8, 'triangle', 7000, .6], axe: [.75, 'square', 1600, 1.2], hammer: [.5, 'square', 900, 1.5], mace: [.55, 'square', 1100, 1.4],
  spear: [1.1, 'triangle', 4200, 1], staff: [.9, 'sine', 2600, 1.1], fist: [.7, 'sine', 1300, .7], scythe: [1.0, 'sawtooth', 3800, 1.3], whip: [2.2, 'triangle', 8000, .5],
  pistol: [1.4, 'square', 4000, .7], rifle: [.9, 'sawtooth', 2600, 1.1], shotgun: [.6, 'sawtooth', 1500, 1.4], bow: [1.6, 'triangle', 6000, .6], crossbow: [1.2, 'triangle', 4500, .8], magic: [1.5, 'sine', 3000, 1.2],
  blunt: [.55, 'square', 1000, 1.4], slash: [1.3, 'sawtooth', 5000, .9], pierce: [1.7, 'triangle', 6500, .6], crit: [1.6, 'square', 6000, 1.1], ranged: [1.2, 'square', 3000, .8],
};
function hashVoice(k: string): [number, OscillatorType, number, number] {
  let h = 0; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  const waves: OscillatorType[] = ['sawtooth', 'square', 'triangle', 'sine'];
  return [.55 + (h % 100) / 85, waves[(h >> 7) % 4]!, 800 + (h >> 3) % 5000, .7 + ((h >> 11) % 8) / 10];
}
/** Familia sonora del disparo cargado según el tipo de arma a distancia. */
export function CHARGED_FAMILY(type: string) {
  const t = type.toUpperCase();
  if (t.includes('SUBFUSIL')) return 'smg';
  if (t.includes('AMETRALLADORA')) return 'mg';
  if (t.includes('REVOLVER')) return 'revolver';
  if (t.includes('PISTOL')) return 'pistol';
  if (t.includes('ESCOPETA')) return 'shotgun';
  if (t.includes('FUSIL') || t.includes('RIFLE')) return 'rifle';
  if (t.includes('BALLESTA')) return 'crossbow';
  if (t.includes('ARCO')) return 'bow';
  if (t.includes('FOCO')) return 'focus';
  return 'other';
}
export function voiceOf(k: string) { const lk = k.toLowerCase(); const hit = Object.keys(WEAPON_VOICE).find(w => lk.includes(w)); return hit ? WEAPON_VOICE[hit]! : hashVoice(lk); }
const tones: Record<Sound, [number, number, number]> = {
  step: [85, 60, .05], merchant: [520, 780, .2], eat: [210, 150, .1], drink: [400, 900, .16], bandage: [300, 260, .2], mirror: [1200, 2400, .35], sit: [140, 90, .15], book: [600, 350, .22], map: [700, 500, .14], craft: [900, 300, .12], loot: [500, 700, .1], lootRare: [520, 1040, .2], lootEpic: [440, 1760, .45], coin: [1500, 2100, .07], combo: [660, 1320, .16], pound: [400, 60, .3], ricochet: [2200, 900, .09], boss: [55, 40, 1.4], enemy: [140, 90, .22], notice: [880, 880, .05], drip: [1800, 600, .06], menu: [700, 700, .03], charged: [180, 40, .25],
  aim: [600, 1100, .08], chargeTick: [300, 400, .05], chargeReady: [900, 1800, .12], shopBuy: [1500, 2100, .07], shopSell: [900, 600, .1], shopSelect: [800, 800, .03], shopDeny: [160, 110, .18], bonk: [120, 50, .16], chargedShotRelease: [90, 22, .3], shotCharged: [90, 22, .3], resource: [340, 520, .09], chest: [180, 120, .35],
  rubble: [95, 24, .38], cloud: [310, 65, .75],
  terror: [1380, 36, .65], retreat: [720, 260, .2],
  swing: [260, 60, .12], shot: [120, 28, .15], hit: [180, 45, .08], break: [590, 100, .23], kill: [170, 36, .18], hurt: [90, 40, .2], dash: [100, 680, .13], jump: [170, 560, .14], land: [70, 30, .14], pickup: [580, 1160, .12], portal: [180, 980, .6], explosion: [65, 20, .5], level: [440, 880, .45], event: [250, 70, .4], parry: [880, 180, .18], block: [130, 90, .08], reload: [420, 760, .22], pact: [160, 990, .42],
};
export class RetroAudio {
  context: AudioContext | null = null;
  master: GainNode | null = null;
  muted = false;
  disposers: (() => void)[] = [];
  retreatVol = 1;
  active = 0;
  timer: ReturnType<typeof setInterval> | null = null;
  step = 0;
  region = 0;
  playing = false;
  last: Partial<Record<Sound, number>> = {};
  musicGain: GainNode | null = null;
  musicMute: GainNode | null = null;
  musicBuf: AudioBuffer | null = null;
  musicSrc: AudioBufferSourceNode | null = null;
  musicStart = 0;
  musicLoading = false;
  beats: number[] = [];
  musicUrl = '';
  /** Descarga y analiza la canción (golpes graves) una sola vez. */
  async loadMusic(url: string) {
    this.musicUrl = url;
    if (!this.context || this.musicBuf || this.musicLoading) return;
    this.musicLoading = true;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Música no disponible (${response.status})`);
      const data = await response.arrayBuffer();
      const buf = await this.context.decodeAudioData(data);
      const mono = new Float32Array(buf.length);
      for (let channel = 0; channel < buf.numberOfChannels; channel++) {
        const samples = buf.getChannelData(channel);
        for (let i = 0; i < mono.length; i++) mono[i] = (mono[i] ?? 0) + (samples[i] ?? 0) / buf.numberOfChannels;
      }
      this.beats = detectBeats(mono, buf.sampleRate);
      this.musicBuf = buf;
    } catch (e) { console.error('[music]', e); } finally { this.musicLoading = false; }
  }
  get musicPlaying() { return !!this.musicSrc; }
  /** offset (s): empezar en ese punto de la canción (multijugador: compás común con el servidor). */
  startMusic(offset = 0) {
    const c = this.context;
    if (!c || this.musicSrc) return;
    if (!this.musicBuf) { if (this.musicUrl) void this.loadMusic(this.musicUrl); return; }
    if (!this.musicGain) { this.musicMute = c.createGain(); this.musicMute.gain.value = this.muted ? 0 : 1; this.musicMute.connect(c.destination); this.musicGain = c.createGain(); this.musicGain.connect(this.musicMute); }
    this.playMusicPass(offset);
    this.playing = false;
  }
  /** Una pasada de la canción: sube de a poco al empezar y se apaga al final; al terminar vuelve a empezar. */
  private playMusicPass(offset = 0) {
    const c = this.context, buf = this.musicBuf, gain = this.musicGain;
    if (!c || !buf || !gain) return;
    const now = c.currentTime, dur = buf.duration, off = Math.max(0, Math.min(dur - 1, offset || 0)), left = dur - off;
    const { fadeIn, fadeOut } = musicFades(dur);
    const vol = RHYTHM.musicVolume;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + Math.min(fadeIn, off > 0 ? 1.5 : fadeIn, left / 2));
    if (left > fadeOut + 1) gain.gain.setValueAtTime(vol, now + left - fadeOut);
    gain.gain.linearRampToValueAtTime(0.0001, now + left);
    const src = c.createBufferSource(); src.buffer = buf; src.connect(gain);
    src.onended = () => { if (this.musicSrc !== src) return; src.disconnect(); this.musicSrc = null; this.playMusicPass(); };
    this.musicStart = now - off; src.start(now, off); this.musicSrc = src;
  }
  stopMusic() { const s = this.musicSrc; this.musicSrc = null; try { s?.stop(); } catch { /* ya parado */ } s?.disconnect(); }
  /** Posición actual dentro de la canción (s). */
  songTime() { const c = this.context, b = this.musicBuf; if (!c || !b || !this.musicSrc) return NaN; const lag = (c.outputLatency || 0) + (c.baseLatency || 0); return ((c.currentTime - this.musicStart - lag) % b.duration + b.duration) % b.duration; }
  /** ¿Estamos sobre un golpe de percusión grave ahora mismo? */
  onBeat() { return !this.muted && this.musicPlaying && onBeat(this.beats, this.songTime()); }
  unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain(); this.master.gain.value = this.muted ? 0 : .22;
      const filter = this.context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 2800;
      this.master.connect(filter); filter.connect(this.context.destination);
      this.timer = setInterval(() => {
        if (!this.playing || this.muted) return;
        const notes = [0, 7, 10, 7, 3, 7, 12, 10];
        const f = 110 * 2 ** (((notes[this.step++ % notes.length] ?? 0) + this.region * 2) / 12);
        this.tone(f, f, .28, 'triangle', .14);
        if (this.step % 4 === 0) this.tone(f / 2, f / 2, .5, 'square', .06);
      }, 360);
    }
    void this.context.resume();
  }
  toggle() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : .22; if (this.musicMute) this.musicMute.gain.value = this.muted ? 0 : 1; }
  tone(from: number, to: number, duration: number, type: OscillatorType = 'square', volume = .5) {
    const c = this.context, master = this.master;
    if (!c || !master || this.muted || c.state !== 'running' || this.active >= (/Android|iPhone/i.test(globalThis.navigator?.userAgent ?? '') ? 7 : 12)) return;
    this.active++;
    const o = c.createOscillator(), g = c.createGain(); o.type = type;
    const now = c.currentTime; o.frequency.setValueAtTime(from, now); o.frequency.exponentialRampToValueAtTime(Math.max(10, to), now + duration);
    g.gain.setValueAtTime(volume, now); g.gain.exponentialRampToValueAtTime(.001, now + duration);
    o.connect(g); g.connect(master); o.start(now); o.stop(now + duration);
    o.onended = () => { o.disconnect(); g.disconnect(); this.active--; };
  }
  sound(s: Sound, voice?: string) {
    const now = this.context?.currentTime ?? 0;
    if (now - (this.last[s] ?? -1) < .055) return;
    this.last[s] = now;
    if (s === 'chargeTick') { const [ty, t] = (voice ?? '').split('|'); this.chargeTick(ty ?? '', Number(t) || 0); return; }
    if (s === 'chargeReady') { const [p] = voiceOf(voice ?? ''); this.tone(900 * p, 1800 * p, .12, 'triangle', .25); this.tone(1800 * p, 1800 * p, .08, 'sine', .15); return; }
    if (s === 'shopBuy') { this.tone(1500, 2100, .06, 'triangle', .3); setTimeout(() => this.tone(2100, 2800, .09, 'triangle', .28), 70); this.noise(.06, 6000, .12); return; }
    if (s === 'shopSell') { [1800, 1500, 2200].forEach((f, i) => setTimeout(() => this.tone(f, f * 1.25, .07, 'triangle', .38), i * 65)); this.noise(.1, 6500, .18); setTimeout(() => this.tone(520, 380, .12, 'square', .2), 200); return; }
    if (s === 'shopSelect') { this.tone(820, 980, .035, 'square', .14); return; }
    if (s === 'shopDeny') { this.tone(180, 110, .16, 'square', .3); setTimeout(() => this.tone(140, 90, .16, 'square', .3), 110); return; }
    if (s === 'bonk') { this.tone(140, 50, .14, 'square', .4); this.noise(.22, 900, .35); return; }
    if (voice && (s === 'swing' || s === 'charged' || s === 'shot' || s === 'hit' || s === 'enemy' || s === 'kill' || s === 'resource' || s === 'aim' || s === 'reload' || s === 'shotCharged')) { this.voiced(s, voice); return; }
    const [a,b,t] = tones[s]; this.tone(a,b,t, s === 'hurt' || s === 'shot' || s === 'enemy' || s === 'boss' ? 'sawtooth' : s === 'drip' || s === 'step' || s === 'drink' || s === 'mirror' ? 'sine' : 'square');
    if (s === 'chest') { this.noise(.25, 900, .3); this.tone(300, 900, .18, 'square', .2); this.tone(1200, 1800, .3, 'triangle', .25); }
    if (s === 'step') this.noise(.05, 500, .12);
    if (s === 'eat' || s === 'bandage' || s === 'craft') this.noise(.12, s === 'craft' ? 4000 : 1200, .18);
    if (s === 'craft') this.tone(1200, 400, .08, 'square', .3);
    if (s === 'drip') this.tone(2400, 1200, .04, 'sine', .3);
    if (s === 'lootEpic' || s === 'mirror') this.tone(880, 1760, .3, 'triangle', .3);
    if (s === 'lootRare' || s === 'merchant') this.tone(780, 1170, .15, 'triangle', .25);
    if (s === 'coin') this.tone(2100, 2100, .05, 'triangle', .3);
    if (s === 'pound') this.noise(.3, 700, .3);
    if (s === 'boss') { this.tone(110, 55, 1.2, 'sawtooth', .35); this.noise(1, 300, .3); }
    if (s === 'enemy') this.tone(95, 70, .25, 'sawtooth', .3);
    if (s === 'combo') this.tone(990, 1980, .12, 'square', .2);
    if (s === 'explosion') this.tone(94,23,.35,'sawtooth',.7);
    if (s === 'hit' || s === 'rubble' || s === 'cloud') this.noise(s === 'cloud' ? .7 : s === 'rubble' ? .38 : .09, s === 'cloud' ? 650 : s === 'rubble' ? 950 : 1800, s === 'hit' ? .28 : .5);
    if (s === 'parry') { this.tone(1550,420,.11,'square',.32); this.tone(650,1800,.24,'triangle',.2); }
    if (s === 'reload') this.tone(760,220,.09,'square',.2);
    if (s === 'retreat') { const v = Math.max(.01, this.retreatVol); this.tone(980, 520, .08, 'triangle', .3 * v); this.tone(520, 980, .12, 'triangle', .22 * v); }
    if (s === 'terror') { this.tone(73, 31, 1.2, 'sawtooth', .25); this.tone(940, 160, .5, 'triangle', .15); }
  }
  /** Variante por arma (golpe común/cargado/disparo/impacto) o por tipo de enemigo (voz y muerte). */
  private voiced(s: Sound, voice: string) {
    const [p, wave, cut, d] = voiceOf(voice), [a, b, t] = tones[s];
    if (s === 'enemy') { this.tone(a * p, b * p * .8, t * d, wave, .3); this.tone(a * p * 1.5, b * p, t * d * .6, 'triangle', .15); return; }
    if (s === 'kill') { this.tone(a * p, 30, t * d * 1.6, wave, .4); this.noise(.15 * d, cut * .5, .25); return; }
    if (s === 'aim') { this.tone(a * p, b * p, t, 'triangle', .18); this.noise(.04, cut, .1); return; }
    if (s === 'reload') { this.tone(420 * p, 760 * p, .1, 'square', .2); this.noise(.06, cut, .2); setTimeout(() => { this.tone(760 * p, 220 * p, .08, 'square', .22); this.noise(.05, cut * 1.3, .22); }, 180 * d); return; }
    if (s === 'shotCharged') { this.chargedShot(voice); return; }
    const heavy = s === 'charged';
    this.tone(a * p, b * p, t * d * (heavy ? 1.4 : 1), wave, heavy ? .55 : .4);
    this.noise((s === 'swing' || heavy ? .1 : .07) * d * (heavy ? 1.6 : 1), cut, s === 'hit' ? .3 : .2);
    if (heavy) this.tone(a * p * .5, 40, .3 * d, 'square', .35);
  }
  /** Disparo cargado con firma propia por arma a distancia. */
  chargedShot(type: string) {
    const k = type.toUpperCase(), later = (ms: number, f: () => void) => setTimeout(f, ms);
    switch (CHARGED_FAMILY(k)) {
      case 'pistol': this.tone(1400, 180, .16, 'square', .5); this.noise(.12, 5000, .35); later(60, () => this.tone(2600, 900, .08, 'triangle', .25)); break;
      case 'revolver': this.tone(900, 70, .28, 'sawtooth', .55); this.noise(.22, 3200, .45); later(110, () => this.tone(1800, 1800, .05, 'square', .2)); break;
      case 'shotgun': this.tone(160, 30, .45, 'sawtooth', .6); this.noise(.4, 1400, .6); later(90, () => this.noise(.25, 700, .35)); break;
      case 'rifle': this.tone(700, 40, .5, 'sawtooth', .55); this.noise(.3, 2600, .45); later(140, () => this.tone(220, 120, .5, 'sine', .25)); break;
      case 'smg': [0, 45, 90, 135].forEach((ms, i) => later(ms, () => { this.tone(1100 - i * 120, 200, .06, 'square', .35); this.noise(.05, 4200, .25); })); break;
      case 'mg': [0, 55, 110, 165, 220].forEach(ms => later(ms, () => { this.tone(520, 90, .08, 'sawtooth', .38); this.noise(.07, 2200, .3); })); break;
      case 'bow': this.tone(140, 620, .12, 'triangle', .35); later(70, () => { this.noise(.18, 7500, .25); this.tone(2400, 600, .2, 'sine', .2); }); break;
      case 'crossbow': this.tone(300, 90, .12, 'square', .45); this.noise(.08, 3000, .35); later(50, () => this.tone(3200, 900, .22, 'triangle', .22)); break;
      case 'focus': this.tone(220, 1760, .35, 'sine', .4); this.tone(330, 2640, .35, 'triangle', .22); later(160, () => this.tone(1760, 110, .4, 'sine', .3)); break;
      default: { const [p, wave, cut, d] = voiceOf(k); this.tone(90 * p, 22, .42 * d, wave, .55); this.noise(.16 * d, cut, .3); }
    }
  }
  /** Zumbido creciente mientras se carga el disparo (0..1) y aviso al llegar a carga completa. */
  chargeTick(type: string, t: number) {
    const [p] = voiceOf(type); this.tone((180 + t * 700) * p, (200 + t * 760) * p, .05, 'triangle', .07 + t * .07);
  }
  /** Impact grit and low rushing cloud, triggered by combat rather than rendering. */
  private noiseBuf: AudioBuffer | null = null;
  private noise(duration: number, cutoff: number, volume: number) {
    const c = this.context, master = this.master;
    if (!c || !master || this.muted || c.state !== 'running' || this.active >= (/Android|iPhone/i.test(globalThis.navigator?.userAgent ?? '') ? 7 : 12)) return;
    // Un único búfer de ruido de 2 s reutilizado (antes se creaba y rellenaba uno nuevo por cada golpe o paso).
    if (!this.noiseBuf || this.noiseBuf.sampleRate !== c.sampleRate) { const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noiseBuf = b; }
    const source = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain();
    const len = Math.min(1.9, Math.max(.01, duration));
    source.buffer = this.noiseBuf; filter.type = 'lowpass'; filter.frequency.value = Math.max(40, Math.min(20000, Number.isFinite(cutoff) ? cutoff : 2000));
    gain.gain.setValueAtTime(volume, c.currentTime); gain.gain.exponentialRampToValueAtTime(.001, c.currentTime + duration);
    source.connect(filter); filter.connect(gain); gain.connect(master); this.active++;
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); this.active--; }; source.start();
  }
  dispose() { this.disposers.forEach(f => f()); this.stopMusic(); if (this.timer) clearInterval(this.timer); void this.context?.close(); }
}