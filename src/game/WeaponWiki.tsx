import { ActiveSkillsWiki } from './ActiveSkillsWiki';
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AFFIXES, RARITY, WEAPONS, type AffixId } from "./data";
import { weaponGuide, enemyExamples, referenceDamage } from "./weapon-guide";
import { getLang } from './i18n';
import { uiText } from './locale-text';
import { COMBO_WINDOW } from "./melee-combo";
import { loadFinds } from "./cloud";
import { Comments } from "./WorldBoard";
import { WIKI, searchWiki, type WikiCat } from "./wiki-data";
import { weaponSheet, affixGuide } from "./weapon-wiki";
import { AffixCombosView, FloorCompare } from "./AffixCombosView";
import type { Item } from "./data";
import { weaponSources, ELITE_LOOT_MULT, MAX_DROP_CHANCE } from "./enemy-loot";
import { ENEMY_TYPES, VARIANT_LABEL_FALLBACK } from "./enemy-loot-labels";
import { variantsFor, forgeBase, combinationCount, ALL_SUFFIXES } from "./weapon-forge";

const CATS: [WikiCat | "hallazgos", string][] = [["armas", "ARMAS"], ["hallazgos", "ARMAS ENCONTRADAS"], ["objetos", "OBJETOS"], ["enemigos", "ENEMIGOS"], ["mundo", "MUNDO E INTERACCIÓN"], ["clases", "CLASES"], ["mecanicas", "MECÁNICAS Y COMBATE"], ["lore", "LORE"]];

