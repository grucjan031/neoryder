import { PerspectiveCamera, Scene as ThreeScene, WebGLRenderer } from 'three';
import StatsPanel from 'stats.js';
import { EventBus } from './core/events';
import { Rng } from './core/rng';
import { GameLoop } from './core/loop';
import { Input } from './core/input';
import { tuning, createTuningGui } from './core/tuning';
import type { GameContext } from './core/context';
import { scenes } from './scenes';
import { Sandbox } from './scenes/sandbox';
import { PlayerTest } from './scenes/playerTest';
import { createCommandExecutor } from './ui/debugCommands';
import { createDebugConsole } from './ui/debugConsole';
import './ui/styles.css';

async function main(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) throw new Error('Brak elementu aplikacji.');
  const params = new URLSearchParams(location.search);
  const sceneId = params.get('scene') ?? 'sandbox';
  const factory = Object.hasOwn(scenes, sceneId) ? scenes[sceneId] : undefined;
  if (!factory) {
    const message = document.createElement('p');
    message.className = 'scene-error';
    message.textContent = `Nieznana scena: ${sceneId}. Dostępne sceny: ${Object.keys(scenes).join(', ')}.`;
    app.append(message);
    return;
  }
  const debug = import.meta.env.DEV || params.get('debug') === '1';
  const seed =
    params.get('seed') ??
    Array.from(crypto.getRandomValues(new Uint32Array(4)), (value) =>
      value.toString(16),
    ).join('-');
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', 'Scena NEORYDER');
  app.append(renderer.domElement);
  const three = new ThreeScene();
  const camera = new PerspectiveCamera(tuning.camera.fov, 1, 0.1, 100);
  camera.position.set(8, 6, 10);
  camera.lookAt(0, 2, 0);
  const scene = factory();
  const input = new Input(renderer.domElement);
  const bus = new EventBus();
  const stats = debug ? new StatsPanel() : undefined;
  const loop = new GameLoop({
    step: (dt) => scene.step(dt, input.snapshot()),
    render: (alpha) => {
      stats?.begin();
      if (camera.fov !== tuning.camera.fov) {
        camera.fov = tuning.camera.fov;
        camera.updateProjectionMatrix();
      }
      scene.render(alpha);
      renderer.render(three, camera);
      stats?.end();
    },
  });
  const ctx: GameContext = {
    bus,
    rng: new Rng(seed),
    loop,
    tuning,
    debug,
    camera,
  };
  await scene.init(ctx, three);
  const resize = (): void => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  resize();
  window.addEventListener('resize', resize);
  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = debug
    ? `NEORYDER / ${scene.id} · kliknij scenę, aby przechwycić mysz · \` konsola`
    : `NEORYDER / ${scene.id} · kliknij scenę, aby przechwycić mysz`;
  app.append(hint);
  const focusOff = input.onFocusLost(() => {
    loop.paused = true;
    hint.textContent = 'Pauza · kliknij scenę, aby wznowić';
  });
  const resume = (): void => {
    loop.paused = false;
    input.requestPointerLock();
    hint.textContent = debug
      ? `NEORYDER / ${scene.id} · \` konsola`
      : `NEORYDER / ${scene.id}`;
  };
  renderer.domElement.addEventListener('click', resume);
  const hitstopOff = bus.on('hitstop', ({ ms }) => loop.hitstop(ms));
  const gui = debug ? createTuningGui() : undefined;
  if (stats) document.body.append(stats.dom);
  const command = createCommandExecutor({
    reset: () => {
      if (scene instanceof Sandbox || scene instanceof PlayerTest)
        scene.reset();
    },
    spawnCube: () => scene instanceof Sandbox && scene.spawnCube(),
    seed,
    timescale: (value) => {
      loop.timeScale = value;
    },
    hitstop: (ms) => bus.emit('hitstop', { ms }),
    ...(scene instanceof PlayerTest
      ? {
          teleport: (position: { x: number; y: number; z: number }) =>
            scene.teleport(position),
        }
      : {}),
  });
  const disposeConsole = debug ? createDebugConsole(command) : undefined;
  if (debug) {
    window.__neoryder = Object.freeze({
      tick: () => loop.tick,
      sceneId: () => scene.id,
      query: (name: string) =>
        scene instanceof Sandbox || scene instanceof PlayerTest
          ? scene.query(name)
          : undefined,
      command,
    });
  }
  bus.emit('run_started', { seed });
  bus.emit('scene_loaded', { sceneId: scene.id });
  loop.start();
  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    loop.stop();
    focusOff();
    hitstopOff();
    input.dispose();
    disposeConsole?.();
    gui?.destroy();
    stats?.dom.remove();
    renderer.domElement.removeEventListener('click', resume);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pagehide', dispose);
    scene.dispose();
    bus.clear();
    renderer.dispose();
    app.replaceChildren();
    delete window.__neoryder;
  };
  import.meta.hot?.dispose(dispose);
  window.addEventListener('pagehide', dispose, { once: true });
}

void main().catch((error: unknown) => {
  console.error(error);
  const message = document.createElement('p');
  message.className = 'scene-error';
  message.textContent =
    'Nie udało się uruchomić gry. Sprawdź obsługę WebGL2 i konsolę przeglądarki.';
  document.body.append(message);
});
