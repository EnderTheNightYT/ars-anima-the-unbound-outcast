// Empaqueta el servidor: los recursos gráficos/sonoros que importa el motor se sustituyen por cadenas vacías
// (el servidor no dibuja), manteniendo el Worker muy por debajo del límite del plan gratuito.
import { build } from "esbuild";
import path from "node:path";
const stubAssets = { name: "stub-assets", setup(b) {
  b.onResolve({ filter: /\.(png|jpe?g|webp|mp3|ogg|wav|svg)(\?.*)?$/ }, a => ({ path: a.path, namespace: "stub" }));
  b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export default ''", loader: "js" }));
} };
// El motor comparte i18n.ts con la interfaz (usa hooks de React); el servidor no dibuja, así que React se sustituye
// por un módulo mínimo. Así el despliegue desde GitHub sólo instala las dependencias de esta carpeta.
const stubReact = { name: "stub-react", setup(b) {
  b.onResolve({ filter: /^react(\/.*)?$/ }, a => ({ path: a.path, namespace: "stub-react" }));
  b.onLoad({ filter: /.*/, namespace: "stub-react" }, () => ({ loader: "js", contents:
    "export const useEffect=()=>{};export const useLayoutEffect=()=>{};export const useState=v=>[typeof v==='function'?v():v,()=>{}];export const useMemo=f=>f();export const useCallback=f=>f;export const useRef=v=>({current:v});export default {};" }));
} };
await build({
  entryPoints: ["src/worker.ts"], outfile: "build/worker.js", bundle: true, format: "esm", platform: "neutral", target: "es2022",
  minify: true, conditions: ["workerd", "worker", "browser"], mainFields: ["module", "main"], external: ["cloudflare:*", "node:*"],
  alias: { "@": path.resolve("../src") }, nodePaths: [path.resolve("node_modules")], plugins: [stubAssets, stubReact], logLevel: "warning",
});
console.log("build/worker.js listo");
