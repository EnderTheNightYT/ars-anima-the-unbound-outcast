# net
- Multiplayer-only visuals (dust from interpolated motion, damage numbers from enemy hp drops) live in `net/client-fx.ts`; `dmgNums` is client-kept. Why: the server never sends particles or floating text.
- Player glow colours come from `net/glow.ts` (class hue + subclass/role/name shifts + small per-player salt, separated from other players). Why: readable, role-tinted and still distinct.