export function WeaponWiki({ focus = "", focusKey = 0, owned = [], floor = 1, skillOpen, level = 1 }: { focus?: string; focusKey?: number; owned?: Item[]; floor?: number; skillOpen?: (id: string) => boolean; level?: number }) {
  const [cat, setCat] = useState<WikiCat | "hallazgos" | "combos" | "inscripciones" | "comparador" | "activas">("armas");
  const [comboWeapon, setComboWeapon] = useState("ESPADA");
  const openCombos = (t: string) => { setComboWeapon(t); setCat("inscripciones"); };
  const [open, setOpen] = useState("");
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [tier, setTier] = useState(-1);
  const [finds, setFinds] = useState<Awaited<ReturnType<typeof loadFinds>> | null>(null);
  useEffect(() => { if (cat === "hallazgos" && !finds) loadFinds().then(setFinds).catch(() => setFinds([])); }, [cat, finds]);
  const types = useMemo(() => cat === "hallazgos" || cat === "inscripciones" || cat === "comparador" ? (cat === "hallazgos" ? [...new Set((finds ?? []).map((f) => f.weapon_type))].sort() : []) : [...new Set(WIKI.filter((e) => e.cat === (cat === "combos" ? "armas" : cat)).map((e) => e.type))], [cat, finds]);
  useEffect(() => {
    if (focus === "skills") { setCat("activas"); return; }
    const hit = focus && WIKI.find((e) => e.id === focus);
    if (!hit) return;
    setCat(hit.cat); setQ(""); setType(""); setTier(-1); setOpen(hit.id);
    const t = window.setTimeout(() => document.getElementById(`wiki-${hit.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 60);
    return () => clearTimeout(t);
  }, [focus, focusKey]);
  const jump = (id: string) => { const hit = WIKI.find((e) => e.id === id); if (!hit) return; setCat(hit.cat); setQ(""); setType(""); setTier(-1); setOpen(id);
    window.setTimeout(() => document.getElementById(`wiki-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 60); };
  const special = cat === "inscripciones" || cat === "comparador" || cat === "activas";
  const entries = cat === "hallazgos" || special ? [] : searchWiki(WIKI, q, cat === "combos" ? "armas" : cat, type, tier);
  const t = q.trim().toLowerCase();
  const shownFinds = (finds ?? []).filter((f) => (!type || f.weapon_type === type) && (tier < 0 || f.rarity === tier)
    && (!t || [f.name, f.weapon_type, ...f.affixes, ...f.affixes.map((a) => AFFIXES[a as AffixId] ?? "")].some((x) => `${x} ${uiText(x)}`.toLowerCase().includes(t))));
  return (
    <div className="menu-panel w-full max-w-5xl mt-4 p-3 text-left">
      <div className="title-gothic text-lg text-primary">WIKI DE ARS ANIMA</div>
      <Button variant="ghost" className={`tab ${cat === "combos" ? "tab-active" : ""}`} onClick={() => { setCat("combos"); setType(""); setTier(-1); }}>ARMAS, COMBOS Y DAÑO</Button>
      <Button variant="ghost" className={`tab ${cat === "objetos" && type === "Inscripción" ? "tab-active" : ""}`} onClick={() => { setCat("objetos"); setQ(""); setTier(-1); setType("Inscripción"); }}>INSCRIPCIONES: QUÉ HACEN</Button>
      <Button variant="ghost" className={`tab ${cat === "inscripciones" ? "tab-active" : ""}`} onClick={() => setCat("inscripciones")}>INSCRIPCIONES: TODAS LAS COMBINACIONES</Button>
      <Button variant="ghost" className={`tab ${cat === "comparador" ? "tab-active" : ""}`} onClick={() => setCat("comparador")}>COMPARADOR DE ARMAS POR PISO</Button>
      <Button variant="ghost" className={`tab ${cat === "activas" ? "tab-active" : ""}`} onClick={() => setCat("activas")}>HABILIDADES ACTIVAS</Button>
      <div className="flex flex-wrap gap-1 mt-1">{CATS.map(([id, l]) => <Button key={id} variant="ghost" className={`tab ${cat === id ? "tab-active" : ""}`} onClick={() => { setCat(id); setType(""); setTier(-1); }}>{l}</Button>)}</div>
      <div className="flex flex-wrap gap-1 mt-2 items-center">
        <Input value={q} placeholder="Buscar por nombre, efecto, inscripción, daño, función…" onChange={(e) => setQ(e.target.value)} className="h-8 flex-1 min-w-56 text-xs" />
        <select aria-label="Tipo" className="h-8 rounded border border-border bg-background text-xs px-1" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Tipo: todos</option>{types.map((x) => <option key={x} value={x}>{x}</option>)}</select>
        {(cat === "hallazgos" || cat === "objetos") && <select aria-label="Tier" className="h-8 rounded border border-border bg-background text-xs px-1" value={tier} onChange={(e) => setTier(Number(e.target.value))}>
          <option value={-1}>Tier: todos</option>{RARITY.map((r, i) => <option key={r} value={i}>{r}</option>)}</select>}
      </div>
      <div className="grid gap-1 mt-2 max-h-[30rem] overflow-y-auto">
        {cat === "inscripciones" && <AffixCombosView weapon={comboWeapon} setWeapon={setComboWeapon} jump={jump} />}
        {cat === "comparador" && <FloorCompare owned={owned} current={floor} jump={jump} openCombos={openCombos} />}
        {cat === "activas" && <ActiveSkillsWiki isOpen={skillOpen} level={level} />}
        {!special && cat !== "hallazgos" && entries.map((e) => (
          <div key={e.id} id={`wiki-${e.id}`} className={`item-row text-xs flex-wrap ${open === e.id ? "wiki-focus" : ""}`}>
            <span className="flex-1"><b className="text-rarity-2">{e.name}</b> · {e.type}</span>{e.damage && <b>Daño {e.damage}</b>}
            {e.func && <span className="w-full">{e.func}</span>}
            {e.effects.length > 0 && <span className="w-full">{e.effects.join(" · ")}</span>}
            {e.detail.length > 0 && <span className="w-full text-muted-foreground">{e.detail.join(" · ")}</span>}
            {e.id.startsWith("affix:") && <span className="w-full">Armas compatibles (todas): {WIKI.filter((w) => w.cat === "armas").map((w) => <button key={w.id} type="button" className="wiki-link mr-2" onClick={() => jump(w.id)}>{w.name}</button>)}</span>}
            {e.id.startsWith("affix:") && <span className="w-full">Combinaciones con esta inscripción por arma: {WIKI.filter((w) => w.cat === "armas").map((w) => <button key={w.id} type="button" className="wiki-link mr-2" onClick={() => openCombos(w.name)}>{w.name}</button>)}</span>}
            {e.cat === "armas" && <span className="w-full"><button type="button" className="wiki-link mr-2" onClick={() => openCombos(e.name)}><b>Ver las 255 combinaciones de inscripciones con {e.name}</b></button></span>}
            {e.cat === "armas" && <span className="w-full">Inscripciones posibles: {(Object.keys(AFFIXES) as AffixId[]).map((a) => <button key={a} type="button" className="wiki-link mr-2" onClick={() => jump(`affix:${a}`)}>{a.replace("_", " ")}</button>)}</span>}
            {(cat === "combos" || cat === "armas") && <WeaponDamage type={e.name} open={open === e.id} jump={jump} />}
            <Comments target={`wiki:${e.id}`} />
          </div>))}
        {!special && cat !== "hallazgos" && entries.length === 0 && <p className="text-xs text-muted-foreground">Sin resultados.</p>}
        {cat === "hallazgos" && !finds && <p className="text-xs text-muted-foreground">Cargando…</p>}
        {cat === "hallazgos" && finds && shownFinds.length === 0 && <p className="text-xs text-muted-foreground">{finds.length ? "Sin resultados." : "Aún no se registraron armas. Las armas que encuentren los jugadores con sesión iniciada aparecen aquí."}</p>}
        {cat === "hallazgos" && shownFinds.map((f) => (
          <div key={f.name} className="item-row text-xs flex-wrap">
            <span className="flex-1"><b className="text-rarity-2">{f.name}</b> · {f.weapon_type} · {RARITY[f.rarity]}</span><b>Daño ×{Number(f.dmg_mult).toFixed(2)}</b>
            <span className="w-full">Crítico +{f.crit}% · Precisión +{f.acc}{f.affixes.length ? ` · ${f.affixes.map((a) => `${a}: ${AFFIXES[a as AffixId] ?? ""}`).join(" · ")}` : ""}</span>
            <span className="w-full text-muted-foreground">Encontrada {f.times_found} veces · primero por {f.first_finder || "Anónimo"} · mejores valores registrados</span>
            <Comments target={`find:${f.name}`} />
          </div>))}
      </div>
    </div>
  );
}

function WeaponDamage({ type, open = false, jump }: { type: string; open?: boolean; jump: (id: string) => void }) {
  const base = WEAPONS.find(w => w.type === type);
  if (!base) return null;
  const steps = weaponGuide(base);
  const fmt = (n: number) => Number(n.toFixed(2)).toLocaleString(getLang());
  const raw = referenceDamage(base);
  return <><p className="w-full">Daño base: {base.dice[0]}d{base.dice[1]} + 3 · {fmt(raw.min)}–{fmt(raw.max)} · Media {fmt(raw.average)}</p><WeaponSheetView base={base} open={open} jump={jump} /><details open={open} className="w-full border-t border-border pt-2 mt-1">
    <summary className="cursor-pointer text-primary">{base.ranged ? "Daño y ejemplos de disparo" : "Combo: golpes, daño y ejemplos"}</summary>
    <p className="mt-2 text-muted-foreground">{base.ranged ? "Sin combo melee; cada proyectil calcula su propio impacto." : `Clic principal normal · hasta ${COMBO_WINDOW} s entre golpes · remate automático, sin cargar.`}</p>
    <p className="mt-2">Referencia: ({base.dice[0]}d{base.dice[1]} + 3) × multiplicador del golpe. Atributo 0, arma ×1, sin crítico, bonos, escudo ni tambaleo. Todos los golpes acertados.</p>
    <div className="overflow-x-auto mt-2"><table className="w-full text-left text-xs"><thead><tr className="text-muted-foreground"><th className="p-1">Golpe</th><th className="p-1">×</th><th className="p-1">Daño mín.–máx.</th><th className="p-1">Media</th><th className="p-1">Break</th></tr></thead><tbody>{steps.map(s => <tr key={s.number} className="border-t border-border"><td className="p-1">{s.number}. {s.label}</td><td className="p-1">{s.multiplier}</td><td className="p-1 whitespace-nowrap">{fmt(s.min)}–{fmt(s.max)}</td><td className="p-1">{fmt(s.average)}</td><td className="p-1">{s.break}</td></tr>)}</tbody></table></div>
    {!base.ranged && <p className="mt-2">Media de cadena: {fmt(steps.reduce((n, s) => n + s.average, 0))}. Clic derecho cargado: ×2, independiente del combo.</p>}
    {base.pellets && <p className="mt-2">Daño por perdigón; {base.pellets} perdigones por disparo antes de distancia y dispersión.</p>}
    {enemyExamples(base).map(e => <p key={e.id} className="mt-2 text-muted-foreground"><Button variant="link" className="h-auto p-0 text-xs" onClick={() => jump(`enemy:${e.id}`)}>{e.name}</Button> · vida base {e.hp}, DEF {e.defense}: {base.ranged ? "un impacto" : "cadena completa"} de media {fmt(e.average)} → vida restante teórica {fmt(e.remaining)}.</p>)}
    <p className="mt-2 text-muted-foreground">DEF determina si aciertas; no se resta al daño. Críticos, Break, escudos, hambre, clase, nivel y evolución cambian estos ejemplos. No predicen una victoria.</p>
  </details></>;
}

function WeaponSheetView({ base, open, jump }: { base: NonNullable<ReturnType<typeof WEAPONS.find>>; open: boolean; jump: (id: string) => void }) {
  const s = weaponSheet(base);
  const hit = Math.max(1, Math.round(s.avgHit * 10) / 10), hits = s.ranged ? Math.max(1, base.pellets ?? 1) : Math.max(1, s.combo.length);
  return <details className="w-full border-t border-border pt-2 mt-1" open={open}>
    <summary className="cursor-pointer text-primary">Ficha completa: estadísticas, alteraciones aleatorias y efectos</summary>
    <div className="grid gap-1 mt-2 sm:grid-cols-2">
      <p>Dados {s.dice} · media por impacto {s.avgHit.toFixed(1)} · alcance {s.range} · cadencia {s.rate}s · Break {s.breakB} · nivel mínimo {s.minLevel}</p>
      {!s.ranged && <p>Remate del combo: {s.finisher}</p>}
      {s.modes.map((m) => <p key={m.label}><b className="text-rarity-2">{m.label}:</b> {m.text}</p>)}
    </div>
    <p className="mt-2 text-rarity-2">Golpes</p>
    <ul className="list-disc pl-4">{s.combo.map((c) => <li key={c.number}>{c.number}. {c.label} · ×{c.multiplier} · {c.min.toFixed(1)}–{c.max.toFixed(1)} (media {c.average.toFixed(1)}) · Break {c.break}</li>)}</ul>
    <p className="mt-2 text-rarity-2">Calidades (generadas al azar)</p>
    <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="text-muted-foreground"><th className="p-1">Tier</th><th className="p-1">Daño</th><th className="p-1">Crítico</th><th className="p-1">Precisión</th><th className="p-1">Inscripciones</th><th className="p-1">Nivel</th></tr></thead>
      <tbody>{s.tiers.map((t) => <tr key={t.name} className="border-t border-border"><td className="p-1">{t.name}</td><td className="p-1">{t.dmg}</td><td className="p-1">{t.crit}</td><td className="p-1">{t.acc}</td><td className="p-1">{t.affixes}</td><td className="p-1">{t.level}</td></tr>)}</tbody></table></div>
    <p className="mt-2 text-muted-foreground">Probabilidad de calidad al encontrarla:</p>
    {s.odds.map((o) => <p key={o.floor} className="text-muted-foreground">Piso {o.floor}: {o.text}</p>)}
    <p className="mt-2 text-rarity-2">Inscripciones posibles con esta arma</p>
    <p className="text-muted-foreground">Ejemplos calculados con un impacto medio de {hit} y {s.ranged ? `${hits} proyectil(es) por disparo` : `un combo de ${hits} golpes`} de esta arma.</p>
    <ul className="list-disc pl-4 grid gap-1">{s.affixes.map((a) => { const gd = affixGuide(a.id, hit, hits); return <li key={a.id}>
      <button type="button" className="wiki-link" onClick={() => jump(`affix:${a.id}`)}><b>{a.id.replace("_", " ")}</b></button> — {a.desc}. {a.note}
      <span className="block text-muted-foreground">{gd.rule}</span>
      {gd.ex.map((x) => <span key={x} className="block">▸ {x}</span>)}</li>; })}</ul>
    <p className="mt-2 text-rarity-2">Obtención: qué enemigos la sueltan</p>
    {(() => { const src = weaponSources(base.type); return src.length ? <>
      <ul className="list-disc pl-4">{src.map((x) => <li key={x.kind + (x.variant ?? "")}>
        <Button variant="link" className="h-auto p-0 text-xs" onClick={() => jump(`enemy:${x.kind}`)}>{(ENEMY_TYPES as Record<string, { name: string }>)[x.kind]?.name ?? x.kind}</Button>
        {" "}· {(x.chance * 100).toFixed(1)} % por baja (élite {(Math.min(MAX_DROP_CHANCE, x.chance * ELITE_LOOT_MULT) * 100).toFixed(1)} %)
        {x.variant ? ` · siempre ${VARIANT_LABEL_FALLBACK(x.variant)}` : ""}{x.affix ? ` · ${Math.round((x.affixChance ?? 0) * 100)} % con ${x.affix.replace("_", " ")}` : ""}</li>)}</ul>
      <p className="text-muted-foreground">Ningún enemigo la asegura. También puede salir en cofres, retos, mercaderes y minijefes con variante al azar.</p></>
      : <p className="text-muted-foreground">Ningún enemigo la suelta: sólo cofres, retos, mercaderes y minijefes.</p>; })()}
    <p className="mt-2 text-rarity-2">Variantes de forja (modifican la base al azar)</p>
    <ul className="list-disc pl-4">{variantsFor(base).map((v) => { const b = forgeBase(base, v.id); return <li key={v.id}><b>{v.label}</b> — {v.desc} → dados {b.dice[0]}d{b.dice[1]} · alcance {b.range} · cadencia {b.rate}s · Break {b.breakB}{b.magazine ? ` · cargador ${b.magazine}` : ""}{b.pellets ? ` · perdigones ${b.pellets}` : ""}</li>; })}</ul>
    <p className="text-muted-foreground">Nombre = tipo + variante (45%) + prefijo de calidad + uno de {ALL_SUFFIXES.length} epítetos; daño, crítico y precisión se tiran aparte. {combinationCount([base]).toLocaleString("es")} combinaciones de nombre, variante, calidad e inscripciones solo para {base.type} ({combinationCount(WEAPONS).toLocaleString("es")} entre todas las armas).</p>
    <p className="mt-2 text-rarity-2">Ejemplos de alteraciones</p>
    {s.examples.map((e) => <p key={e.name}><b>{e.name}</b> · {e.stats}</p>)}
    <p className="mt-2 text-rarity-2">Contra enemigos (arma común, sin críticos)</p>
    {s.enemies.map((e) => <p key={e.id}><Button variant="link" className="h-auto p-0 text-xs" onClick={() => jump(`enemy:${e.id}`)}>{e.name}</Button> · vida {e.hp} · DEF {e.def}: ~{e.hits} {s.ranged ? "disparos" : "golpes"} acertados</p>)}
    <p className="mt-2">♪ {s.rhythm}</p>
  </details>;
}
