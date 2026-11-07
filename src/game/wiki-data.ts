import type { AffixId } from "./data";
/** Entradas de la wiki generadas desde las reglas reales del juego. Browser-safe. */
import { CLASSES, ENEMY_TYPES, ELITE_AFFIXES, WEAPONS, AFFIXES, RECIPES, MATERIALS, PACTS, RARITY, PREFIX, SUFFIX } from "./data";
import { REGIONS } from "./regions";
import { enemySheet } from "./enemy-wiki";
import { affixGuide } from "./weapon-wiki";
import { subclasses } from "./subclasses";
import { PC_CONTROLS, PAD_CONTROLS, MECHANICS } from "./controls";
import { COMBO_WINDOW } from "./melee-combo";

export type WikiCat = "armas" | "objetos" | "enemigos" | "mundo" | "clases" | "mecanicas" | "lore";
export interface WikiEntry { id: string; cat: WikiCat; name: string; type: string; tier?: number; damage?: string; effects: string[]; func: string; detail: string[] }

const dice = (d: [number, number]) => `${d[0]}d${d[1]}`;

const LORE: [string, string][] = [
  ["El Juego de los Dados Eternos", "Todo en este mundo se decide por tiradas. Los dados nunca dejan de rodar, y quien aprende a leerlos puede doblar el azar a su favor… por un precio."],
  ["Il'Inconnu", "«Lo Desconocido». Así llaman al viajero sin nombre que despierta en Port Veilance. Cada expedición comienza con ese título, hasta que sus hazañas le ganan otro."],
  ["El Nuevo Azar", "Una fuerza nacida en los Pozos Abisales que reescribe las reglas del mundo. Sus fragmentos alteran zonas enteras y despiertan a criaturas que no deberían existir."],
  ["Los Pactos", "Entidades antiguas ofrecen poder a cambio de carne, sed o luz. Ningún pacto es gratuito: su principio siempre se cobra."],
  ["Los Palimpsestos", "Libros reescritos una y otra vez. Descifrarlos en las bancas revela memorias del mundo; leerlos mal invoca a quien los escribió."],
];

