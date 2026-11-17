import type { ACHIEVEMENT_ICONS } from '../progression/achievementsSchema';

export type AchievementIconKey = (typeof ACHIEVEMENT_ICONS)[number];

/**
 * Ikony naszywek: proste kontury w siatce 24×24, kolor z `currentColor` (CSS ustawia bursztyn,
 * ciepłą biel albo zieleń; bez cyanu, czerwieni i magenty, ADR 0006).
 */
const ICON_PATHS: Readonly<Record<AchievementIconKey, string>> = {
  spark:
    '<path d="M12 3l2.2 6.3L21 12l-6.8 2.7L12 21l-2.2-6.3L3 12l6.8-2.7z"/>',
  mirror:
    '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/><path d="M12 7v10"/>',
  execute: '<path d="M5 19 19 5"/><path d="M12 5h7v7"/><path d="M5 12v7h7"/>',
  chain:
    '<circle cx="7" cy="12" r="3"/><circle cx="17" cy="12" r="3"/><path d="M10 12h4"/>',
  rings:
    '<circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="10"/>',
  dash: '<path d="M4 7l6 5-6 5"/><path d="M12 7l6 5-6 5"/>',
  aegis:
    '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  blade: '<path d="M19 4 9 14"/><path d="M6 12l6 6"/><path d="M4 20l3-3"/>',
  wave: '<path d="M3 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0"/>',
  gun: '<path d="M3 10h13l3 2v3h-8l-1 4H7l1-4H3z"/>',
  crown: '<path d="M4 17 3 8l5 4 4-7 4 7 5-4-1 9z"/>',
  antenna:
    '<path d="M12 21V9"/><path d="M8 5a6 6 0 0 1 8 0"/><path d="M6 3a9 9 0 0 1 12 0"/><path d="M9 21h6"/>',
  letter: '<rect x="3" y="6" width="18" height="12"/><path d="M3 7l9 7 9-7"/>',
  foundry:
    '<path d="M4 19h16"/><path d="M6 19V9h12v10"/><path d="M9 9V5h6v4"/>',
  flag: '<path d="M6 21V4"/><path d="M6 5h12l-3 4 3 4H6"/>',
  triad:
    '<circle cx="6" cy="16" r="3"/><circle cx="18" cy="16" r="3"/><circle cx="12" cy="7" r="3"/>',
  trophy:
    '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M12 13v5"/><path d="M8 20h8"/><path d="M8 6H4v2a3 3 0 0 0 4 3"/><path d="M16 6h4v2a3 3 0 0 1-4 3"/>',
  repeat:
    '<path d="M4 12a8 8 0 0 1 14-5"/><path d="M18 3v4h-4"/><path d="M20 12a8 8 0 0 1-14 5"/><path d="M6 21v-4h4"/>',
  target:
    '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  alert:
    '<path d="M12 3 3 20h18z"/><path d="M12 10v5"/><path d="M12 17.5v.5"/>',
  chevrons: '<path d="M6 11l6-5 6 5"/><path d="M6 17l6-5 6 5"/>',
  cart: '<path d="M3 5h3l2 11h10l2-8H7"/><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/>',
  level: '<path d="M12 3v14"/><path d="M6 9l6-6 6 6"/><path d="M5 21h14"/>',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

export function hasAchievementIcon(key: string): key is AchievementIconKey {
  return Object.prototype.hasOwnProperty.call(ICON_PATHS, key);
}

export function achievementIconKeys(): string[] {
  return Object.keys(ICON_PATHS);
}

/** Kłódka przy odblokowaniach wymagających naszywki (warsztat). */
export function createLockIcon(): SVGSVGElement {
  const svg = createAchievementIcon('spark');
  svg.classList.replace('achv-icon', 'achv-lock');
  svg.innerHTML =
    '<rect x="5" y="11" width="14" height="10"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>';
  return svg;
}

/** Ikona jako element SVG (dekoracyjny: `aria-hidden`); nieznany klucz daje ikonę `spark`. */
export function createAchievementIcon(key: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('achv-icon');
  svg.innerHTML = hasAchievementIcon(key) ? ICON_PATHS[key] : ICON_PATHS.spark;
  return svg;
}
