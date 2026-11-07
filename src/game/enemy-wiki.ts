/** Fichas de enemigos para la wiki: estadísticas reales de ENEMY_TYPES, escalado por piso y consejos según su patrón. Browser-safe. */
import { ENEMY_TYPES } from "./data";
import { floorPressure } from "./progression";
import { evolution, threatLevel } from "./evolution";

interface Pattern { label: string; attacks: string[]; behavior: string; beat: string; dodge: string }
const P: Record<string, Pattern> = {
  chase: { label: "Perseguidor", attacks: ["Zarpazo cuerpo a cuerpo al alcanzarte"], behavior: "Corre directo hacia ti en cuanto te detecta.", beat: "Retrocede mientras golpeas: un combo de 3 golpes o una patada al llegar lo frena.", dodge: "Dash lateral justo antes del zarpazo; nunca le des la espalda en pasillos." },
  ranged: { label: "Tirador", attacks: ["Proyectil a media distancia", "Se reposiciona en zigzag"], behavior: "Mantiene 4–7 casillas y prefiere coberturas elevadas.", beat: "Cierra distancia por los lados o usa tu arma a distancia; cae rápido de cerca.", dodge: "Muévete en perpendicular al disparo; agacharte esquiva tiros altos." },
  charger: { label: "Embestidor", attacks: ["Embestida en línea recta tras una carga visible", "Golpe pesado de cerca"], behavior: "Se planta, carga y embiste; queda expuesto tras fallar.", beat: "Esquiva la embestida y castiga su espalda: tras un fallo recibe más daño.", dodge: "Dash lateral al ver la carga; si choca contra una pared queda aturdido." },
  blink: { label: "Teletransportador", attacks: ["Golpe tras reaparecer a tu lado"], behavior: "Desaparece y reaparece a ~2 casillas de ti.", beat: "Golpes amplios (barrido) cubren el punto donde reaparece; tiene poca vida.", dodge: "Gira al oír el destello y bloquea; el parry funciona muy bien." },
  brute: { label: "Bruto", attacks: ["Golpe aplastante lento", "Barrido corto"], behavior: "Lento pero aguanta mucho y rompe tu guardia.", beat: "Acumula Break con golpes pesados; cuando se derrumba, remata.", dodge: "Sal de su alcance tras el telegrafiado; no bloquees sin escudo." },
  caster: { label: "Lanzador", attacks: ["Proyectil mágico", "Área retardada"], behavior: "Lanza a distancia y se aleja si te acercas.", beat: "Presiona de cerca; interrumpe su conjuro con patada.", dodge: "Sal del círculo antes de que estalle; dash atraviesa el proyectil." },
  witch: { label: "Bruja", attacks: ["Maldición a distancia", "Nube dañina"], behavior: "Combina proyectiles y nubes que te quitan vida con el tiempo.", beat: "Prioriza matarla primero; cuidado con quemaduras/veneno.", dodge: "No pelees dentro de sus nubes; rodéala." },
  gunner: { label: "Artillero", attacks: ["Ráfaga de varios disparos"], behavior: "Dispara en ráfagas y recarga entre ellas.", beat: "Ataca en la pausa de recarga.", dodge: "Cúbrete tras pilares durante la ráfaga." },
  sniper: { label: "Francotirador", attacks: ["Disparo cargado de largo alcance"], behavior: "Apunta mucho tiempo desde lejos y dispara fuerte.", beat: "Acércate en zigzag; muere rápido cuerpo a cuerpo.", dodge: "Rompe la línea de visión o haz dash justo cuando brilla." },
  bomber: { label: "Bombardero", attacks: ["Bombas en parábola con área"], behavior: "Lanza explosivos sobre tu posición.", beat: "Acércate para que no pueda lanzar sin dañarse.", dodge: "Muévete en cuanto veas la bomba en el aire." },
  pounce: { label: "Saltador emboscado", attacks: ["Salto sobre ti desde lejos", "Desgarro"], behavior: "Acecha y salta para cerrar distancia.", beat: "Parry al salto: queda expuesto al aterrizar.", dodge: "Dash hacia atrás en el despegue." },
  jumper: { label: "Saltarín", attacks: ["Salto vertical y caída"], behavior: "Salta entre plataformas y cae sobre ti.", beat: "Golpéalo al aterrizar.", dodge: "No te quedes quieto bajo él." },
  flanker: { label: "Flanqueador", attacks: ["Golpe por la espalda"], behavior: "Te rodea para atacarte por detrás.", beat: "Pégate a una pared para reducir sus ángulos.", dodge: "Gira constantemente; usa el dash para recolocarte." },
  guard: { label: "Guardián con escudo", attacks: ["Golpe de escudo", "Bloqueo frontal"], behavior: "Bloquea golpes de frente.", beat: "Patada o golpe cargado rompe su guardia; ataca por el flanco.", dodge: "Su golpe es lento: retrocede y contraataca." },
  knight: { label: "Caballero", attacks: ["Combo de espada de 2–3 golpes", "Estocada"], behavior: "Duelista: combina defensa y combos.", beat: "Parry en su último golpe y riposta.", dodge: "Cuenta sus golpes y esquiva el último." },
  hook: { label: "Gancho", attacks: ["Gancho que te arrastra hacia él", "Golpe"], behavior: "Te atrae a su alcance.", beat: "Rompe la línea de visión; castiga tras lanzar el gancho.", dodge: "Dash lateral cuando lo lanza." },
  leech: { label: "Sanguijuela", attacks: ["Mordisco que drena vida"], behavior: "Se cura con tu sangre.", beat: "Mátala rápido con daño alto; no le dejes alargar la pelea.", dodge: "Mantén distancia y usa armas a distancia." },
  splitter: { label: "Divisor", attacks: ["Golpe", "Se divide al morir"], behavior: "Al morir se separa en criaturas menores.", beat: "Usa área (machacar) para matar a los fragmentos juntos.", dodge: "Retrocede tras matarlo para no quedar rodeado." },
  spore: { label: "Portador de esporas", attacks: ["Nube de plaga", "Veneno"], behavior: "Deja nubes tóxicas.", beat: "Ataca a distancia o con golpes rápidos y sal.", dodge: "No respires su nube: aléjate de las zonas verdes." },
  webber: { label: "Tejedora", attacks: ["Telaraña que ralentiza", "Mordisco"], behavior: "Te ralentiza para castigarte.", beat: "Corta sus redes con golpes y presiona.", dodge: "Dash fuera de la telaraña." },
  screamer: { label: "Grito", attacks: ["Grito que aterra y alerta"], behavior: "Avisa a los demás y sube tu terror.", beat: "Mátalo primero, en sigilo si puedes.", dodge: "Corta su grito acercándote rápido." },
  siren: { label: "Sirena", attacks: ["Canto que te atrae", "Golpe de agua"], behavior: "Te empuja hacia ella o hacia el peligro.", beat: "Resiste el tirón alejándote y dispárale.", dodge: "Muévete contra el tirón del canto." },
  drummer: { label: "Tambor de guerra", attacks: ["Aura que potencia aliados"], behavior: "Refuerza a los enemigos cercanos.", beat: "Prioridad: sin él los demás se debilitan.", dodge: "Atraviesa la formación con dash." },
  banner: { label: "Portaestandarte", attacks: ["Estandarte que potencia aliados", "Golpe"], behavior: "Da ventajas a su grupo.", beat: "Derríbalo primero.", dodge: "Separa al grupo usando pasillos." },
  engineer: { label: "Ingeniero", attacks: ["Mecanismos y trampas", "Disparo"], behavior: "Prepara el terreno.", beat: "Presiónalo antes de que monte trampas.", dodge: "Mira el suelo: evita los mecanismos armados." },
  bishop: { label: "Obispo", attacks: ["Proyectiles sagrados", "Invocación"], behavior: "Lanza y llama refuerzos.", beat: "Acércate y mantenlo ocupado.", dodge: "Rodea en círculo sus proyectiles." },
  zealot: { label: "Fanático", attacks: ["Ataque suicida o frenético"], behavior: "Se lanza sin miedo y explota o golpea fuerte.", beat: "Mátalo a distancia o empújalo con patada.", dodge: "Retrocede cuando brilla." },
  mimic: { label: "Imitador", attacks: ["Copia tus ataques"], behavior: "Imita tu estilo de combate.", beat: "Cambia de arma y ritmo para descolocarlo.", dodge: "Esquiva igual que esquivarías tus propios golpes." },
  boss: { label: "Jefe", attacks: ["Varios patrones por fases", "Sella dash, magia o recarga cada pocos segundos"], behavior: "Cambia de patrón y bloquea acciones temporalmente.", beat: "Lee el aviso de sello y adapta; acumula Break para derribarlo.", dodge: "Mantén aguante para el dash y guarda pociones." },
};
const fallback: Pattern = { label: "Especial", attacks: ["Golpe cuerpo a cuerpo"], behavior: "Comportamiento propio.", beat: "Observa su patrón antes de comprometerte.", dodge: "Dash lateral ante cualquier telegrafiado." };

export function enemySheet(id: string) {
  const e = (ENEMY_TYPES as Record<string, { name: string; hp: number; def: number; brk: number; speed: number; dmg: number; pattern: string }>)[id];
  if (!e) return null;
  const p = P[e.pattern] ?? fallback;
  const scale = [1, 3, 6].map(floor => { const fp = floorPressure(floor), ev = evolution(threatLevel(floor, 0, floor * 2));
    return { floor, hp: Math.round(e.hp * fp.hp * ev.hp), dmg: Math.round(e.dmg * fp.damage * ev.damage), def: e.def + ev.def }; });
  const danger = e.hp * e.dmg * e.speed;
  return { ...e, pattern: p, scale, danger: danger > 900 ? "Muy alta" : danger > 450 ? "Alta" : danger > 220 ? "Media" : "Baja",
    hitsToBreak: Math.ceil(e.brk / 4) };
}