export const WIKI: WikiEntry[] = [
  ...WEAPONS.map((w): WikiEntry => ({
    id: `weapon:${w.type}`, cat: "armas", name: w.type, type: w.ranged ? "Arma a distancia" : "Arma cuerpo a cuerpo",
    damage: `${dice(w.dice)}${w.pellets ? ` ×${w.pellets} perdigones` : ""}`, effects: [],
    func: w.ranged ? (w.projectile ? "Proyectil arcano sin munición" : "Dispara munición") : "Golpe cuerpo a cuerpo",
    detail: [`Alcance ${w.range}`, `Cadencia ${w.rate}s`, `Break ${w.breakB}`, ...(w.magazine ? [`Cargador ${w.magazine}`, `Recarga ${w.reloadTime}s`] : [])],
  })),
  ...(Object.entries(AFFIXES)).map(([id, desc]): WikiEntry => ({ id: `affix:${id}`, cat: "objetos", name: id.replace("_", " "), type: "Inscripción", effects: [desc, affixGuide(id as AffixId).rule, ...affixGuide(id as AffixId).ex.map(x => `Ejemplo: ${x}`)], func: "Se graba en armas Mágicas o superiores (una por tier)", detail: [] })),
  ...RARITY.map((r, i): WikiEntry => ({ id: `tier:${i}`, cat: "objetos", name: `${r}${i ? ` (prefijo «${PREFIX[i]}»)` : ""}`, type: "Tier / calidad", tier: i, effects: [`${i} inscripción(es)`, `Daño ×${(1 + i * 0.18).toFixed(2)} base`, `Crítico 0–${4 + i * 2}%`], func: "Calidad de un arma encontrada", detail: [`Sufijos posibles: ${SUFFIX.join(", ")}`] })),
  ...RECIPES.map((r): WikiEntry => ({ id: `recipe:${r.id}`, cat: "objetos", name: r.name, type: "Consumible / crafteo", effects: [r.desc], func: "Se fabrica con materiales", detail: [`Necesita: ${Object.entries(r.needs).map(([k, n]) => `${n} ${MATERIALS[k] ?? k}`).join(", ")}`] })),
  ...Object.entries(MATERIALS).map(([id, n]): WikiEntry => ({ id: `mat:${id}`, cat: "objetos", name: n, type: "Material", effects: [], func: "Ingrediente de crafteo y forja", detail: RECIPES.filter((r) => id in r.needs).map((r) => `Sirve para: ${r.name}`) })),
  ...["Chaqueta acolchada", "Coraza de hueso", "Gabardina rúnica", "Malla del Hilo"].map((n): WikiEntry => ({ id: `armor:${n}`, cat: "objetos", name: n, type: "Armadura", effects: ["Defensa 1–5 según tier"], func: "Reduce el daño recibido", detail: ["Tiers Común a Épica"] })),
  ...PACTS.map((p): WikiEntry => ({ id: `pact:${p.id}`, cat: "objetos", name: p.name, type: "Pacto", effects: [`Don: ${p.boon}`, `Castigo: ${p.bane}`], func: p.trigger, detail: [p.principle] })),
  ...[["PC", PC_CONTROLS], ["Mando", PAD_CONTROLS], ["Mecánica", MECHANICS]].flatMap(([t, groups]) => (groups as typeof MECHANICS).map((g): WikiEntry => ({ id: `mech:${t}:${g.title}`, cat: "mecanicas", name: g.title, type: t === "Mecánica" ? "Mecánica" : `Controles · ${t}`, effects: [], func: "", detail: g.lines }))),
  ...Object.entries(ENEMY_TYPES).map(([id, e]): WikiEntry => { const sh = enemySheet(id)!; return { id: `enemy:${id}`, cat: "enemigos", name: e.name, type: `${sh.pattern.label} · peligro ${sh.danger}`, damage: `${e.dmg} por golpe (base)`,
    effects: sh.pattern.attacks.map(x => `Ataque: ${x}`), func: sh.pattern.behavior,
    detail: [`Aparece en: ${enemyRegions(id)}`, `Vida ${e.hp} · Defensa ${e.def} · Break ${e.brk} (~${sh.hitsToBreak} golpes normales para derribarlo) · Velocidad ${e.speed}`,
      `Escalado (vida/daño/defensa): ${sh.scale.map(x => `piso ${x.floor}: ${x.hp} PV · ${x.dmg} daño · DEF ${x.def}`).join(" | ")}`,
      `Cómo derrotarlo: ${sh.pattern.beat}`, `Cómo esquivarlo: ${sh.pattern.dodge}`,
      "Golpear al ritmo de la música (♪) da un mini crítico; los élites suman rasgos extra."] }; }),
  ...ELITE_AFFIXES.map((a): WikiEntry => ({ id: `elite:${a}`, cat: "enemigos", name: a, type: "Variante élite", effects: [], func: "Rasgo que puede tener cualquier enemigo élite; los élites aparecen más a mayor nivel", detail: [] })),
  ...CLASSES.filter(c => c.id !== "pariah").map((c): WikiEntry => ({ id: `class:${c.id}`, cat: "clases", name: c.name, type: "Clase", effects: [c.perk], func: c.desc, detail: [`Armas iniciales: ${c.melee} + ${c.ranged}`, `Atributos: ${Object.entries(c.raw).map(([k, v]) => `${k} ${v}`).join(" · ")}`] })),
  ...CLASSES.flatMap((c) => subclasses(c.id).map((s): WikiEntry => ({ id: `sub:${s.id}`, cat: "clases", name: s.name, type: `Subclase de ${c.name}`, effects: [s.desc], func: "Variante de clase elegida al empezar la run", detail: [] }))),
  ...COMBAT_TIPS(),
  ...COMBO_TIPS(),
  ...WORLD(),
  ...REGIONS.map((r, i): WikiEntry => ({ id: `lore:${r.id}`, cat: "lore", name: r.name, type: `Región ${i + 1}`, effects: [], func: r.objective, detail: [r.desc, `Reliquia: ${r.item}`] })),
  ...LORE.map(([n, t]): WikiEntry => ({ id: `lore:${n}`, cat: "lore", name: n, type: "Crónica", effects: [], func: "", detail: [t] })),
];

function enemyRegions(id: string) {
  const r = REGIONS.filter((x) => (x.enemies as readonly string[]).includes(id)).map((x) => x.name);
  return r.length ? r.join(", ") : "Especial (jefes, emboscadas o invocaciones)";
}

