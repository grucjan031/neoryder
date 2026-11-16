import { PerspectiveCamera, Scene as ThreeScene, WebGLRenderer } from 'three';
import StatsPanel from 'stats.js';
import { EventBus } from './core/events';
import { Rng } from './core/rng';
import { GameLoop } from './core/loop';
import { FeelSystem } from './core/feel';
import { Input } from './core/input';
import { tuning, createTuningGui } from './core/tuning';
import type { GameContext } from './core/context';
import { scenes } from './scenes';
import { defaultCommands as commands } from './ui/debugCommands';
import { createDebugConsole } from './ui/debugConsole';
import { createSceneMenu } from './ui/sceneMenu';
import { MainMenu } from './ui/mainMenu';
import { PauseMenu } from './ui/pauseMenu';
import { SettingsScreen } from './ui/settingsScreen';
import type { RunState } from './core/runTypes';
import { AudioSystem } from './audio/audioSystem';
import { loadSfx } from './audio/sfxSchema';
import sfxData from './data/audio/sfx.json';
import { loadSettings } from './core/save';
import { createRenderPipeline } from './render/outline';
import { applyQuality } from './render/quality';
import {
  LITE_MAX_STEPS_PER_FRAME,
  LITE_PIXEL_RATIO,
  configureFx,
  getLiteFx,
  preserveLiteFx,
} from './render/fxMode';
import { FrameProfiler, setFrameProfiler } from './render/frameProfiler';
import { showBootSplash } from './ui/bootSplash';
import type { BootSplash } from './ui/bootSplash';
import './ui/styles.css';
import './ui/pointerLockHint.css';

let bootSplash: BootSplash | undefined;

