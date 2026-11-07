/** Plantillas para frases armadas en el momento (HUD, mensajes, armas y habilidades) con orden natural en inglés. Browser-safe. */
const TYPES: Record<string, string> = { AMETRALLADORA: "MACHINE GUN", ARCO: "BOW", BALLESTA: "CROSSBOW", BASTON: "STAFF", DAGA: "DAGGER", ESCOPETA: "SHOTGUN", ESPADA: "SWORD", FOCO: "FOCUS", FUSIL: "MUSKET", "GUADAÑA": "SCYTHE", HACHA: "AXE", LANZA: "SPEAR", MANDOBLE: "GREATSWORD", MARTILLO: "HAMMER", PISTOLA: "PISTOL", REVOLVER: "REVOLVER", RIFLE: "RIFLE", SUBFUSIL: "SMG" };
const VARIANT: Record<string, string> = { Pesada: "Heavy", Ligera: "Light", Larga: "Long", Corta: "Short", Serrada: "Serrated", Gemela: "Twin", Templada: "Tempered", Recortada: "Sawn-off" };
const VARIANT_OF: Record<string, string> = { "de Tambor": "Drum-fed", "de Gatillo Fino": "Hair-trigger" };
const PREFIX: Record<string, string> = { Mellada: "Chipped", Velada: "Veiled", "Rúnica": "Runic", Despierta: "Awakened", Imposible: "Impossible" };
const SUFFIX: Record<string, string> = { "del Náufrago": "of the Castaway", "de Babel": "of Babel", "del Último Trato": "of the Last Bargain", "del Hilo": "of the Thread", "del Hambre": "of Hunger", "de la Penitencia": "of Penance", "Sin Nombre": "the Nameless", "del Eco": "of the Echo", "de Ceniza": "of Ash", "de la Vela Negra": "of the Black Candle", "del Reloj Roto": "of the Broken Clock", "de la Rosa Muda": "of the Silent Rose", "del Pozo": "of the Well", "del Cuervo": "of the Raven", "de la Marea": "of the Tide", "del Tintero": "of the Inkwell", "de la Última Misa": "of the Last Mass", "del Espejo Ciego": "of the Blind Mirror" };
const alt = (o: Record<string, string>) => Object.keys(o).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
const WEAPON_RE = new RegExp(`(?<![\\p{L}])(${alt(TYPES)})(?: (${alt(VARIANT)}|${alt(VARIANT_OF)}))?(?: (${alt(PREFIX)}))?(?: (${alt(SUFFIX)}))?(?![\\p{L}])`, "gu");

/** «ESPADA Pesada Rúnica del Cuervo» → «Runic Heavy SWORD of the Raven». */
export function weaponNameEn(text: string) {
  return text.replace(WEAPON_RE, (_m, t: string, v?: string, p?: string, s?: string) => {
    const adj = [p && PREFIX[p], v && (VARIANT[v] ?? VARIANT_OF[v])].filter(Boolean).join(" ");
    return [adj, TYPES[t], s && SUFFIX[s]].filter(Boolean).join(" ");
  });
}

type Tr = (s: string) => string;