function COMBO_TIPS(): WikiEntry[] {
  return ([
    ["Combos cuerpo a cuerpo", `Encadena clics principales normales con hasta ${COMBO_WINDOW} s entre golpes. No hace falta cargar: el último clic ejecuta el remate de la cadena. El ataque cargado del clic derecho es independiente y reinicia la cadena.`],
    ["Remate · Espada y Guadaña", "Tajo → Contratajo → Ascendente → BARRIDO FINAL: un barrido lateral amplio que golpea a varios y los empuja hacia un costado."],
    ["Remate · Martillo, Hacha y Mandoble", "Golpe → Revés → MACHACAR: aplasta el suelo, alcanza a los enemigos alrededor del impacto, los derriba y los lanza por los aires."],
    ["Remate · Lanza, Daga y Bastón", "Cuatro estocadas rápidas que enganchan al enemigo y luego EMPALAR: un empuje recto y muy largo, ideal para estamparlo contra paredes."],
    ["Remate · Puños", "Jab → Directo → Gancho → UPPERCUT: eleva y derriba al enemigo."],
  ] as [string, string][]).map(([n, t]) => ({ id: `combo:${n}`, cat: "mecanicas" as const, name: n, type: "Combos", effects: [], func: "Hack and slash", detail: [t] }));
}

function WORLD(): WikiEntry[] {
  const e = (name: string, type: string, func: string, where: string, how: string[]): WikiEntry => ({ id: `world:${name}`, cat: "mundo", name, type, effects: [], func, detail: [`Dónde: ${where}`, ...how] });
  return [
    e("El Mercader", "NPC", "Compra, vende y repara armas; da encargos", "En el refugio (sala de descanso) de cada piso. A veces aparece un mercader errante en salas lejanas.", ["Interacción: acércate y pulsa E (o el botón de acción) — «Hablar con el mercader».", "Tras varias charlas confía en ti y ofrece encargos con recompensa.", "Sus diálogos revelan poco a poco quién es."]),
    e("Cofre", "Contenedor", "Da 1–3 objetos, fichas o materiales según la calidad del piso", "En cualquier sala (más de la mitad de las salas tienen uno). Las cámaras secretas guardan cofres mejores.", ["Interacción: mira el cofre y pulsa E — «Abrir cofre».", "Cofre cerrado (40%): usa una Llave de hueso, o fuérzalo con una tirada d20 + ganzúa + PRE contra CD 12.", "Un 1 natural siempre falla y un 20 siempre abre."]),
    e("Puerta", "Acceso", "Une las salas del piso", "Entre salas y pasillos.", ["Interacción: ponte de frente y pulsa E para abrirla; un golpe cuerpo a cuerpo que no acierta a nadie también la revienta.", "Algunas puertas pueden esconder enemigos emboscados detrás."]),
    e("Puerta sellada", "Acceso", "Bloquea rutas opcionales o la guarida", "Antesalas, cámaras del tesoro y la Zona Prohibida.", ["Cerradura de hueso: usa una llave o fuérzala (CD 16; si fallas te pincha y alerta a los cercanos).", "Combinación: lee la nota del piso y elige el código correcto de tres cifras.", "Sellos especiales: matar X enemigos, tener cierta vida, alcanzar un nivel o derrotar al guardián."]),
    e("Muro dorado (pasaje secreto)", "Acceso secreto", "Abre un atajo o cámara oculta", "Paredes doradas escondidas en el mapa.", ["Interacción: mira el muro y pulsa E. Con Llave de hueso se abre seguro.", "Sin llave: fuerza el mecanismo (CD 15); si fallas hay derrumbe, daño y estruendo."]),
    e("Llave de hueso", "Objeto", "Abre cofres, cerraduras y muros dorados", "Suelta en el suelo de algunas salas, a menudo lejos de la cámara que abre.", ["Se recoge al pasar por encima."]),
    e("Trampa de púas", "Peligro", "Daña y hiere la pierna", "Marcas rojas en el suelo.", ["Sáltala o desármala con E (d20 + PER contra CD 14). Al desarmarla obtienes chatarra y pólvora."]),
    e("Banca", "Descanso", "Recupera lumbre; permite investigar Palimpsestos", "Refugio y algunas salas.", ["Interacción: E — «Sentarse en la banca». Vuelve a pulsar para levantarte."]),
    e("Altar de pacto", "Pacto", "Ofrece un pacto con don y castigo", "Salas aleatorias.", ["Interacción: E — «Escuchar pacto». Puedes aceptarlo o rechazarlo."]),
    e("Piedra de pacto", "Pacto", "Muestra pro, contra y activación de un pacto", "Salas aleatorias.", ["Interacción: E — «Leer sello de pacto»."]),
    e("Documento con código", "Pista", "Contiene la combinación de una cerradura", "Uno por piso de expedición.", ["Interacción: E — «Leer documento»."]),
    e("Relicario sellado", "Mecanismo", "Guarda el fragmento de mapa", "Antesala de la guarida.", ["Interacción: E e introduce la combinación del documento."]),
    e("Fragmento de mapa", "Objetivo", "Desbloquea la guarida del jefe", "Dentro del relicario sellado.", ["Interacción: E — «Recoger fragmento de mapa»."]),
    e("Portal / Umbral", "Salida", "Lleva al siguiente piso o te extrae durante el colapso", "Aparece en el refugio tras derrotar al jefe.", ["Interacción: E — «Cruzar el umbral». Durante el colapso tienes un tiempo límite para EXTRAER."]),
    e("Libro antiguo y folios", "Palimpsestos", "Sistema opcional de investigación", "Ocultos en salas; los folios sueltos por el suelo.", ["Interacción: E para recogerlos; se investigan sentado en una banca. Leer mal invoca a un mini-jefe."]),
    e("Rosa del santuario", "Descanso", "Cura todo: vida, mente, hambre, sed y estados", "Jardín de la Última Rosa, hasta el amanecer.", ["Interacción: E — «Descansar junto a la rosa»."]),
    e("Cajas, barriles y decorado", "Objeto rompible", "Pueden soltar recompensas, astillas o explotar", "Por todas las salas.", ["Golpéalos o dispárales. Los barriles de pólvora explotan y dañan a todo lo cercano."]),
    e("Comida, agua, munición, fichas y materiales", "Recogibles", "Mantienen hambre, sed, munición y crafteo", "Suelos de las salas y botín de enemigos.", ["Se recogen al pasar por encima."]),
  ];
}

