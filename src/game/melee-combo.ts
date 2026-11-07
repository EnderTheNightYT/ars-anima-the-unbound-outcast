/** Cadenas hack-and-slash cuerpo a cuerpo: cada golpe seguido avanza el combo,
 *  arrastra/sujeta al enemigo y el último golpe es un remate cargado según el arma.
 *  Browser-safe y puro: el motor sólo lee estos valores. */
import type { MeleeStyle } from "./combat-fx";

export type Finisher = "slam" | "thrust" | "sweep" | "uppercut";
export interface ComboStep {
  /** Multiplicador de daño del golpe. */ dmg: number;
  /** Velocidad aplicada al enemigo: negativa lo atrae hacia el jugador, positiva lo empuja. */ push: number;
  /** Impulso hacia delante del jugador (lunge). */ lunge: number;
  /** Elevación del enemigo (vz). */ lift: number;
  /** Bonus de Break. */ brk: number;
  label: string;
}
export interface ComboChain { steps: ComboStep[]; finisher: Finisher; finisherLabel: string }

/** Ventana (s) tras un golpe para encadenar el siguiente. */
export const COMBO_WINDOW = 1.1;
/** Distancia a la que los golpes intermedios "sujetan" al enemigo delante del jugador. */
export const HOLD_DIST = 1.1;

const s = (dmg: number, push: number, lunge: number, lift: number, brk: number, label: string): ComboStep => ({ dmg, push, lunge, lift, brk, label });

export const CHAINS: Record<MeleeStyle, ComboChain> = {
  // Espada / guadaña: tajos alternos que arrastran, remate de barrido lateral amplio.
  cut: { finisher: "sweep", finisherLabel: "BARRIDO FINAL", steps: [
    s(1, -1.2, 2.2, 0, 0, "TAJO"), s(1.1, -1.4, 2.4, 0, 1, "CONTRATAJO"), s(1.2, -1, 2.6, .8, 2, "ASCENDENTE"), s(1.9, 8.5, 3.2, 1.5, 6, "BARRIDO FINAL")] },
  // Martillo / hacha / mandoble: golpes pesados, remate que aplasta y lanza por los aires.
  smash: { finisher: "slam", finisherLabel: "MACHACAR", steps: [
    s(1, -.6, 1.6, 0, 1, "GOLPE"), s(1.2, -.8, 1.8, 0, 2, "REVÉS"), s(2.2, 10, 2.4, 4.5, 9, "MACHACAR")] },
  // Lanza / daga / bastón: estocadas rápidas que enganchan, remate que empala y empuja lejos en línea recta.
  pierce: { finisher: "thrust", finisherLabel: "EMPALAR", steps: [
    s(.9, -1.6, 2.8, 0, 0, "ESTOCADA"), s(.95, -1.8, 3, 0, 0, "PUNZADA"), s(1, -1.4, 3, 0, 1, "ENGANCHE"), s(1.1, -1.2, 3.2, 0, 1, "RÁFAGA"), s(1.8, 12, 4.2, .6, 5, "EMPALAR")] },
  // Puños: jab, jab, gancho y uppercut que eleva.
  punch: { finisher: "uppercut", finisherLabel: "UPPERCUT", steps: [
    s(.9, -1.5, 2.4, 0, 0, "JAB"), s(1, -1.5, 2.4, 0, 1, "DIRECTO"), s(1.2, -1, 2.6, 0, 2, "GANCHO"), s(1.8, 6, 2.8, 6, 6, "UPPERCUT")] },
};

/** Siguiente paso del combo: continúa si el golpe llega dentro de la ventana, si no vuelve al primero. */
export function nextComboStep(style: MeleeStyle, prevStep: number, sinceLast: number): number {
  const n = CHAINS[style].steps.length;
  if (sinceLast > COMBO_WINDOW || prevStep <= 0 || prevStep >= n) return 1;
  return prevStep + 1;
}
export function comboStep(style: MeleeStyle, step: number): ComboStep {
  const st = CHAINS[style].steps; return st[Math.max(0, Math.min(st.length, step) - 1)] ?? st[0]!;
}
export const isFinisher = (style: MeleeStyle, step: number) => step >= CHAINS[style].steps.length;

/** Velocidad de la cadena con clics rápidos: cada golpe encadenado sale antes
 *  (hack-and-slash) y el remate tiene una breve preparación más pesada. */
export function comboSwingMult(step: number, finisher: boolean): number {
  if (finisher) return 1.15;
  return Math.max(0.62, 1 - (step - 1) * 0.14);
}
