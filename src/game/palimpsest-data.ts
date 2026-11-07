// PALIMPSESTOS: THE LOST LANGUAGE — literary library, documents and dictionary.
// Data only. Short public-domain quotations are attributed; everything else is original text.
import type { Attr } from "./data";

export type PuzzleFamily = "acrostico" | "anagrama" | "cardano" | "criptograma" | "traduccion" | "frase" | "semantica" | "palimpsesto";
export const FAMILY_NAMES: Record<PuzzleFamily, string> = {
  acrostico: "Acróstico", anagrama: "Anagrama", cardano: "Rejilla de Cardano", criptograma: "Criptograma",
  traduccion: "Traducción", frase: "Reconstrucción de frase", semantica: "Asociación semántica", palimpsesto: "Palimpsesto superpuesto",
};

export type Theme = "existencialismo" | "mitologia" | "gotico" | "epopeya" | "poesia" | "ocultismo" | "identidad";

export interface Quote { text: string; author: string; work: string }

export type Reward =
  | { kind: "epifania"; attr: Attr; amount: number; label: string }
  | { kind: "reliquia"; id: string; label: string; desc: string }
  | { kind: "recuerdo"; label: string }
  | { kind: "escritura"; pact: string; label: string; desc: string }
  | { kind: "tabula"; label: string; desc: string };

export interface PalimpsestDoc {
  id: string; title: string; family: PuzzleFamily; theme: Theme; minFloor: number;
  kindLabel: string; // manuscrito, carta, poema, registro, inscripción
  lines: string[];
  quote?: Quote;
  prompt: string;
  /** Arrange puzzles: tiles to place in order. */
  tiles?: string[]; answer?: string[];
  /** Connect puzzles: left → right. */
  pairs?: [string, string][];
  /** Cardano grille: rows of letters and the cut-out cells [row, col] in reading order. */
  grid?: string[]; mask?: [number, number][];
  /** Overlay palimpsest: two pages that reveal a third text where letters coincide. */
  layers?: [string, string];
  /** Cryptogram: cipher text and a partial key. */
  cipher?: string; key?: Record<string, string>;
  hints: string[];
  deduction: string; // shown in Conexiones once solved
  result: string; // interpretation
  dict: string[]; // dictionary ids recorded on solve
  memory?: { title: string; text: string };
  reward: Reward;
}

export interface DictEntry { id: string; word: string; lang: string; translation: string; etym?: string; lore: string; related: string[]; ambiguous?: boolean }

export const DICTIONARY: DictEntry[] = [
  { id: "nemo", word: "NEMO", lang: "Latín", translation: "nadie", etym: "ne + homo: «ningún hombre».", lore: "El nombre que firma los registros vacíos del Archivo.", related: ["outis", "inconnu"] },
  { id: "outis", word: "ΟΥΤΙΣ (Outis)", lang: "Griego antiguo", translation: "nadie", etym: "ou + tis: «no alguien». Odiseo engaña al Cíclope con él.", lore: "Quien se llama Nadie no puede ser acusado… ni recordado.", related: ["nemo", "personne"] },
  { id: "personne", word: "PERSONNE", lang: "Francés", translation: "nadie / persona", etym: "Del latín persona, «máscara del actor».", lore: "La misma palabra nombra a alguien y a nadie.", related: ["outis", "inconnu"], ambiguous: true },
  { id: "niemand", word: "NIEMAND", lang: "Alemán", translation: "nadie", etym: "nie + Mann: «nunca hombre».", lore: "Grabado en una lápida sin fechas.", related: ["nemo"] },
  { id: "memento", word: "MEMENTO MORI", lang: "Latín", translation: "recuerda que morirás", etym: "memento, imperativo de meminisse; mori, «morir».", lore: "Pero ¿qué recuerda quien nunca nació?", related: ["oblivion"], ambiguous: true },
  { id: "kenoma", word: "ΚΕΝΩΜΑ (Kenoma)", lang: "Griego (gnóstico)", translation: "vacío, lo vaciado", etym: "kenos, «vacío»; opuesto al pleroma, la plenitud.", lore: "El taller donde el Creador dejó sus borradores.", related: ["vacio", "borrador"] },
  { id: "oblivion", word: "OBLIVIO", lang: "Latín", translation: "olvido", etym: "ob + levis: «lo que se alisa, se borra».", lore: "Las almas beben del Leteo para olvidar. Alguien olvidó beber.", related: ["memento", "olvido"] },
  { id: "olvido", word: "OLVIDO", lang: "Español", translation: "pérdida de memoria", lore: "Escrito con un alfabeto que L'Inconnu lee sin haberlo aprendido.", related: ["oblivion", "ausencia"] },
  { id: "anima", word: "ANIMA", lang: "Latín", translation: "alma, aliento", etym: "Del indoeuropeo *ane-, «respirar».", lore: "La tinta respira. Por eso el Archivo está vivo.", related: ["kenoma"] },
  { id: "vacio", word: "VACÍO", lang: "Español", translation: "ausencia de contenido", lore: "Palabra recurrente en los márgenes.", related: ["kenoma", "ausencia"] },
  { id: "borrador", word: "BORRADOR", lang: "Español", translation: "versión descartada", lore: "Toda criatura del Archivo fue antes un borrador.", related: ["kenoma", "inexistente"] },
  { id: "ausencia", word: "AUSENCIA", lang: "Español", translation: "lo que falta", lore: "No es la nada: es el hueco con forma de alguien.", related: ["vacio", "olvido"] },
  { id: "inexistente", word: "INEXISTENTE", lang: "Español", translation: "lo que no es", lore: "Firma de los muertos que nunca nacieron.", related: ["borrador", "nunca"], ambiguous: true },
  { id: "nunca", word: "NUNCA", lang: "Español", translation: "en ningún tiempo", lore: "Fecha de nacimiento en tres registros distintos.", related: ["inexistente"] },
  { id: "aeth", word: "ÆTH-VEL", lang: "Lengua del Vacío (ficticia)", translation: "«el que fue tachado»", lore: "L'Inconnu la pronuncia antes de leerla.", related: ["borrador", "inconnu"], ambiguous: true },
  { id: "inconnu", word: "L'INCONNU", lang: "Francés", translation: "el desconocido", etym: "in + connu, «no conocido».", lore: "No es un nombre. Es la descripción de una ausencia.", related: ["nemo", "outis", "personne"], ambiguous: true },
];

