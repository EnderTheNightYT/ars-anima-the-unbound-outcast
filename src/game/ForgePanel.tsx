import { useState } from 'react';
import { Hammer, Sparkles, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { AFFIXES, MATERIALS, type AffixId, type Item } from './data';
import { ensureWear, wearState, repairCost, repairGold, upgradeCost, upgradeGold, enchantCost, enchantGold, canUpgrade, canEnchant, enchantOptions, hasCost, WEAR, type Cost } from './weapon-wear';
import type { Game } from './engine';

const costText = (c: Cost) => Object.entries(c).map(([k, v]) => `${MATERIALS[k] ?? k} ×${v}`).join(' · ');

export function WearBar({ item }: { item: Item }) {
  if (item.kind !== 'weapon') return null;
  ensureWear(item);
  const s = wearState(item), pct = Math.round(((item.dur ?? 0) / (item.durMax ?? 1)) * 100);
  return <div className="mt-1 text-xs">
    <div className="flex justify-between gap-2"><span className={s === 'broken' ? 'text-destructive' : s === 'worn' ? 'text-rarity-4' : 'text-muted-foreground'}>{s === 'broken' ? 'ROTA · falla a menudo' : s === 'worn' ? 'Desgastada · puede fallar' : 'Durabilidad'}</span><span>{item.dur}/{item.durMax}{item.wlvl ? ` · +${item.wlvl}` : ''}</span></div>
    <div className="hud-bar mt-0.5"><div className={s === 'ok' ? 'bar-xp' : 'bar-hp'} style={{ width: `${pct}%` }} /></div>
  </div>;
}

function ForgeRow({ g, item, rerender }: { g: Game; item: Item; rerender: () => void }) {
  ensureWear(item);
  const merchant = g.shopStock.length > 0;
  const options = enchantOptions(item, Object.keys(AFFIXES) as AffixId[]);
  const [affix, setAffix] = useState<AffixId | ''>(options[0] ?? '');
  const actions = [
    { id: 'repair' as const, icon: <Wrench size={14} />, label: 'Reparar', cost: repairCost(item), gold: repairGold(item), ok: (item.dur ?? 0) < (item.durMax ?? 0) },
    { id: 'upgrade' as const, icon: <Hammer size={14} />, label: canUpgrade(item) ? `Subir a +${(item.wlvl ?? 0) + 1}` : `Nivel máx. +${WEAR.maxLevel}`, cost: upgradeCost(item), gold: upgradeGold(item), ok: canUpgrade(item) },
    { id: 'enchant' as const, icon: <Sparkles size={14} />, label: 'Añadir efecto', cost: enchantCost(item), gold: enchantGold(item), ok: canEnchant(item) && !!affix },
  ];
  const run = (id: 'repair' | 'upgrade' | 'enchant', pay: 'mats' | 'gold') => { g.smith(item.uid, id, pay, affix || undefined); setAffix(enchantOptions(item, Object.keys(AFFIXES) as AffixId[])[0] ?? ''); rerender(); };
  return <article className="item-row flex-col items-stretch">
    <div className="text-sm text-primary">{item.name}</div>
    <WearBar item={item} />
    {canEnchant(item) && options.length > 0 && <Select value={affix} onValueChange={v => setAffix(v as AffixId)}><SelectTrigger aria-label={`Efecto para ${item.name}`} className="bg-muted h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent>{options.map(a => <SelectItem key={a} value={a}>{a}: {AFFIXES[a]}</SelectItem>)}</SelectContent></Select>}
    <div className="grid gap-1 sm:grid-cols-3">{actions.map(a => <div key={a.id} className="space-y-1">
      <Button variant="outline" className="w-full h-auto min-h-9 whitespace-normal text-xs" disabled={!a.ok || !hasCost(g.mats, a.cost)} onClick={() => run(a.id, 'mats')}>{a.icon}{a.label}<span className="block text-[10px] text-muted-foreground">{a.ok ? costText(a.cost) : '—'}</span></Button>
      {merchant && <Button variant="ghost" className="w-full h-8 text-xs" disabled={!a.ok || g.gold < a.gold} onClick={() => run(a.id, 'gold')}>Mercader · {a.gold}✦</Button>}
    </div>)}</div>
  </article>;
}

/** Forja: reparar, mejorar o encantar armas con materiales (o con oro junto al mercader). */
export function ForgePanel({ g, rerender }: { g: Game; rerender: () => void }) {
  const weapons = [g.melee, g.ranged, ...g.bag].filter((it): it is Item => !!it && it.kind === 'weapon');
  return <section className="font-pixel space-y-2">
    <h4 className="text-rarity-2">Forja · reparar, mejorar y añadir efectos</h4>
    <p className="text-[11px] text-muted-foreground">Las armas se gastan con cada golpe o disparo. Desgastadas pierden daño y pueden fallar; rotas fallan a menudo. {g.shopStock.length ? 'El mercader también lo hace por fichas.' : 'Junto al mercader puedes pagar con fichas.'}</p>
    <div className="grid gap-2 lg:grid-cols-2">{weapons.map(w => <ForgeRow key={w.uid} g={g} item={w} rerender={rerender} />)}</div>
  </section>;
}
