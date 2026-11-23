import { createServer } from 'vite';
import { PerspectiveCamera, Scene } from 'three';

const vite = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
});
try {
  const load = (path) => vite.ssrLoadModule('/src/' + path);
  const [
    { RoomScene },
    { EventBus },
    { Rng },
    { GameLoop, SIM_DT },
    { tuning },
    { RunManager },
    { roomDefinitions },
    { freeModePosition },
    { CommandRegistry },
    { loadWaves },
    { default: waves },
  ] = await Promise.all(
    [
      'scenes/roomScene.ts',
      'core/events.ts',
      'core/rng.ts',
      'core/loop.ts',
      'core/tuning.ts',
      'world/run.ts',
      'world/rooms.ts',
      'world/modeSchema.ts',
      'ui/debugCommands.ts',
      'world/waves.ts',
      'data/waves/roomTest.json',
    ].map(load),
  );
  const room = roomDefinitions.get('arenaPowerPlant');
  const idle = {
    held: new Set(),
    pressed: new Set(),
    released: new Set(),
    lookDelta: { x: 0, y: 0 },
  };
  for (const count of [30, 60]) {
    const bus = new EventBus();
    const run = new RunManager(bus, {
      generateMap: () => ({ sectorId: 'unused', layers: [] }),
    });
    run.newRun('bench-ai', 'classic', { modeId: 'conquest', arenaId: room.id });
    run.selectNode('conquest');
    const scene = new RoomScene(
      room,
      run.state,
      loadWaves({ ...waves, spawnPoints: room.spawnPoints }),
      { loadModels: false },
    );
    const commands = new CommandRegistry();
    try {
      await scene.init(
        {
          bus,
          rng: new Rng('bench-ai'),
          loop: new GameLoop({ step() {}, render() {} }),
          tuning: structuredClone(tuning),
          debug: false,
          commands,
          camera: new PerspectiveCamera(),
        },
        new Scene(),
      );
      if (scene.navigation.nextBatch) {
        const { initEnemySim } = await load('world/enemyBatch.ts');
        if (!(await initEnemySim())) throw new Error('Benchmark wymaga działającego WASM');
      }
      commands.execute('god');
      let n = 0;
      for (let x = -105; x <= 105 && n < count; x += 7)
        for (let z = -45; z <= 45 && n < count; z += 7) {
          const p = { x, y: room.playerSpawn.y, z };
          if (freeModePosition(room, p, 1.5))
            scene.manager.spawn(n++ % 3 === 0 ? 'gunner' : 'assaulter', p);
        }
      if (n !== count) throw new Error('Za mało miejsc startowych');
      // Exclusive wall times, including JS/WASM crossings. Only wrap this scene's instances.
      const times = {};
      let active;
      function measure(object, method, label) {
        const original = object[method];
        object[method] = function (...args) {
          const parent = active;
          active = label;
          const start = performance.now();
          try {
            return original.apply(this, args);
          } finally {
            const ms = performance.now() - start;
            times[label] = (times[label] ?? 0) + ms;
            if (parent) times[parent] = (times[parent] ?? 0) - ms;
            active = parent;
          }
        };
      }
      measure(scene, 'step', 'scene');
      measure(
        scene.navigation,
        scene.navigation.nextBatch ? 'nextBatch' : 'next',
        'navigation',
      );
      measure(scene.manager, 'step', 'ai');
      measure(scene.world, 'step', 'physics');
      measure(scene.world, 'castRay', 'rays');
      scene.manager.forEach((e) =>
        measure(e.body.controller, 'computeColliderMovement', 'controller'),
      );
      for (let step = 0; step < 120; step++) scene.step(SIM_DT, idle);
      for (const key of Object.keys(times)) times[key] = 0;
      const steps = 600;
      for (let step = 0; step < steps; step++) scene.step(SIM_DT, idle);
      if (scene.query('enemies') !== count)
        throw new Error('Zmiana liczby wrogów');
      times.total = Object.values(times).reduce((sum, ms) => sum + ms, 0);
      console.log(
        count,
        'wrogów, ms/krok',
        Object.fromEntries(
          Object.entries(times).map(([key, ms]) => [
            key,
            +(ms / steps).toFixed(3),
          ]),
        ),
      );
    } finally {
      scene.dispose();
    }
  }
} finally {
  await vite.close();
}
