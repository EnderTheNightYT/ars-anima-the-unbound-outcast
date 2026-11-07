import { useEffect, useRef, type ReactNode } from "react";
import { useLang } from "./i18n";
import EN_UI from "./i18n-en.json";
import { translateText } from "./auto-translate";

/**
 * Traduce al inglés el texto visible de su contenido (mochila, wiki, mercader, menús)
 * cuando el idioma es "en"; vuelve al español original al cambiar de nuevo.
 */
export function AutoTranslate({ children }: { children: ReactNode }) {
  const { lang } = useLang();
  const ref = useRef<HTMLDivElement>(null);
  const originalsRef = useRef(new WeakMap<Text, string>());
  const attributesRef = useRef(new WeakMap<Element, Map<string,string>>());
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const originals = originalsRef.current;
    const dict = EN_UI as Record<string, string>;
    const apply = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const tn = node as Text;
        const cur = tn.data;
        const known = originals.get(tn);
        // React pudo reescribir el texto: el nuevo valor es el nuevo original.
        const base = known !== undefined && translateText(known, dict) === cur ? known : cur;
        if (lang === "en") {
          const out = translateText(base, dict);
          originals.set(tn, base);
          if (out !== cur) tn.data = out;
        } else if (known !== undefined && cur !== known && translateText(known, dict) === cur) {
          tn.data = known;
        }
        return;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.tagName === "SCRIPT" || el.tagName === "STYLE" || el.isContentEditable || el.tagName === "TEXTAREA") return;
        if (el.closest('[translate="no"]')) return;
        let attrs=attributesRef.current.get(el); if(!attrs){attrs=new Map();attributesRef.current.set(el,attrs);}
        for(const key of ['title','aria-label','placeholder','alt']){const cur=el.getAttribute(key);if(cur===null)continue;const known=attrs.get(key);const base=known!==undefined&&translateText(known,dict)===cur?known:cur;attrs.set(key,base);const out=lang==='en'?translateText(base,dict):base;if(out!==cur)el.setAttribute(key,out);}
        node.childNodes.forEach(apply);
      }
    };
    apply(root);
    if (lang !== "en") return;
    const mo = new MutationObserver((muts) => {
      mo.disconnect();
      for (const m of muts) {
        if (m.type === "characterData") apply(m.target);
        else if (m.type === "attributes") apply(m.target);
        else m.addedNodes.forEach(apply);
      }
      mo.observe(root, { subtree: true, childList: true, characterData: true, attributes:true, attributeFilter:['title','aria-label','placeholder','alt'] });
    });
    mo.observe(root, { subtree: true, childList: true, characterData: true, attributes:true, attributeFilter:['title','aria-label','placeholder','alt'] });
    return () => mo.disconnect();
  }, [lang]);
  return <div ref={ref} style={{ display: "contents" }}>{children}</div>;
}
