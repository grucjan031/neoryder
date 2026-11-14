import { tuning } from '../core/tuning';
import { themeSchema } from './themeSchema';
import type { Theme } from './themeSchema';

export function loadThemeDefinitions(
  data: readonly unknown[],
): Map<string, Theme> {
  const themes = new Map<string, Theme>();
  for (const raw of data) {
    const theme = themeSchema.parse(raw);
    if (themes.has(theme.id)) throw new Error(`Powtórzony motyw: ${theme.id}`);
    themes.set(theme.id, theme);
  }
  return themes;
}

export const themeDefinitions = loadThemeDefinitions(
  Object.values(
    import.meta.glob('../data/themes/*.json', {
      eager: true,
      import: 'default',
    }),
  ),
);
const warned = new Set<string>();
export function resolveTheme(
  id = 'white',
  search = typeof location === 'undefined' ? '' : location.search,
): Theme {
  const requested = new URLSearchParams(search).get('theme') || id;
  const theme = themeDefinitions.get(requested);
  if (theme) return theme;
  if (!warned.has(requested)) {
    warned.add(requested);
    console.warn(`Nieznany motyw "${requested}"; użyto white.`);
  }
  return themeDefinitions.get('white')!;
}

export function applyTheme(theme: Theme): () => void {
  const previous = { ...tuning.render };
  Object.assign(tuning.render, theme.render);
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    Object.assign(tuning.render, previous);
  };
}
