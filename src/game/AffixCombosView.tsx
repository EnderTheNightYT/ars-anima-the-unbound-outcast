import { useMemo, useState } from "react";
import { WEAPONS, type Item } from "./data";
import { AFFIX_IDS, FLOOR_COUNT, attackShape, floorComparison, weaponCombos } from "./affix-combos";

const n1 = (n: number) => Number(n.toFixed(1)).toLocaleString("es");
const nm = (s: string) => s.replace("_", " ");

/** Todas las combinaciones de inscripciones para un arma, con daño del combo/ráfaga, efectos y sinergias. */
export function AffixCombosView({ weapon, setWeapon, jump }: { weapon: string; setWeapon: (t: string) => void; jump: (id: string) => void }) {
  const [size, setSize] = useState(0);
  const [must, setMust] = useState("");
  const base = WEAPONS.find((w) => w.type === weapon) ?? WEAPONS[0]!;
  const shape = attackShape(base);
  const all = useMemo(() => weaponCombos(base), [base]);
  const shown = all.filter((c) => (!size || c.ids.length === size) && (!must || c.ids.includes(must as never)));
  return <div className="text-xs grid gap-2">
    <p>Todas las combinaciones posibles: {all.length} (1 a 4 inscripciones, sin repetir; las armas Legendarias llevan hasta 4). Calculado para un {base.ranged ? "disparo" : "combo completo"} de <button type="button" className="wiki-link" onClick={() => jump(`weapon:${base.type}`)}>{base.type}</button>: {shape.hits} impacto(s) de media {n1(shape.hit)}, arma ×1, sin crítico, con un enemigo vecino.</p>
    <div className="flex flex-wrap gap-1 items-center">
      <select aria-label="Arma" className="h-8 rounded border border-border bg-background px-1" value={base.type} onChange={(e) => setWeapon(e.target.value)}>{WEAPONS.map((w) => <option key={w.type}>{w.type}</option>)}</select>
      <select aria-label="Cantidad" className="h-8 rounded border border-border bg-background px-1" value={size} onChange={(e) => setSize(Number(e.target.value))}><option value={0}>Cantidad: todas</option>{[1, 2, 3, 4].map((k) => <option key={k} value={k}>{k} inscripción(es)</option>)}</select>
      <select aria-label="Incluye" className="h-8 rounded border border-border bg-background px-1" value={must} onChange={(e) => setMust(e.target.value)}><option value="">Incluye: cualquiera</option>{AFFIX_IDS.map((a) => <option key={a} value={a}>{nm(a)}</option>)}</select>
      <span className="text-muted-foreground">{shown.length} resultados · ordenadas por daño total</span>
    </div>
    <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="text-muted-foreground"><th className="p-1">Inscripciones</th><th className="p-1">Directo</th><th className="p-1">Continuo</th><th className="p-1">Salto/estallido</th><th className="p-1">Total</th><th className="p-1">Cura</th><th className="p-1">Break/golpe</th><th className="p-1">Efectos y sinergias</th></tr></thead>
      <tbody>{shown.slice(0, 120).map((c) => <tr key={c.key} className="border-t border-border align-top">
        <td className="p-1">{c.ids.map((a) => <button key={a} type="button" className="wiki-link mr-1" onClick={() => jump(`affix:${a}`)}>{nm(a)}</button>)}</td>
        <td className="p-1">{n1(c.direct)}</td><td className="p-1">{c.dot ? `+${c.dot}` : "—"}</td><td className="p-1">{c.chain || c.blast ? `+${n1(c.chain + c.blast)}` : "—"}</td>
        <td className="p-1"><b>{n1(c.total)}</b></td><td className="p-1">{c.heal ? `${n1(c.heal)} PV` : "—"}</td><td className="p-1">{c.breakPerHit}</td>
        <td className="p-1 text-muted-foreground">{c.refill ? "Baja: +3 munición y Aguante lleno. " : ""}{c.synergies.join(" ") || "Sin sinergia especial."}</td></tr>)}</tbody></table></div>
    {shown.length > 120 && <p className="text-muted-foreground">Mostrando 120 de {shown.length}; filtra por cantidad o inscripción para ver el resto.</p>}
    <p className="text-muted-foreground">Continuo: sangrado 10, fuego 12, veneno 12 por objetivo (se renuevan con cada golpe, no se apilan consigo mismos). Salto: 50% al vecino. Estallido: 10% por impacto, 60% en área. DADO LOCO: media ×1,25.</p>
  </div>;
}

