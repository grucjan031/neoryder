// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { loadSettings } from '../../src/core/save';
import { applyQuality, getQuality } from '../../src/render/quality';
import { SettingsScreen } from '../../src/ui/settingsScreen';
import text from '../../src/data/ui/settings.pl.json';

it('wybór jakości zapisuje profil i stosuje go bez przeładowania', () => {
  localStorage.clear();
  const settings = loadSettings(localStorage);
  const changed = vi.fn();
  const screen = new SettingsScreen(settings, changed);
  try {
    document.querySelector<HTMLButtonElement>('#settings-tab-video')!.click();
    const select = document.querySelector<HTMLSelectElement>('select')!;
    expect(select.value).toBe('medium');
    for (const [profile, outline] of [
      ['low', 0],
      ['high', 1],
    ] as const) {
      select.value = profile;
      select.dispatchEvent(new Event('change'));
      expect(loadSettings(localStorage).quality).toBe(profile);
      expect(getQuality().outline).toBe(outline);
    }
    expect(changed).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain(text.qualityHint);
  } finally {
    screen.dispose();
    localStorage.clear();
    applyQuality('high');
  }
});
