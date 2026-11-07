import soldado from '@/assets/enemies/soldado.png';
import hereje from '@/assets/enemies/hereje.png';
import bestia from '@/assets/enemies/bestia.png';
import automata from '@/assets/enemies/automata.png';
import bruja from '@/assets/enemies/bruja.png';
import ahogado from '@/assets/enemies/ahogado.png';
import tahur from '@/assets/enemies/tahur.png';
import acechador from '@/assets/enemies/acechador.png';
import fanatico from '@/assets/enemies/fanatico.png';
import behemoth from '@/assets/enemies/behemoth.png';
import screamer from '@/assets/enemies/screamer.png';
import caballero from '@/assets/enemies/caballero.png';
import ballestero from '@/assets/enemies/ballestero.png';
import alquimista from '@/assets/enemies/alquimista.png';
import obispo from '@/assets/enemies/obispo.png';
import tejedora from '@/assets/enemies/tejedora.png';
import relojero from '@/assets/enemies/relojero.png';
import portaestandarte from '@/assets/enemies/portaestandarte.png';
import sirena from '@/assets/enemies/sirena.png';
import sanguijuela from '@/assets/enemies/sanguijuela.png';
import portador from '@/assets/enemies/portador.png';
import golem from '@/assets/enemies/golem.png';
import espejo from '@/assets/enemies/espejo.png';
const SOURCES: Record<string, string> = { soldado, hereje, bestia, automata, bruja, ahogado, tahur, acechador, fanatico, behemoth, screamer, caballero, ballestero, alquimista, obispo, tejedora, relojero, portaestandarte, sirena, sanguijuela, portador, golem, espejo };
export async function loadEnemySprites() {
  const out: Record<string, HTMLImageElement> = {};
  await Promise.all(Object.entries(SOURCES).map(async ([k, src]) => { const i = new Image(); i.src = src; await i.decode(); out[k] = i; }));
  return out;
}