/** Comparador por piso: daño medio esperado, combo y mejor inscripción alcanzable de cada arma, más las armas que llevas. */
export function FloorCompare({ owned = [], current = 1, jump, openCombos }: { owned?: Item[]; current?: number; jump: (id: string) => void; openCombos: (t: string) => void }) {
  const [floor, setFloor] = useState(Math.min(FLOOR_COUNT, Math.max(1, current + (owned.length ? 1 : 0))));
  const [sort, setSort] = useState<"attack" | "dps" | "bestTotal">("dps");
  const rows = useMemo(() => floorComparison(floor, owned), [floor, owned]);
  const mine = rows.filter((r) => r.owned), pool = rows.filter((r) => !r.owned).sort((a, b) => b[sort] - a[sort]);
  const top = pool[0];
  const Row = ({ r }: { r: (typeof rows)[number] }) => <tr className={`border-t border-border align-top ${r.owned ? "wiki-focus" : ""}`}>
    <td className="p-1"><button type="button" className="wiki-link" onClick={() => jump(`weapon:${r.type}`)}>{r.owned ?? r.type}</button>{r.owned && <span className="block text-muted-foreground">Tuya · {r.type}</span>}</td>
    <td className="p-1">×{r.mult}</td><td className="p-1">{r.hits}</td><td className="p-1">{n1(r.attack)}</td><td className="p-1"><b>{n1(r.dps)}</b></td>
    <td className="p-1">{r.best.ids.length ? r.best.ids.map(nm).join(" + ") : "Ninguna"} → <b>{n1(r.bestTotal)}</b></td>
    <td className="p-1"><button type="button" className="wiki-link" onClick={() => openCombos(r.type)}>combinaciones</button></td></tr>;
  return <div className="text-xs grid gap-2">
    <div className="flex flex-wrap gap-1 items-center">
      <span>Piso</span>{Array.from({ length: FLOOR_COUNT }, (_, i) => i + 1).map((f) => <button key={f} type="button" className={`tab ${f === floor ? "tab-active" : ""}`} onClick={() => setFloor(f)}>{f}{f === current ? " (actual)" : ""}</button>)}
      <select aria-label="Ordenar" className="h-8 rounded border border-border bg-background px-1 ml-auto" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
        <option value="dps">Ordenar: daño por segundo</option><option value="attack">Ordenar: daño por combo/disparo</option><option value="bestTotal">Ordenar: con mejor inscripción</option></select>
    </div>
    {top && <p>Mejor apuesta en el piso {floor}: <b className="text-rarity-2">{top.type}</b> ({n1(top[sort])}). {mine.length ? `Tu mejor arma: ${[...mine].sort((a, b) => b[sort] - a[sort])[0]!.owned} (${n1([...mine].sort((a, b) => b[sort] - a[sort])[0]![sort])}).` : ""}</p>}
    <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="text-muted-foreground"><th className="p-1">Arma</th><th className="p-1">Daño ×</th><th className="p-1">Impactos</th><th className="p-1">Combo/disparo</th><th className="p-1">Daño/s</th><th className="p-1">Mejor inscripción probable → total</th><th className="p-1"></th></tr></thead>
      <tbody>{mine.map((r) => <Row key={`m${r.owned}`} r={r} />)}{pool.map((r) => <Row key={r.type} r={r} />)}</tbody></table></div>
    <p className="text-muted-foreground">Armas del suelo: multiplicador medio según la probabilidad de calidad de ese piso (Común a Legendaria) y la mejor combinación de inscripciones que puede salir allí. Tus armas usan su daño e inscripciones reales. Sin críticos, atributos ni defensa; sirve para comparar, no predice el combate.</p>
  </div>;
}