export const DOCS: PalimpsestDoc[] = [
  {
    id: "doc-nemo", title: "Registro de un nacimiento que no ocurrió", family: "acrostico", theme: "identidad", minFloor: 1, kindLabel: "Poema en un registro civil",
    lines: [
      "Nadie recuerda la puerta por la que entré,",
      "en el registro mi nombre es una mancha;",
      "mil páginas me nombran sin decirme,",
      "olvido es la tinta con que fui escrito.",
    ],
    quote: { text: "Οὖτις ἐμοί γ᾽ ὄνομα — «Nadie es mi nombre».", author: "Homero", work: "Odisea, canto IX" },
    prompt: "Las primeras letras de cada verso esconden una firma. Colócalas en orden.",
    tiles: ["O", "N", "M", "A", "E", "I", "D"], answer: ["N", "E", "M", "O"],
    hints: ["Es un acróstico: fíjate solo en el inicio de cada verso.", "La palabra está en latín y tiene cuatro letras.", "Empieza por N."],
    deduction: "Iniciales: N·E·M·O → NEMO, «nadie» en latín. El poema firma con la ausencia.",
    result: "El registro pertenece a alguien que firmó como Nadie. La caligrafía se parece a la tuya.",
    dict: ["nemo"], reward: { kind: "epifania", attr: "VOL", amount: 1, label: "Epifanía NEMO · +1 VOL" },
  },
  {
    id: "doc-outis", title: "Carta en cinco lenguas", family: "traduccion", theme: "mitologia", minFloor: 1, kindLabel: "Carta",
    lines: [
      "«Me preguntaron mi nombre en cada puerto.",
      "En Ítaca dije Οὖτις; en Roma, Nemo;",
      "en París respondí Personne; en Viena, Niemand;",
      "en Londres, Nobody. Nadie me retuvo.»",
    ],
    prompt: "Une cada forma de «nadie» con la lengua del puerto donde se pronunció.",
    pairs: [["Οὖτις", "Griego antiguo"], ["Nemo", "Latín"], ["Personne", "Francés"], ["Niemand", "Alemán"], ["Nobody", "Inglés"]],
    hints: ["La carta nombra un puerto por cada palabra.", "Ítaca es griega; Roma, latina.", "París → francés, Viena → alemán, Londres → inglés."],
    deduction: "Cinco lenguas, una misma palabra. El remitente nunca dio un nombre: dio una ausencia traducida.",
    result: "La carta no tiene destinatario. El sobre dice: «Para quien la lea».",
    dict: ["outis", "personne", "niemand"], reward: { kind: "epifania", attr: "SUE", amount: 1, label: "Epifanía OUTIS · +1 SUE" },
  },
  {
    id: "doc-memento", title: "Inscripción en un osario", family: "anagrama", theme: "ocultismo", minFloor: 2, kindLabel: "Inscripción",
    lines: ["Letras arrancadas de una lápida, mezcladas en el polvo:", "R · O · M · E · M · I · N · T · O · M · E"],
    quote: { text: "Pulvis et umbra sumus — «Somos polvo y sombra».", author: "Horacio", work: "Odas, IV, 7" },
    prompt: "Reordena las once letras para restaurar la advertencia latina (dos palabras: 7 + 4).",
    tiles: ["R", "O", "M", "E", "M", "I", "N", "T", "O", "M", "E"], answer: ["M", "E", "M", "E", "N", "T", "O", "M", "O", "R", "I"],
    hints: ["Es una advertencia sobre la muerte.", "La primera palabra significa «recuerda».", "MEMENTO + ····"],
    deduction: "Anagrama de MEMENTO MORI: «recuerda que morirás». Escrito por quien no pudo morir.",
    result: "La lápida no tiene nombre. Debajo, alguien rascó: «tampoco nací».",
    dict: ["memento"], reward: { kind: "reliquia", id: "memento", label: "Reliquia MEMENTO MORI", desc: "Con menos del 25% de PV recibes un 15% menos de daño." },
  },
  {
    id: "doc-kenoma", title: "Plantilla del cartógrafo ciego", family: "cardano", theme: "existencialismo", minFloor: 2, kindLabel: "Manuscrito con rejilla",
    lines: ["Una cuadrícula de letras sin sentido y una lámina perforada.", "«Aplica la rejilla y lee de izquierda a derecha, de arriba abajo.»"],
    grid: ["KLRTE", "SNQOV", "BUMHA", "XPLZD", "GRYWC"], mask: [[0, 0], [0, 4], [1, 1], [1, 3], [2, 2], [2, 4]],
    prompt: "Aplica la rejilla de Cardano y coloca las letras reveladas en orden de lectura.",
    tiles: ["K", "E", "N", "O", "M", "A", "L", "V", "R"], answer: ["K", "E", "N", "O", "M", "A"],
    hints: ["Pulsa «Aplicar rejilla» para ver solo las celdas perforadas.", "Lee fila por fila, de izquierda a derecha.", "Es una palabra griega gnóstica de seis letras: el vacío."],
    deduction: "La rejilla revela K-E-N-O-M-A: el vacío gnóstico, opuesto al pleroma.",
    result: "El mapa no muestra un lugar: muestra dónde no hay nada. Hay una sala marcada con tu silueta.",
    dict: ["kenoma", "vacio"], memory: { title: "La sala sin paredes", text: "Recuerdas una sala donde el eco volvía antes del grito. Estabas allí, pero nadie te había dibujado todavía." },
    reward: { kind: "recuerdo", label: "Recuerdo · La sala sin paredes" },
  },
  {
    id: "doc-olvido", title: "Glosa del barquero", family: "criptograma", theme: "epopeya", minFloor: 3, kindLabel: "Glosa marginal cifrada",
    lines: ["Al margen de un canto épico, seis signos de una lengua que nadie enseñó.", "La clave está incompleta: faltan dos signos."],
    quote: { text: "Lethaei ad fluminis undam securos latices et longa oblivia potant.", author: "Virgilio", work: "Eneida, VI" },
    cipher: "◬ ⟡ ⟟ ⟐ ⟒ ◬", key: { "◬": "O", "⟡": "L", "⟐": "I", "⟒": "D" },
    prompt: "Sustituye cada signo por su letra. Deduce los que faltan por el sentido de la cita.",
    tiles: ["O", "L", "V", "I", "D", "O", "E", "T"], answer: ["O", "L", "V", "I", "D", "O"],
    hints: ["Cuatro signos ya están en la clave; solo falta ⟟.", "Las almas beben del Leteo para… (en español).", "O L ? I D O"],
    deduction: "◬⟡⟟⟐⟒◬ = OLVIDO. ⟟ vale V. Es lo que las almas beben en el Leteo según Virgilio.",
    result: "La glosa añade: «Este bebió dos veces. Por eso no recuerda haber existido».",
    dict: ["oblivion", "olvido", "aeth"], reward: { kind: "escritura", pact: "vacio", label: "Escritura prohibida · Pacto del Vacío", desc: "Cada expedición empieza con el Pacto del Vacío sellado." },
  },
  {
    id: "doc-poe", title: "Página arrancada de un diario gótico", family: "frase", theme: "gotico", minFloor: 3, kindLabel: "Diario",
    lines: ["Palabras recortadas y pegadas fuera de orden:", "«dream · All · we · or · that · a · seem · within · is · but · see · dream»"],
    quote: { text: "All that we see or seem / Is but a dream within a dream.", author: "Edgar Allan Poe", work: "A Dream Within a Dream (1849)" },
    prompt: "Reconstruye el verso en su orden original.",
    tiles: ["dream", "All", "we", "or", "that", "a", "seem", "within", "is", "but", "see", "dream"],
    answer: ["All", "that", "we", "see", "or", "seem", "is", "but", "a", "dream", "within", "dream"],
    hints: ["Empieza con «All that».", "«All that we see or seem…»", "…is but a dream within (a) dream. Solo hay un «a»."],
    deduction: "Poe: todo lo que vemos o parecemos es solo un sueño dentro de un sueño. Al recorte le falta un «a», como si alguien hubiera borrado una parte.",
    result: "Debajo del verso: «¿Y si el soñador también es un borrador?».",
    dict: ["anima", "borrador"], memory: { title: "El soñador tachado", text: "Una mano te dibuja, duda, y pasa la goma. El papel conserva el surco." },
    reward: { kind: "recuerdo", label: "Recuerdo · El soñador tachado" },
  },
  {
    id: "doc-ausencia", title: "Índice de personas borradas", family: "semantica", theme: "identidad", minFloor: 4, kindLabel: "Registro",
    lines: ["Columnas de un archivo municipal. En lugar de nombres, descripciones:", "un nombre sin rostro · una fecha sin año · una sala sin paredes · una figura tachada · un hueco con forma de alguien"],
    prompt: "Asocia cada palabra recurrente con la descripción del registro que le corresponde.",
    pairs: [["NADIE", "un nombre sin rostro"], ["NUNCA", "una fecha sin año"], ["VACÍO", "una sala sin paredes"], ["BORRADOR", "una figura tachada"], ["AUSENCIA", "un hueco con forma de alguien"]],
    hints: ["NUNCA habla de tiempo.", "VACÍO habla de espacio; NADIE, de identidad.", "BORRADOR: algo que se tachó. AUSENCIA: el hueco que queda."],
    deduction: "Cada palabra describe una manera de no existir: sin identidad, sin tiempo, sin lugar, descartado, ausente.",
    result: "La última fila está en blanco, salvo una huella de pulgar que coincide con la tuya.",
    dict: ["ausencia", "inexistente", "nunca"], reward: { kind: "epifania", attr: "INT", amount: 1, label: "Epifanía AUSENCIA · +1 INT" },
  },
  {
    id: "doc-inconnu", title: "Dos cartas sobre un mismo pergamino", family: "palimpsesto", theme: "identidad", minFloor: 5, kindLabel: "Palimpsesto",
    lines: ["Dos textos raspados y reescritos sobre el mismo pergamino.", "Donde las dos capas coinciden, la tinta es más oscura."],
    layers: ["LAIENSCROTNPNDUM", "LOIRNECHOMNANBUS"],
    prompt: "Superpón las dos capas y ordena las letras que coinciden para leer el tercer mensaje.",
    tiles: ["L", "I", "N", "C", "O", "N", "N", "U", "E", "S"], answer: ["L", "I", "N", "C", "O", "N", "N", "U"],
    hints: ["Pulsa «Superponer capas».", "Solo cuentan las letras que son idénticas en la misma posición.", "Es un nombre en francés: L'·······"],
    deduction: "Coinciden L·I·N·C·O·N·N·U → L'INCONNU. El pergamino no fue escrito para ti… o sí.",
    result: "«Al que vendrá sin nombre: no busques quién fuiste. Busca quién te borró.»",
    dict: ["inconnu"], memory: { title: "Una vida anterior", text: "Un muelle, una lámpara, una mujer que te llama por un nombre que se disuelve antes de llegar. No sabes si era tu vida o la de otro." },
    reward: { kind: "tabula", label: "TABULA RASA", desc: "Al iniciar la próxima expedición recibes 1 punto de atributo extra para repartir." },
  },
];

export const docById = (id: string) => DOCS.find((d) => d.id === id);
export const dictById = (id: string) => DICTIONARY.find((d) => d.id === id);

/** Thematic library used to flavour procedural folios. */
export const LIBRARY: Record<Theme, string> = {
  existencialismo: "Filosofía y existencialismo", mitologia: "Mitología y religiones", gotico: "Literatura gótica y terror",
  epopeya: "Fantasía épica, tragedias y epopeyas", poesia: "Poesía y cuentos tradicionales", ocultismo: "Ocultismo, muerte, limbo y memoria",
  identidad: "Identidad, destino, vacío, ausencia y olvido",
};