function COMBAT_TIPS(): WikiEntry[] {
  return ([
    ["Bloqueo perfecto", "Bloquea justo antes del impacto: reduces casi todo el daño y reflejas parte al atacante. Bloquear antes de tiempo sólo amortigua."],
    ["Castigar fallos", "Cuando un enemigo falla su ataque queda abierto: tu siguiente golpe hace daño doble. Esquiva de lado y contraataca."],
    ["Empujes contra paredes", "Los golpes pesados lanzan enemigos; si chocan contra una pared o contra otro enemigo reciben daño extra en cadena, y los derribados reciben más daño."],
    ["Racha y frenesí", "Encadenar bajas sin recibir daño activa el frenesí: más daño y velocidad. Pierdes la racha si te golpean."],
    ["Perfil bajo", "Agacharte o deslizarte reduce tu caja de impacto: muchos proyectiles pasan por encima. Úsalo contra tiradores y ráfagas de jefes."],
    ["Break y remate", "Los golpes con Break desestabilizan; un enemigo tambaleante puede ser rematado para recuperar recursos. Martillos y mandobles tienen más Break."],
    ["Gestionar el aguante", "Correr, esquivar y golpear gastan aguante. Deja de atacar un instante antes de vaciarlo para poder esquivar siempre."],
    ["Retiradas enemigas", "Algunos enemigos golpean y se alejan: no los persigas a ciegas hacia otros grupos; usa armas a distancia o espéralos."],
    ["Armas e inscripciones", "Combina inscripciones: SANGRANTE + VORAZ sostiene combates largos; INESTABLE o ENCADENADA limpian grupos; SEGADORA mantiene la munición."],
    ["Desgaste", "Las armas se gastan y pueden fallar: repáralas en la Forja o con el mercader antes de un jefe."],
  ] as const).map(([n, t]) => ({ id: `tip:${n}`, cat: "mecanicas", name: n, type: "Combate avanzado", effects: [], func: "Recomendación", detail: [t] }));
}


export function searchWiki(list: WikiEntry[], q: string, cat: WikiCat, type = "", tier = -1) {
  const t = q.trim().toLowerCase();
  return list.filter((e) => e.cat === cat && (!type || e.type === type) && (tier < 0 || e.tier === tier)
    && (!t || [e.name, e.type, e.damage ?? "", e.func, ...e.effects, ...e.detail].some((x) => x.toLowerCase().includes(t))));
}
