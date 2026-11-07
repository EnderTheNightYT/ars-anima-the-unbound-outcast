import EN from './i18n-en.json';
import { getLang, type Lang } from './i18n';
import { translateText } from './auto-translate';
/** Resolve presentation only; IDs, saved equipment and player names stay unchanged. */
export function uiText(text: string, lang: Lang = getLang()) { return lang === 'en' ? translateText(text, EN) : text; }