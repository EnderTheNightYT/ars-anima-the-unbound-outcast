import { useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { ArrowLeftRight, Check, LoaderCircle, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { recommendWeapons } from '@/lib/weapon-recommendations.functions';
import { advisorItem, type WeaponAdvice } from './weapon-recommendations';
import { weaponFacts, weaponDifference } from './weapon-comparison';
import { weaponCategory, canUseWeapon, weaponLevel, weaponLockInfo } from './weapon-access';
import { RARITY, AFFIXES, type Item } from './data';
import { ART } from './art';
import { classPassives } from './class-passives';
import type { Game } from './engine';
import { ForgePanel, WearBar } from './ForgePanel';
import { ensureWear } from './weapon-wear';
import { CARRY_LIMIT, itemWeight, sellPrice } from './carry';

const rarityClasses = ['text-rarity-0','text-rarity-1','text-rarity-2','text-rarity-3','text-rarity-4'];
function LockProgress({ item, g }: { item: Item; g: Game }) {
  const lock = weaponLockInfo(item,g.level,g.xp,g.xpNext);
  if (item.kind !== 'weapon') return null;
  return <div className="mt-2 space-y-1 text-xs">
    <div className={lock.locked ? 'text-destructive' : 'text-rarity-1'}>{lock.locked ? 'Bloqueada' : 'Disponible'} · Nivel {lock.req} / tu nivel {g.level}</div>
    {lock.locked && <><progress className="unlock-progress w-full" aria-label={`Progreso de ${item.name}`} max={lock.req} value={g.level} /><div className="text-rarity-2">Faltan {lock.missing} nivel{lock.missing === 1 ? '' : 'es'} · {lock.xpMissing.toLocaleString('es')} XP</div></>}
  </div>;
}
function ItemDetails({ item, g }: { item: Item; g: Game }) {
  const f = weaponFacts(item);
  return <div className="min-w-0 break-words">
    <div className="text-xs text-muted-foreground">Peso {itemWeight(item)} · Venta {sellPrice(item)}✦</div>
    <div className="grid grid-cols-[32px_minmax(0,1fr)] items-center gap-2"><img className="item-sprite" src={ART.relic} alt="" /><div><h4 className={`${rarityClasses[item.rarity]} text-base`}>{item.name}</h4><span className="text-xs text-muted-foreground">{RARITY[item.rarity]} · {f ? f.ranged ? 'Distancia' : 'Cuerpo a cuerpo' : 'Armadura'}</span></div></div>
    {f ? <><div className="mt-2 text-sm text-muted-foreground">{f.dice} ×{f.multiplier} · crít +{f.crit}% · precisión +{f.accuracy} · Break {f.break}</div><div className="text-xs text-accent">{item.affixes?.map(a => <div key={a}><button type="button" className="wiki-link" onClick={(e) => { e.stopPropagation(); g.openWiki(`affix:${a}`); }}>{a}</button>: {AFFIXES[a]}</div>)}</div></> : <p className="text-sm text-muted-foreground">DEF +{item.def}</p>}
    <WearBar item={item} />
    <LockProgress item={item} g={g} />
    {item.base && <button type="button" className="wiki-link mt-1" onClick={(e) => { e.stopPropagation(); g.openWiki(`weapon:${item.base!.type}`); }}>📖 Ver {item.base.type} en la wiki</button>}
  </div>;
}
function Filter({ label, value, options, onChange }: { label: string; value: string; options: readonly (readonly [string,string])[]; onChange: (value: string) => void }) {
  return <div className="min-w-0"><label className="mb-1 block text-xs text-muted-foreground">{label}</label><Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="bg-muted h-11 min-w-0"><SelectValue /></SelectTrigger><SelectContent>{options.map(([id,name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select></div>;
}
function equippedFor(g: Game, item: Item) { return item.kind === 'armor' ? g.armor : item.base?.ranged ? g.ranged : g.melee; }
function statRows(item: Item | null | undefined) {
  if (!item) return [] as [string, number][];
  if (item.kind === 'armor') return [['Defensa', item.def ?? 0]] as [string, number][];
  const f = weaponFacts(item); if (!f) return [];
  ensureWear(item);
  return [['Daño medio', f.damage], ['Alcance', f.range], ['Intervalo (s)', f.interval], ['Break', f.break], ['Crítico +%', f.crit], ['Precisión +', f.accuracy], ['Durabilidad', item.dur ?? 0], ['Nivel forja', item.wlvl ?? 0], ['Efectos', item.affixes?.length ?? 0]] as [string, number][];
}
/** Compara lo que tienes puesto con el objeto bajo el ratón (o tocado). */
function HoverCompare({ g, item }: { g: Game; item: Item | null }) {
  if (!item) return <div className="hover-compare text-xs text-muted-foreground">Pasa el ratón (o toca) un arma o armadura para compararla con la que llevas puesta.</div>;
  const worn = equippedFor(g, item);
  const a = statRows(worn), b = statRows(item);
  const lowerBetter = new Set(['Intervalo (s)']);
  return <div className="hover-compare" aria-live="polite">
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 text-xs">
      <span className="text-muted-foreground">Comparación</span><span className="text-rarity-1 text-right">Puesto</span><span className="text-rarity-2 text-right">Seleccionado</span>
      <span /><span className="text-right truncate max-w-28">{worn?.name ?? '—'}</span><span className="text-right truncate max-w-28">{item.name}</span>
      {b.map(([label, v]) => { const w = a.find(r => r[0] === label)?.[1]; const d = w === undefined ? 0 : +(v - w).toFixed(2); const good = lowerBetter.has(label) ? d < 0 : d > 0;
        return <div key={label} className="contents"><span className="text-muted-foreground">{label}</span><span className="text-right">{w ?? '—'}</span><span className={`text-right ${d === 0 || worn === item ? '' : good ? 'text-rarity-1' : 'text-destructive'}`}>{v}{worn !== item && d !== 0 ? ` (${d > 0 ? '+' : ''}${d})` : ''}</span></div>; })}
    </div>
    {worn === item && <p className="text-[10px] text-muted-foreground mt-1">Este es el objeto que llevas puesto.</p>}
  </div>;
}
export function InventoryPanel({ g, rerender }: { g: Game; rerender: () => void }) {
  const [type,setType] = useState('todas'), [state,setState] = useState('todas'), [sort,setSort] = useState('entrada');
  const [selected,setSelected] = useState<number[]>([]), [compare,setCompare] = useState(false), [advisor,setAdvisor] = useState(false);
  const [style,setStyle] = useState(''), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const [advice,setAdvice] = useState<WeaponAdvice>([]);
  const [hoverId,setHoverId] = useState<number | null>(null), [forge,setForge] = useState(false);
  const inFlight = useRef(false);
  const request = useServerFn(recommendWeapons);
  const current = [g.melee,g.ranged,...g.bag].filter((it): it is Item => Boolean(it));
  const hovered = hoverId === null ? null : [g.melee,g.ranged,g.armor,...g.bag].find(it => it?.uid === hoverId) ?? null;
  const hoverProps = (item: Item) => ({ onMouseEnter: () => setHoverId(item.uid), onFocus: () => setHoverId(item.uid), onClick: () => setHoverId(item.uid) });
  const selectedItems = selected.map(uid => current.find(it => it.uid === uid)).filter((it): it is Item => Boolean(it));
  const weapons = g.bag.filter(it => it.kind === 'weapon' && it.base);
  const shown = g.bag.filter(it => type === 'todas' || weaponCategory(it) === type).filter(it => state === 'todas' || (state === 'bloqueadas') === !canUseWeapon(it,g.level));
  if (sort === 'tipo') shown.sort((a,b) => weaponCategory(a).localeCompare(weaponCategory(b)) || a.name.localeCompare(b.name));
  if (sort === 'estado') shown.sort((a,b) => Number(canUseWeapon(b,g.level))-Number(canUseWeapon(a,g.level)));
  if (sort === 'requisito') shown.sort((a,b) => weaponLevel(b)-weaponLevel(a));
  if (sort === 'cercania') shown.sort((a,b) => Math.max(0,weaponLevel(a)-g.level)-Math.max(0,weaponLevel(b)-g.level));
  function equip(item: Item) { g.equip(item.uid); rerender(); }
  function toggle(uid: number) { setSelected(ids => ids.includes(uid) ? ids.filter(id => id !== uid) : [...ids.filter(id => current.some(it => it.uid === id)),uid].slice(-3)); }
  async function recommend() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setAdvice([]);
    try {
      const result = await request({ data: { style, level:g.level, rating:g.rating, score:g.score, floor:g.floor, className:g.cls.name, ammo:g.ammo, weapons:weapons.slice(0,100).map(advisorItem) } });
      if (result.ok) setAdvice(result.recommendations); else setError(result.error);
    } catch { setError('No se pudo consultar a la IA. Tu comparación sigue disponible.'); }
    finally { setBusy(false); inFlight.current = false; }
  }
  return <section className="inventory-panel font-pixel space-y-4">
    <div className="text-sm text-rarity-2">Capacidad {g.carryWeight().toFixed(1)} / {CARRY_LIMIT}</div>
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"><h3 className="title-gothic text-xl text-rarity-2 min-w-0">Mochila</h3><span className="text-sm text-gold shrink-0">{g.gold} fichas</span></div>
    <div className="border-y border-border py-3 space-y-2"><h4 className="text-rarity-2">Habilidades de {g.cls.name}</h4><ul className="grid gap-2 sm:grid-cols-3">{classPassives(g.cls.id).map(p => { const on = g.level >= p.level; return <li key={p.id} className={`rounded border border-border p-2 text-sm min-w-0 ${on ? 'bg-muted' : 'opacity-60'}`}><div className="flex flex-wrap items-center justify-between gap-1"><span className={on ? 'text-rarity-2' : 'text-muted-foreground'}>{p.name}</span><span className="text-xs text-muted-foreground">{p.kind} · {on ? 'activa' : `Nv ${p.level}`}</span></div><p className="text-xs text-muted-foreground break-words">{p.desc}</p></li>; })}</ul></div>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{['venda','racion','agua','antidoto','tonico','espejo'].map(k => <Button key={k} variant="outline" className="h-11 font-pixel" disabled={!g.cons[k]} onClick={() => { g.use(k); rerender(); }}>{k.toUpperCase()} ×{g.cons[k] ?? 0}</Button>)}</div>
    <div className="border-y border-border py-3 space-y-2"><h4 className="text-rarity-2">Equipado</h4><div className="grid gap-2 sm:grid-cols-3">{[g.melee,g.ranged,g.armor].filter((it): it is Item => !!it).map(it => <div key={it.uid} tabIndex={0} {...hoverProps(it)} className={`rounded border p-2 bg-muted ${hoverId === it.uid ? 'border-primary' : 'border-border'}`}><ItemDetails item={it} g={g} /></div>)}</div></div>
    <div className="sticky top-0 z-10"><HoverCompare g={g} item={hovered} /></div>
    <Button variant={forge ? 'default' : 'outline'} className="w-full min-h-11" onClick={() => setForge(!forge)}>Forja: reparar · mejorar · efectos</Button>
    {forge && <ForgePanel g={g} rerender={rerender} />}
    <div className="grid grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-3 gap-2"><Filter label="Tipo" value={type} onChange={setType} options={[["todas","Todos"],["cuerpo","Cuerpo a cuerpo"],["distancia","Distancia"],["otro","Otros"]]} /><Filter label="Estado" value={state} onChange={setState} options={[["todas","Todos"],["disponibles","Disponibles"],["bloqueadas","Bloqueadas"]]} /><div className="min-[380px]:col-span-2 sm:col-span-1"><Filter label="Orden" value={sort} onChange={setSort} options={[["entrada","Recogida"],["tipo","Tipo"],["estado","Estado"],["requisito","Mayor requisito"],["cercania","Más cerca de desbloquear"]]} /></div></div>
    <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2"><Button variant={compare ? 'default' : 'outline'} className="h-auto min-h-11 whitespace-normal" onClick={() => setCompare(!compare)}><ArrowLeftRight size={16} />Comparar ({selectedItems.length})</Button><Button variant={advisor ? 'default' : 'outline'} className="h-auto min-h-11 whitespace-normal" onClick={() => setAdvisor(!advisor)}><Sparkles size={16} />Mi estilo · IA</Button></div>
    {advisor && <div className="border-y border-border py-4 space-y-3"><label htmlFor="weapon-style" className="text-rarity-2">Tu estilo de juego</label><Textarea id="weapon-style" value={style} onChange={e => setStyle(e.target.value)} maxLength={600} disabled={busy} placeholder="Prefiero mantener distancia, ahorrar munición y causar sangrado…" className="bg-muted min-h-24 text-base" /><Button disabled={busy || style.trim().length < 5 || !weapons.length} onClick={recommend} className="w-full min-h-11">{busy ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}{busy ? 'Consultando…' : 'Recomendar armas'}</Button>{!weapons.length && <p className="text-sm text-muted-foreground">No hay armas en la mochila.</p>}{error && <p role="alert" className="text-sm text-destructive break-words">{error}</p>}
      {advice.map(r => { const item = current.find(it => it.uid === r.uid); if (!item) return null; const inBag = g.bag.some(it => it.uid === item.uid); return <article key={r.uid} className="border-t border-border pt-3 space-y-2"><h4 className="text-rarity-2">{item.name}</h4><p className="text-sm">{r.reason}</p><p className="text-sm text-muted-foreground">A cambio: {r.tradeoff}</p><LockProgress item={item} g={g} /><div className="grid grid-cols-2 gap-2"><Button variant="outline" disabled={!inBag || !canUseWeapon(item,g.level)} onClick={() => equip(item)}>{inBag ? 'Equipar' : 'Equipada'}</Button><Button variant="outline" onClick={() => { const reference = item.base?.ranged ? g.ranged : g.melee; setSelected([reference.uid,item.uid].filter((id,i,ids) => ids.indexOf(id) === i)); setCompare(true); }}>Comparar</Button></div></article>; })}</div>}
    {compare && <div className="border-y border-border py-4 space-y-3"><div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"><h4 className="text-rarity-2">Comparación · hasta 3 armas</h4><Button variant="ghost" size="icon" aria-label="Limpiar comparación" onClick={() => setSelected([])}><X size={16} /></Button></div><div className="grid grid-cols-2 gap-2">{[g.melee,g.ranged].map(item => <label key={item.uid} className="flex min-w-0 items-center gap-2 text-sm"><Checkbox checked={selected.includes(item.uid)} onCheckedChange={() => toggle(item.uid)} aria-label={`Comparar ${item.name}`} /><span className="min-w-0 break-words">Equipada: {item.base?.type}</span></label>)}</div>
      {selectedItems.length === 0 && <p className="text-sm text-muted-foreground">Sin armas seleccionadas.</p>}
      <div className="grid gap-3 lg:grid-cols-3">{selectedItems.map(item => { const f = weaponFacts(item); if (!f) return null; const equipped = f.ranged ? g.ranged : g.melee; const delta = weaponDifference(item,equipped); const inBag = g.bag.some(it => it.uid === item.uid); return <article key={item.uid} className="border border-border bg-muted rounded p-3 min-w-0 space-y-3"><ItemDetails item={item} g={g} /><dl className="text-sm space-y-1">{[['Media dados ×mult.',f.damage,delta?.damage],['Alcance',f.range,delta?.range],['Intervalo (s)',f.interval,delta?.interval],['Break',f.break,delta?.break],['Crítico +%',f.crit,delta?.crit],['Precisión +',f.accuracy,delta?.accuracy]].map(([label,value,diff]) => <div key={String(label)} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><dt className="text-muted-foreground">{label}</dt><dd>{value}{inBag && typeof diff === 'number' && <span className="text-rarity-2"> ({diff > 0 ? '+' : ''}{diff})</span>}</dd></div>)}{f.ranged && <><div>Munición/disparo: {f.ammo}</div><div>Cargador: {f.magazine} · recarga: {f.reload}s</div></>}</dl><p className="text-xs text-muted-foreground">{f.behavior}</p>{inBag && <p className="text-xs text-muted-foreground">Diferencias frente a {equipped.base?.type} equipada.</p>}<Button className="w-full min-h-11" disabled={!inBag || !canUseWeapon(item,g.level)} onClick={() => equip(item)}>{inBag ? 'Equipar' : <><Check size={16} />Equipada</>}</Button></article>; })}</div><p className="text-xs text-muted-foreground">Media de dados del objeto, antes de atributos, críticos, efectos y defensa; no es daño final.</p></div>}
    <p className="text-xs text-muted-foreground">{shown.length} / {g.bag.length} objetos</p>
    {!g.bag.length && <p className="text-sm text-muted-foreground">Mochila vacía.</p>}{g.bag.length > 0 && !shown.length && <p className="text-sm text-muted-foreground">Sin objetos para estos filtros.</p>}
    {shown.map(item => <article key={item.uid} tabIndex={0} {...hoverProps(item)} className={`inventory-item border bg-card rounded p-3 space-y-3 ${hoverId === item.uid ? 'border-primary' : 'border-border'}`}><ItemDetails item={item} g={g} /><div className="grid grid-cols-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] gap-2 items-center">{item.kind === 'weapon' && <label className="col-span-2 sm:col-span-1 flex min-w-0 items-center gap-2 min-h-11 text-sm"><Checkbox checked={selected.includes(item.uid)} aria-label={`Comparar ${item.name}`} onCheckedChange={() => { toggle(item.uid); setCompare(true); }} />Comparar</label>}<Button variant="outline" className="min-h-11" disabled={!canUseWeapon(item,g.level)} onClick={() => equip(item)}>Equipar</Button><Button variant="ghost" className="min-h-11" onClick={() => { g.sell(item.uid); setSelected(ids => ids.filter(id => id !== item.uid)); rerender(); }}>Vender</Button></div></article>)}
  </section>;
}