import { useEffect, useState } from 'react';
import { Moon, Rainbow, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

const KEY_THEME = 'ars_anima_theme', KEY_RGB = 'ars_anima_rgb';
function apply(theme: string, rgb: boolean) {
  const el = document.documentElement;
  el.classList.toggle('theme-light', theme === 'light');
  el.classList.toggle('rgb-mode', rgb);
}

/** Tema claro/oscuro y modo RGB, guardados en este navegador. */
export function DisplayToggles({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState('dark'), [rgb, setRgb] = useState(false);
  useEffect(() => { const t = localStorage.getItem(KEY_THEME) ?? 'dark', r = localStorage.getItem(KEY_RGB) === '1'; setTheme(t); setRgb(r); apply(t, r); }, []);
  const set = (t: string, r: boolean) => { setTheme(t); setRgb(r); localStorage.setItem(KEY_THEME, t); localStorage.setItem(KEY_RGB, r ? '1' : '0'); apply(t, r); };
  return <div className={`flex flex-wrap justify-center gap-2 ${className}`}>
    <Button variant="outline" className="font-pixel" aria-pressed={theme === 'light'} onClick={() => set(theme === 'light' ? 'dark' : 'light', rgb)}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}{theme === 'light' ? 'Tema oscuro' : 'Tema claro'}</Button>
    <Button variant="outline" className={`font-pixel ${rgb ? 'rgb-button-on' : ''}`} aria-pressed={rgb} onClick={() => set(theme, !rgb)}><Rainbow size={16} />RGB {rgb ? 'ON' : 'OFF'}</Button>
  </div>;
}

/** Reaplica el tema guardado al montar el juego. */
export function useStoredDisplay() {
  useEffect(() => { apply(localStorage.getItem(KEY_THEME) ?? 'dark', localStorage.getItem(KEY_RGB) === '1'); }, []);
}