/** [patrón español, constructor inglés]; los grupos de texto libre se traducen con el diccionario. */
const TEMPLATES: [RegExp, (m: string[], tr: Tr) => string][] = [
  [/^✦ HABILIDAD DESBLOQUEADA: (.+)$/u, (m, tr) => `✦ SKILL UNLOCKED: ${tr(m[1]!)}`],
  [/^Nueva habilidad activa: (.+)\. Elígela en la pestaña Clase\.$/u, (m, tr) => `New active skill: ${tr(m[1]!)}. Pick it in the Class tab.`],
  [/^✦ (.+) LISTA \(B\)$/u, (m, tr) => `✦ ${tr(m[1]!)} READY (B)`],
  [/^✦ (.+) LISTA$/u, (m, tr) => `✦ ${tr(m[1]!)} READY`],
  [/^(.+): (\d+)\/(\d+)$/u, (m, tr) => `${tr(m[1]!)}: ${m[2]}/${m[3]}`],
  [/^Se recarga en (\d+) s$/u, (m) => `Recharges in ${m[1]} s`],
  [/^Se recarga con (\d+) muertes$/u, (m) => `Recharges after ${m[1]} kills`],
  [/^Se recarga al recibir (\d+) golpes$/u, (m) => `Recharges after taking ${m[1]} hits`],
  [/^Se recarga al infligir (\d+) de daño$/u, (m) => `Recharges after dealing ${m[1]} damage`],
  [/^Se desbloquea en Nv (\d+)$/u, (m) => `Unlocks at level ${m[1]}`],
  [/^Se desbloquea al llegar al piso (\d+)$/u, (m) => `Unlocks on reaching floor ${m[1]}`],
  [/^Se desbloquea al derrotar (\d+) enemigos$/u, (m) => `Unlocks after defeating ${m[1]} enemies`],
  [/^Se desbloquea al vencer a un jefe$/u, () => "Unlocks after defeating a boss"],
  [/^Se desbloquea al descubrir un secreto$/u, () => "Unlocks when you discover a secret"],
  [/^Se desbloquea al resolver un palimpsesto del libro$/u, () => "Unlocks by solving a palimpsest in the book"],
  [/^Se desbloquea al sellar un pacto$/u, () => "Unlocks when you seal a pact"],
  [/^Se compra al Mercader por (\d+) fichas$/u, (m) => `Buy it from the Merchant for ${m[1]} tokens`],
  [/^Aprender (.+)$/u, (m, tr) => `Learn ${tr(m[1]!)}`],
  [/^(.+) · (\d+) fichas \(tienes (\d+)\)\.$/u, (m, tr) => `${tr(m[1]!)} · ${m[2]} tokens (you have ${m[3]}).`],
  [/^Te faltan fichas \((\d+)\/(\d+)\)\.$/u, (m) => `Not enough tokens (${m[1]}/${m[2]}).`],
  [/^(\d+) × (\d+) daño \(máx\. (\d+)\)$/u, (m) => `${m[1]} × ${m[2]} damage (max ${m[3]})`],
  [/^(\d+) daño en área \(radio 3,6\)$/u, (m) => `${m[1]} area damage (radius 3.6)`],
  [/^(\d+) daño de explosión( \+ veneno 8 s)?$/u, (m) => `${m[1]} blast damage${m[2] ? " + 8 s poison" : ""}`],
  [/^Cura (\d+)% de vida$/u, (m) => `Heals ${m[1]}% of your health`],
  [/^Sangrado (\d+) s a enemigos cercanos$/u, (m) => `Nearby enemies bleed for ${m[1]} s`],
  [/^Tambaleo ([\d.]+) s$/u, (m) => `Staggers for ${m[1]} s`],
  [/^Daño calculado a tu nivel (\d+)\.$/u, (m) => `Damage calculated at your level ${m[1]}.`],
  [/^¡(.+) ROTA!$/u, (m, tr) => `${tr(m[1]!)} BROKE!`],
  [/^(.+) SE DESGASTA · repárala en Crafteo$/u, (m, tr) => `${tr(m[1]!)} IS WEARING OUT · repair it in Crafting`],
  [/^(.+) está desgastada: menos daño y puede fallar\.$/u, (m, tr) => `Your ${tr(m[1]!)} is worn: less damage and it may fail.`],
  [/^(.+) está rota: daño muy reducido y falla a menudo\. Repárala en Crafteo o con el mercader\.$/u, (m, tr) => `Your ${tr(m[1]!)} is broken: greatly reduced damage and frequent failures. Repair it in Crafting or with the merchant.`],
  [/^(.+) gana (.+)\.$/u, (m, tr) => `${tr(m[1]!)} gains ${tr(m[2]!)}.`],
  [/^(.+) reparada\.$/u, (m, tr) => `${tr(m[1]!)} repaired.`],
  [/^(.+) sube a \+(\d+)\.$/u, (m, tr) => `${tr(m[1]!)} rises to +${m[2]}.`],
  [/^El mercader te entrega (.+)\.$/u, (m, tr) => `The merchant hands you a ${tr(m[1]!)}.`],
  [/^El mercader paga (\d+) fichas por tu encargo\.$/u, (m) => `The merchant pays you ${m[1]} tokens for the job.`],
  [/^Arma sellada: requiere nivel (\d+)\.$/u, (m) => `Sealed weapon: requires level ${m[1]}.`],
  [/^No puedes utilizar (.+): requiere nivel (\d+)\.$/u, (m, tr) => `You can't use the ${tr(m[1]!)} yet: it requires level ${m[2]}.`],
  [/^LE ARRANCAS: (.+)$/u, (m, tr) => `YOU TEAR AWAY: ${tr(m[1]!)}`],
  [/^Robas a la criatura \((\d+) vs 12\): (.+)$/u, (m, tr) => `You rob the creature (${m[1]} vs 12): ${tr(m[2]!)}`],
  [/^Subes a nivel (\d+)\. \+1 punto de habilidad y \+1 de atributo\.$/u, (m) => `You reach level ${m[1]}. +1 skill point and +1 attribute point.`],
  [/^Misión cumplida: (.+) · \+(\d+) fichas y EXP$/u, (m, tr) => `Mission complete: ${tr(m[1]!)} · +${m[2]} tokens and XP`],
  [/^Bono de calificación: \+(\d+) fichas\.$/u, (m) => `Rating bonus: +${m[1]} tokens.`],
  [/^\+(\d+) (?:FICHAS|fichas)$/u, (m) => `+${m[1]} tokens`],
  [/^CRÍTICO (\d+)$/u, (m) => `CRITICAL ${m[1]}`],
  [/^NIVEL (\d+)$/u, (m) => `LEVEL ${m[1]}`],
  [/^PISO (\d+): (.+)$/u, (m, tr) => `FLOOR ${m[1]}: ${tr(m[2]!)}`],
  [/^ALTERNANCIA ×(\d+) · \+(\d+)% daño( · aturde)?$/u, (m) => `WEAPON SWAP ×${m[1]} · +${m[2]}% damage${m[3] ? " · stuns" : ""}`],
  [/^RACHA x(\d+) · FRENESÍ \+(\d+)% vel$/u, (m) => `STREAK x${m[1]} · FRENZY +${m[2]}% speed`],
  [/^♪ AL RITMO · (.+)$/u, (m, tr) => `♪ ON THE BEAT · ${tr(m[1]!)}`],
  [/^REMATE: (.+)$/u, (m, tr) => `FINISHER: ${tr(m[1]!)}`],
  [/^(.+) CAE\. Se abre el portal del refugio\.$/u, (m, tr) => `${tr(m[1]!)} FALLS. The refuge portal opens.`],
  [/^👑 ASCENSO DEL TIRANO · (.+)$/u, (m, tr) => `👑 RISE OF THE TYRANT · ${tr(m[1]!)}`],
];


/** Devuelve la frase en inglés si coincide con una plantilla; si no, null. */
export function translateDynamic(text: string, tr: Tr): string | null {
  for (const [re, build] of TEMPLATES) { const m = re.exec(text); if (m) return build([...m], (s) => weaponNameEn(s) !== s ? weaponNameEn(s) : tr(s)); }
  const w = weaponNameEn(text);
  return w !== text ? tr(w) : null;
}