async function main(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) throw new Error('Brak elementu aplikacji.');
  const params = new URLSearchParams(location.search);
  configureFx(params);
  const requested = params.get('scene');
  bootSplash = showBootSplash(params, requested);
  const debug = import.meta.env.DEV || params.get('debug') === '1';
  if (requested === null) {
    if (debug && params.get('scenes') === '1') {
      const sceneParams = new URLSearchParams(params);
      sceneParams.delete('scenes');
      createSceneMenu(app, Object.keys(scenes), sceneParams);
      bootSplash.dismiss();
    } else {
      const menu = new MainMenu({ root: app, params, debug });
      const dispose = (): void => menu.dispose();
      window.addEventListener('pagehide', dispose, { once: true });
      import.meta.hot?.dispose(dispose);
      await menu.ready;
      bootSplash.dismiss();
    }
    return;
  }
  const sceneId = requested;
  const factory = Object.hasOwn(scenes, sceneId) ? scenes[sceneId] : undefined;
  if (!factory) {
    const message = document.createElement('p');
    message.className = 'scene-error';
    message.textContent = `Nieznana scena: ${sceneId}. Dostępne sceny: ${Object.keys(scenes).join(', ')}.`;
    app.append(message);
    bootSplash.dismiss();
    return;
  }
  const seed =
    params.get('seed') ??
    Array.from(crypto.getRandomValues(new Uint32Array(4)), (value) =>
      value.toString(16),
    ).join('-');
  const renderer = new WebGLRenderer({ antialias: !getLiteFx() });
  renderer.setPixelRatio(
    getLiteFx() ? LITE_PIXEL_RATIO : window.devicePixelRatio,
  );
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', 'Scena NEORYDER');
  app.append(renderer.domElement);
  const pipeline = createRenderPipeline(renderer);
  const profiler = debug ? new FrameProfiler(renderer) : undefined;
  setFrameProfiler(profiler);
  const updateQuality = (): void =>
    applyQuality(loadSettings().quality, {
      renderer,
      pipeline,
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    });
  updateQuality();
  const three = new ThreeScene();
  const camera = new PerspectiveCamera(tuning.camera.fov, 1, 0.1, 220);
  camera.position.set(8, 6, 10);
  camera.lookAt(0, 2, 0);
  const scene = factory();
  const settings = loadSettings();
  tuning.camera.fov = settings.fov;
  const input = new Input(renderer.domElement, () => settings.bindings);
  const bus = new EventBus();
  pipeline.bindEvents(bus);
  const stats = debug ? new StatsPanel() : undefined;
  const loop = new GameLoop(
    {
      step: (dt) => {
        profiler?.begin('step');
        try {
          scene.step(dt, input.snapshot());
        } finally {
          profiler?.end();
        }
      },
      render: (alpha, frameDt) => {
        stats?.begin();
        if (camera.fov !== tuning.camera.fov) {
          camera.fov = tuning.camera.fov;
          camera.updateProjectionMatrix();
        }
        feel.update(frameDt);
        profiler?.begin('sceneRender');
        try {
          scene.render(alpha, frameDt);
        } finally {
          profiler?.end();
        }
        profiler?.begin('pipeline');
        try {
          pipeline.render(three, camera, frameDt);
        } finally {
          profiler?.end();
          profiler?.endFrame(three, frameDt);
        }
        stats?.end();
      },
    },
    getLiteFx() ? { maxStepsPerFrame: LITE_MAX_STEPS_PER_FRAME } : {},
  );
  // Dźwięk przed sceną: musi usłyszeć entity_spawned gracza z init() sceny.
  const audio = new AudioSystem(bus, loadSfx(sfxData), {
    createContext: () =>
      typeof AudioContext === 'undefined' ? null : new AudioContext(),
    tuning,
    masterVolume: () => settings.masterVolume,
    sfxVolume: () => settings.sfxVolume,
    listener: () => ({ position: camera.position, yaw: camera.rotation.y }),
  });
  audio.attachUnlock(window);
  const ctx: GameContext = {
    // Wywoływane w geście użytkownika (np. „Jeszcze raz”): zdejmuje pauzę i przechwytuje mysz.
    resume: () => resume(),
    bus,
    audio,
    rng: new Rng(seed),
    loop,
    tuning,
    debug,
    camera,
    commands,
  };
  await scene.init(ctx, three);
  const resize = (): void => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    pipeline.setSize(window.innerWidth, window.innerHeight);
  };
  resize();
  window.addEventListener('resize', resize);
  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = debug
    ? `NEORYDER / ${scene.id} · kliknij scenę, aby przechwycić mysz · \` konsola`
    : `NEORYDER / ${scene.id} · kliknij scenę, aby przechwycić mysz`;
  app.append(hint);
  const ownsInterface = (): boolean =>
    document.querySelector(
      '.run-screen:not([hidden]), .hub-screen:not([hidden]), .build-select:not([hidden]), .hud__death:not([hidden])',
    ) !== null;
  const canReturnToHub = (): boolean =>
    scene.id === 'run' &&
    (scene.query?.('runState') as RunState | undefined)?.loadoutId === 'custom';
  const settingsScreen = new SettingsScreen(
    settings,
    () => {
      input.clear();
      updateQuality();
      tuning.camera.fov = settings.fov;
      audio.updateVolume();
      if (!settings.flashes) {
        pipeline.fxState.damage = 0;
        document
          .querySelectorAll<HTMLElement>('.hud__damage')
          .forEach((node) => {
            node.hidden = true;
          });
      }
    },
    () => pauseMenu.show(canReturnToHub()),
  );
  const pauseMenu = new PauseMenu({
    resume: () => resume(),
    settings: () => {
      pauseMenu.hide();
      settingsScreen.show();
    },
    hub: () => {
      const query = new URLSearchParams({ scene: 'hub' });
      if (params.get('debug') === '1') query.set('debug', '1');
      preserveLiteFx(params, query);
      location.assign(`/?${query}`);
    },
    menu: () => location.assign('/'),
  });
  const pause = (): void => {
    loop.paused = true;
    input.clear();
    if (ownsInterface() || settingsScreen.visible || pauseMenu.visible) return;
    pauseMenu.show(canReturnToHub());
    if (input.pointerLocked) document.exitPointerLock();
  };
  const focusOff = input.onFocusLost(pause);
  const pauseKey = (event: KeyboardEvent): void => {
    if (
      event.code !== 'Escape' ||
      event.repeat ||
      settingsScreen.visible ||
      pauseMenu.visible ||
      ownsInterface()
    )
      return;
    if (document.querySelector('.debug-console:not([hidden])')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    pause();
  };
  window.addEventListener('keydown', pauseKey, true);
  const resume = (): void => {
    pauseMenu.hide();
    loop.paused = false;
    input.requestPointerLock();
    hint.textContent = debug
      ? `NEORYDER / ${scene.id} · \` konsola`
      : `NEORYDER / ${scene.id}`;
  };
  renderer.domElement.addEventListener('click', resume);
  const feel = new FeelSystem(bus, loop, tuning);
  ctx.feel = feel;
  const gui = debug ? createTuningGui() : undefined;
  if (stats) document.body.append(stats.dom);
  const builtinOff = [
    commands.register('help', 'help', () => commands.help()),
    commands.register('seed', 'seed', () => seed),
    commands.register('reset', 'reset', () => {
      scene.reset?.();
      return 'Scena zresetowana.';
    }),
    commands.register(
      'fx',
      'fx <damage|focus|off> — impuls kompozycji',
      (args) => {
        const mode = args[0];
        if (mode === 'damage') pipeline.fxState.hit(1);
        else if (mode === 'focus') pipeline.fxState.focusActive = true;
        else if (mode === 'off') pipeline.fxState.reset();
        else return 'Użycie: fx <damage|focus|off>';
        return `fx: ${mode}`;
      },
    ),
    ...(['timescale', 'hitstop'] as const).map((name) =>
      commands.register(
        name,
        name === 'timescale' ? 'timescale <n>' : 'hitstop <ms>',
        (args) => {
          const value = Number(args[0]);
          if (args.length !== 1 || !Number.isFinite(value) || value < 0)
            return 'Podaj skończoną liczbę nieujemną.';
          if (name === 'timescale') {
            feel.baseTimeScale = value;
            return `Skala czasu: ${value}`;
          }
          bus.emit('hitstop', { ms: value });
          return `Hitstop: ${value} ms`;
        },
      ),
    ),
  ];
  const command = (line: string): string => commands.execute(line);
  if (profiler) {
    builtinOff.push(
      commands.register(
        'profile',
        'profile <on|off> — profiler klatki',
        (args) => {
          if (args.length !== 1 || (args[0] !== 'on' && args[0] !== 'off'))
            return 'Użycie: profile <on|off>';
          profiler.setEnabled(args[0] === 'on');
          return `Profiler: ${args[0]}`;
        },
      ),
    );
  }
  const disposeConsole = debug ? createDebugConsole(command) : undefined;
  if (debug) {
    window.__neoryder = Object.freeze({
      tick: () => loop.tick,
      sceneId: () => scene.id,
      query: (name: string) =>
        name === 'frameProfile'
          ? profiler?.averages
          : name === 'audioState'
            ? audio.state
            : name === 'lastSound'
              ? audio.lastSound
              : name === 'recentSounds'
                ? [...audio.recentSounds]
                : scene.query?.(name),
      command,
    });
  }
  if (scene.id !== 'run') bus.emit('run_started', { seed });
  bus.once('scene_loaded', () => bootSplash?.dismiss());
  bus.emit('scene_loaded', { sceneId: scene.id });
  loop.start();
  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    loop.stop();
    profiler?.dispose();
    focusOff();
    window.removeEventListener('keydown', pauseKey, true);
    settingsScreen.dispose();
    pauseMenu.dispose();
    feel.dispose();
    audio.dispose();
    input.dispose();
    disposeConsole?.();
    gui?.destroy();
    stats?.dom.remove();
    renderer.domElement.removeEventListener('click', resume);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pagehide', dispose);
    scene.dispose();
    for (const off of builtinOff) off();
    bus.clear();
    pipeline.dispose();
    renderer.dispose();
    app.replaceChildren();
    delete window.__neoryder;
  };
  import.meta.hot?.dispose(dispose);
  window.addEventListener('pagehide', dispose, { once: true });
}

void main().catch((error: unknown) => {
  console.error(error);
  bootSplash?.dismiss();
  const message = document.createElement('p');
  message.className = 'scene-error';
  message.textContent =
    'Nie udało się uruchomić gry. Sprawdź obsługę WebGL2 i konsolę przeglądarki.';
  document.body.append(message);
});
