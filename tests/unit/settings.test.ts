// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSettings, saveSettings } from '../../src/core/save';
import {
  assignBinding,
  defaultGamepadSettings,
  Input,
  resolveBindings,
} from '../../src/core/input';
import { EventBus } from '../../src/core/events';
import { tuning } from '../../src/core/tuning';
import { FpsCamera } from '../../src/player/fpsCamera';
import type { PlayerState } from '../../src/player/playerController';
import { AudioSystem } from '../../src/audio/audioSystem';
import type { AudioBackend } from '../../src/audio/synth';
import { loadSfx } from '../../src/audio/sfxSchema';
import sfxData from '../../src/data/audio/sfx.json';
import { PostFxState } from '../../src/render/postFx';
import { SettingsScreen } from '../../src/ui/settingsScreen';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('Settings Z6', () => {
  it('przypisuje osobny klawisz chłodzenia w istniejącym profilu', () => {
    const settings = loadSettings(localStorage);
    expect(resolveBindings(settings.bindings)).toMatchObject({
      KeyG: 'coolWeapon',
      KeyR: 'swap',
    });
    settings.bindings = assignBinding(settings.bindings, 'coolWeapon', 'KeyV');
    saveSettings(settings, localStorage);
    const bindings = resolveBindings(loadSettings(localStorage).bindings);
    expect(bindings.KeyV).toBe('coolWeapon');
    expect(bindings.KeyG).toBeUndefined();
    expect(bindings.KeyR).toBe('swap');
  });

  it.each([
    [0.05, 120, 0.1, 110],
    [0.1, 60, 0.1, 60],
    [5, 110, 5, 110],
    [100, 1, 5, 60],
    [-1, -1, 0.1, 60],
    [1.25, 95.5, 1.25, 95.5],
    [Number.MIN_VALUE, 179, 0.1, 110],
    [Number.MAX_VALUE, Number.MAX_VALUE, 5, 110],
  ])(
    'migruje stare wartości czułości %s i FOV %s przez obcięcie do zakresu suwaków',
    (mouseSensitivity, fov, expectedSensitivity, expectedFov) => {
      localStorage.setItem(
        'neoryder.settings',
        JSON.stringify({ mouseSensitivity, fov, masterVolume: 0.4 }),
      );
      expect(loadSettings(localStorage)).toEqual({
        mouseSensitivity: expectedSensitivity,
        fov: expectedFov,
        masterVolume: 0.4,
        sfxVolume: 1,
        musicVolume: 0.7,
        uiVolume: 0.7,
        uiScale: 1,
        reduceMotion: false,
        invertY: false,
        screenShake: 1,
        flashes: true,
        cameraTilt: true,
        quality: 'high',
        bindings: {},
        gamepad: defaultGamepadSettings(),
      });
    },
  );

  it.each(['"abc"', '"120"', 'null', 'true', '1e999', '-1e999'])(
    'zastępuje nieprawidłową wartość JSON %s tylko w uszkodzonym polu',
    (rawValue) => {
      for (const [key, fallback] of [
        ['mouseSensitivity', 1],
        ['fov', 90],
      ] as const) {
        localStorage.setItem(
          'neoryder.settings',
          `{"mouseSensitivity":2,"fov":80,"masterVolume":0.4,"${key}":${rawValue}}`,
        );
        expect(loadSettings(localStorage)).toMatchObject({
          mouseSensitivity: 2,
          fov: 80,
          masterVolume: 0.4,
          [key]: fallback,
        });
      }
    },
  );

  it.each(['mouseSensitivity', 'fov'] as const)(
    'uzupełnia brakujące pole %s bez resetowania pozostałych ustawień',
    (key) => {
      const saved: Record<string, number> = {
        mouseSensitivity: 2,
        fov: 80,
        masterVolume: 0.4,
      };
      delete saved[key];
      localStorage.setItem('neoryder.settings', JSON.stringify(saved));
      expect(loadSettings(localStorage)).toMatchObject({
        mouseSensitivity: 2,
        fov: 80,
        masterVolume: 0.4,
        [key]: key === 'fov' ? 90 : 1,
      });
    },
  );

  it.each([NaN, Infinity, -Infinity])(
    'zapisuje domyślne zamiast nieskończonej lub nieliczbowej wartości %s',
    (value) => {
      for (const [key, fallback] of [
        ['mouseSensitivity', 1],
        ['fov', 90],
      ] as const) {
        const settings = {
          ...loadSettings(localStorage),
          mouseSensitivity: 2,
          fov: 80,
          masterVolume: 0.4,
          [key]: value,
        };
        saveSettings(settings, localStorage);
        expect(JSON.parse(localStorage.getItem('neoryder.settings')!)).toEqual({
          ...settings,
          [key]: fallback,
        });
      }
    },
  );

  it('migruje trzy stare pola i zachowuje je bez resetowania', () => {
    localStorage.setItem(
      'neoryder.settings',
      JSON.stringify({ mouseSensitivity: 2, fov: 80, masterVolume: 0.4 }),
    );
    expect(loadSettings(localStorage)).toEqual({
      mouseSensitivity: 2,
      fov: 80,
      masterVolume: 0.4,
      sfxVolume: 1,
      musicVolume: 0.7,
      uiVolume: 0.7,
      uiScale: 1,
      reduceMotion: false,
      invertY: false,
      screenShake: 1,
      flashes: true,
      cameraTilt: true,
      quality: 'high',
      bindings: {},
      gamepad: defaultGamepadSettings(),
    });
  });

  it('naprawia każde błędne pole niezależnie i odrzuca zarezerwowane przypisania', () => {
    localStorage.setItem(
      'neoryder.settings',
      JSON.stringify({
        mouseSensitivity: 3,
        fov: -1,
        masterVolume: 0.2,
        sfxVolume: 2,
        musicVolume: 'loud',
        invertY: 'yes',
        screenShake: -1,
        flashes: false,
        quality: 'ultra',
        bindings: {
          dash: 'Escape',
          jump: 'Backquote',
          swap: 'KeyV',
          unknown: 'KeyJ',
          power: 1,
        },
      }),
    );
    expect(loadSettings(localStorage)).toEqual({
      mouseSensitivity: 3,
      fov: 60,
      masterVolume: 0.2,
      sfxVolume: 1,
      musicVolume: 0.7,
      uiVolume: 0.7,
      uiScale: 1,
      reduceMotion: false,
      invertY: false,
      screenShake: 1,
      flashes: false,
      cameraTilt: true,
      quality: 'high',
      bindings: { swap: 'KeyV' },
      gamepad: defaultGamepadSettings(),
    });
  });

  it('wspólny obiekt strony aktualizuje wcześniejszych odbiorców, zapis Storage jest niezależny', () => {
    const first = loadSettings();
    const old = first.mouseSensitivity;
    try {
      first.mouseSensitivity = 4;
      expect(loadSettings()).toBe(first);
      expect(loadSettings().mouseSensitivity).toBe(4);
      saveSettings(first, localStorage);
      expect(loadSettings(localStorage).mouseSensitivity).toBe(4);
      expect(loadSettings(localStorage)).not.toBe(first);
    } finally {
      first.mouseSensitivity = old;
    }
  });

  it('scala mapę, nowe przypisanie wygrywa, poprzednie wraca do wolnego domyślnego', () => {
    expect(resolveBindings({ dash: 'KeyV' })).toMatchObject({
      KeyV: 'dash',
      Space: 'jump',
      KeyW: 'moveForward',
    });
    expect(resolveBindings({ dash: 'KeyV' }).KeyQ).toBeUndefined();
    const next = assignBinding({ jump: 'KeyV' }, 'dash', 'KeyV');
    expect(resolveBindings(next)).toMatchObject({
      KeyV: 'dash',
      Space: 'jump',
    });
    const blocked = assignBinding(
      { jump: 'KeyV', power: 'Space' },
      'dash',
      'KeyV',
    );
    expect(blocked.jump).toBe('');
    expect(Object.values(resolveBindings(blocked))).not.toContain('jump');
    const later = assignBinding(blocked, 'dash', 'KeyB');
    expect(Object.values(resolveBindings(later))).not.toContain('jump');
  });

  it.each(['Escape', 'Backquote', 'invalid'])(
    'odrzuca przypisanie %s także poza UI',
    (code) => {
      expect(assignBinding({ dash: 'KeyV' }, 'dash', code)).toEqual({
        dash: 'KeyV',
      });
      expect(resolveBindings({ dash: code })).toEqual(resolveBindings());
    },
  );

  it('Input odczytuje nowe przypisanie natychmiast, clear usuwa przytrzymane akcje', () => {
    const target = document.createElement('canvas');
    document.body.append(target);
    const settings = { bindings: { dash: 'KeyN' } };
    const input = new Input(target, () => settings.bindings);
    vi.spyOn(input, 'pointerLocked', 'get').mockReturnValue(true);
    try {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN' }));
      expect(input.snapshot().pressed.has('dash')).toBe(true);
      input.clear();
      expect(input.snapshot().held.size).toBe(0);
      settings.bindings = { dash: 'KeyB' };
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN' }));
      expect(input.snapshot().held.size).toBe(0);
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB' }));
      expect(input.snapshot().pressed.has('dash')).toBe(true);
    } finally {
      vi.spyOn(input, 'pointerLocked', 'get').mockReturnValue(false);
      input.dispose();
    }
  });

  it('screenShake=0 wyłącza wstrząs także podczas aktywnej traumy', () => {
    const settings = { screenShake: 1 };
    const bus = new EventBus();
    const camera = new FpsCamera(tuning, 1, bus, settings);
    const state: PlayerState = {
      position: { x: 0, y: 0.92, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      yaw: 0,
      pitch: 0,
      grounded: true,
      coyoteMs: 0,
      jumpBufferMs: 0,
      airJumpsUsed: 0,
      height: tuning.player.capsuleHeight,
      dashS: 0,
      dashCooldownS: 0,
      dashDir: { x: 0, y: 0, z: -1 },
      sliding: false,
      slideS: 0,
      crouched: false,
      sprinting: false,
    };
    try {
      bus.emit('camera_shake', { intensity: 1, durationS: 1, dir: null });
      expect(camera.update(1 / 60, state, state, 1).roll).not.toBe(0);
      settings.screenShake = 0;
      const pose = camera.update(1 / 60, state, state, 1);
      expect(pose.pitch).toBe(0);
      expect(pose.yaw).toBe(0);
      expect(Math.abs(pose.roll)).toBe(0);
      expect(pose.position.x).toBe(0);
      expect(pose.position.z).toBe(0);
    } finally {
      camera.dispose();
    }
  });

  it('głośność efektów mnoży master i zmienia już utworzony gain', () => {
    const gain = { setValueAtTime: vi.fn() };
    // Atrapa tylko portów potrzebnych do odblokowania i aktualizacji głównego gainu.
    const backend = {
      currentTime: 2,
      sampleRate: 8,
      destination: {},
      createGain: () => ({ gain, connect: vi.fn() }),
      createBuffer: (_channels: number, length: number) => ({
        getChannelData: () => new Float32Array(length),
      }),
      resume: async () => {},
      close: async () => {},
    } as unknown as AudioBackend;
    let sfx = 0.4;
    const audio = new AudioSystem(new EventBus(), loadSfx(sfxData), {
      createContext: () => backend,
      tuning,
      masterVolume: () => 0.5,
      sfxVolume: () => sfx,
    });
    try {
      audio.attachUnlock(window);
      window.dispatchEvent(new Event('pointerdown'));
      audio.updateVolume();
      expect(gain.setValueAtTime).toHaveBeenLastCalledWith(
        tuning.audio.masterGain * 0.5 * 0.4,
        2,
      );
      sfx = 0;
      audio.updateVolume();
      expect(gain.setValueAtTime).toHaveBeenLastCalledWith(0, 2);
    } finally {
      audio.dispose();
    }
  });

  it('flashes blokuje impuls obrażeń i usuwa trwający błysk', () => {
    const settings = loadSettings();
    const old = settings.flashes;
    const fx = new PostFxState();
    try {
      settings.flashes = true;
      fx.hit(1);
      expect(fx.damage).toBe(1);
      settings.flashes = false;
      fx.update(0);
      expect(fx.damage).toBe(0);
      fx.hit(1);
      expect(fx.damage).toBe(0);
    } finally {
      settings.flashes = old;
    }
  });

  it('UI zapisuje suwak i klawisz, pokazuje brak przypisania oraz anuluje przechwytywanie Esc', () => {
    const settings = loadSettings(localStorage);
    const screen = new SettingsScreen(settings);
    // jsdom nie implementuje natywnego dialogu; jego zachowanie w przeglądarce pokrywa E2E.
    const dialog =
      document.querySelector<HTMLDialogElement>('.settings-screen')!;
    dialog.showModal = () => {
      dialog.open = true;
    };
    dialog.close = () => {
      dialog.open = false;
    };
    try {
      screen.show();
      document
        .querySelector<HTMLButtonElement>('#settings-tab-keyboard')!
        .click();
      const slider = document.querySelector<HTMLInputElement>(
        'input[aria-label="Czułość myszy"]',
      )!;
      slider.value = '2.5';
      slider.dispatchEvent(new Event('input'));
      const dash = document.querySelector<HTMLButtonElement>(
        '[data-action="dash"]',
      )!;
      dash.click();
      window.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'KeyW', cancelable: true }),
      );
      expect(loadSettings(localStorage).mouseSensitivity).toBe(2.5);
      expect(loadSettings(localStorage).bindings.dash).toBe('KeyW');
      expect(
        document.querySelector('[data-action="moveForward"]')?.textContent,
      ).toBe('Brak klawisza');
      dash.click();
      window.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'Backquote', cancelable: true }),
      );
      expect(dash.textContent).toBe('Naciśnij klawisz…');
      window.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'Escape', cancelable: true }),
      );
      expect(dash.textContent).toBe('W');
      expect(screen.visible).toBe(true);
    } finally {
      screen.dispose();
    }
  });

  it('zakładka Dostępność ma przełącznik przechyłów kamery zapisujący cameraTilt', () => {
    const settings = loadSettings(localStorage);
    const before = settings.cameraTilt;
    const screen = new SettingsScreen(settings);
    const dialog =
      document.querySelector<HTMLDialogElement>('.settings-screen')!;
    dialog.showModal = () => {
      dialog.open = true;
    };
    dialog.close = () => {
      dialog.open = false;
    };
    try {
      screen.show();
      document
        .querySelector<HTMLButtonElement>('#settings-tab-access')!
        .click();
      const toggle = document.querySelector<HTMLButtonElement>(
        'button[role="switch"][aria-label="Przechyły i zoom kamery"]',
      )!;
      expect(toggle.getAttribute('aria-checked')).toBe(String(before));
      toggle.click();
      expect(toggle.getAttribute('aria-checked')).toBe(String(!before));
      expect(loadSettings(localStorage).cameraTilt).toBe(!before);
      toggle.click();
      expect(loadSettings(localStorage).cameraTilt).toBe(before);
    } finally {
      screen.dispose();
    }
  });
});
