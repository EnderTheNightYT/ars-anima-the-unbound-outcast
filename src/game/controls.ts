// Browser-safe control and mechanics reference shown at the bottom of the start menu.
// Keep in sync with GameView.tsx (keyboard/mouse), gamepad.ts (pads) and engine.ts (Input handling).

export interface ControlGroup { title: string; lines: string[] }

/** PC: teclado y ratón. */
export const PC_CONTROLS: ControlGroup[] = [
  {
    title: "DESPLAZARSE",
    lines: [
      "W / S o ↑ / ↓ · avanzar y retroceder · A / D · paso lateral",
      "Ratón · mirar y apuntar",
      "Shift (mantener) o R · correr",
      "Espacio · saltar",
      "C o Ctrl · agacharse (quieto) o deslizarse (corriendo)",
      "N · sigilo",
    ],
  },
  {
    title: "ACROBACIA",
    lines: [
      "Shift (toque rápido) o Alt · dash",
      "Espacio en el aire · doble salto",
      "Espacio pegado a una pared · salto de pared",
      "C o Ctrl en el aire · MACHACAR (pisotón)",
      "Deslizarte · barre enemigos y apaga tu fuego",
    ],
  },
  {
    title: "COMBATE",
    lines: [
      "Clic izq · atacar (mantener = golpe cargado) · disparar",
      "Clic der · apuntar (a distancia) o cargar (cuerpo a cuerpo)",
      "H · bloqueo · P · parry (devuelve el golpe en la ventana justa)",
      "V o clic central · patada · G · agarrar",
      "F · remate / ejecución (glorykill)",
      "Z · nova · X · bomba",
      "B · habilidad activa de tu clase (se recarga por tiempo, muertes, golpes o daño)",
      "Q · cambiar de arma · alternar armas suma ALTERNANCIA",
      "T · recargar · U · pacto",
    ],
  },
  {
    title: "OBJETOS Y MENÚS",
    lines: [
      "E · usar lo que tienes más cerca y delante",
      "1 · venda · 2 · ración · 3 · agua · 4 · antídoto · 5 · espejo",
      "Tab o I · mochila y atributos · K · habilidades · B · crafteo",
      "J · diario · M · mapa · Esc · menú",
    ],
  },
];

/** Mando o joystick con mapeo estándar (Xbox / PlayStation / la mayoría de los OTG). */
export const PAD_CONTROLS: ControlGroup[] = [
  {
    title: "DESPLAZARSE",
    lines: [
      "Stick izq · mover (a fondo corre)",
      "Stick der · mirar",
      "A · saltar",
      "Cruceta ↑ · deslizar o agacharse quieto",
    ],
  },
  {
    title: "ACROBACIA",
    lines: [
      "B · dash",
      "A en el aire · doble salto",
      "A pegado a una pared · salto de pared",
      "Cruceta ↑ en el aire · MACHACAR (pisotón)",
    ],
  },
  {
    title: "COMBATE",
    lines: [
      "RT · atacar · LT · cargar / apuntar",
      "RB · guardia · LB · parry",
      "Cruceta ↓ · patada · L3 · remate · R3 · agarrar",
      "Cruceta ← · nova · Cruceta → · bomba",
      "Select + B · habilidad activa de clase",
      "X · usar objeto · Y · cambiar de arma",
      "Select + X · activar pacto · Select + Y · ver pactos",
    ],
  },
  {
    title: "MENÚS",
    lines: [
      "Start · menú · Select · mapa",
      "En menús: cruceta + A para elegir",
      "En mandos genéricos sin mapeo estándar, la cruceta puede invertirse",
    ],
  },
];

/** Todas las mecánicas del juego, con su efecto. */
export const MECHANICS: ControlGroup[] = [
  {
    title: "MOVIMIENTO",
    lines: [
      "Correr gasta resistencia; el sigilo te hace más difícil de ver.",
      "Agachado o deslizándote tu caja es más chica: los tiros al pecho te pasan por encima y los golpes cuerpo a cuerpo tienen menos alcance.",
      "Dash: dos cargas; sirve para cruzar huecos y esquivar.",
      "Doble salto, salto de pared y machacar te llevan a cornisas, columnas y conductos.",
    ],
  },
  {
    title: "CONDUCTOS BAJOS",
    lines: [
      "Las franjas ámbar marcan un conducto: solo pasa un cuerpo agachado o deslizándose.",
      "Si te levantas adentro, quedas agachado y el juego te lo avisa.",
    ],
  },
  {
    title: "COMBATE",
    lines: [
      "Golpes cargados y apuntados hacen más daño; la alternancia de armas lo multiplica.",
      "Bloquear, esquivar o devolver un ataque suma puntaje; el parry perfecto no recibe daño.",
      "Rematar a un enemigo aturdido es una ejecución: da más puntos que un tiro común.",
      "Fuego, veneno y sangrado te restan vida de a poco y avisan de qué se trata.",
    ],
  },
  {
    title: "SUPERVIVENCIA",
    lines: [
      "Hambre y sed avisan cuando faltan y te debilitan; no te bajan la vida por sí solas.",
      "La lumbre del farol se gasta; sentarte en una banca grande la recarga.",
      "Comer, beber, curar y usar antídotos o tónicos consume objetos.",
    ],
  },
  {
    title: "MUNDO",
    lines: [
      "Cofres, barriles (detonables) y objetos sueltos dan puntaje al recogerlos.",
      "Puertas: se abren con llave o se revientan a golpes; algunas están selladas y piden otra cosa.",
      "El mercader errante aparece muy de vez en cuando en zonas lejanas; vende y compra.",
      "Secretos, salas ocultas, el mapa, el portal y el jefe suman lo más valioso de la run.",
    ],
  },
  {
    title: "PROGRESO",
    lines: [
      "Subir de nivel reparte puntos de atributo; las habilidades se eligen en el árbol.",
      "Misiones, pactos y contratos se ofrecen al conversar con el vendedor.",
      "Crafteo: dos objetos y materiales se combinan en recetas.",
      "El puntaje premia el mérito y castiga el daño, el gasto y la lentitud; al terminar el piso ves el recuento y recibes un bono de fichas.",
    ],
  },
];
