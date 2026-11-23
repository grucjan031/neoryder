// Uruchom przy npm run dev: node tools/screens/moduleVisuals.mjs [URL] [katalog]
// 84 pary model/kształt × biodro/ADS/podgląd 3/4. Niezgodne pary służą wyłącznie kontroli geometrii.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:5173';
const output = resolve(process.argv[3] ?? 'artifacts/module-visuals');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const manifest = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Pusta strona na serwerze Vite: importuje prawdziwy viewmodel bez uruchamiania rozgrywki.
  await page.route('**/module-visuals-preview', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html lang="pl"><meta charset="utf-8"><title>Moduły FPP</title><style>body{margin:0;background:#101923}canvas{display:block}#caption{position:fixed;top:20px;left:24px;color:#fff1d6;font:18px monospace}</style><div id="caption"></div></html>',
    }),
  );
  await page.goto(`${base}/module-visuals-preview`);
  const cases = await page.evaluate(async () => {
    const { weaponDefinitions } =
      await import('/src/combat/weapons/weaponSchema.ts');
    const { moduleDefinitions, moduleFitsWeapon } =
      await import('/src/progression/moduleSchema.ts');
    return [...weaponDefinitions.values()].flatMap((weapon) =>
      [...moduleDefinitions.values()].map((module) => ({
        weapon: weapon.id,
        model: weapon.model,
        module: module.id,
        shape: module.visual.shape,
        compatible: moduleFitsWeapon(module, weapon.id),
      })),
    );
  });
  for (const entry of cases) {
    for (const shot of ['hip', 'ads', 'side']) {
      const aim = shot === 'ads' ? 1 : 0;
      const result = await page.evaluate(
        async ({ entry, aim, shot }) => {
          window.modulePreviewCleanup?.();
          const THREE =
            await import('/node_modules/three/build/three.module.js');
          const { FppViewModel } = await import('/src/render/fppViewModel.ts');
          const { EventBus } = await import('/src/core/events.ts');
          const { tuning } = await import('/src/core/tuning.ts');
          const { renderWithViewmodel, viewmodelFov } =
            await import('/src/render/viewmodelLayer.ts');
          const renderer = new THREE.WebGLRenderer({
            antialias: true,
            preserveDrawingBuffer: true,
          });
          renderer.setSize(1280, 720);
          document.body.append(renderer.domElement);
          const scene = new THREE.Scene();
          scene.background = new THREE.Color('#162330');
          const camera = new THREE.PerspectiveCamera(
            tuning.camera.fov,
            1280 / 720,
            0.01,
            100,
          );
          const key = new THREE.DirectionalLight('#fff1d6', 2);
          key.position.set(-2, 3, 2);
          scene.add(new THREE.HemisphereLight('#a4c8ed', '#263443', 2), key);
          const bus = new EventBus();
          const view = new FppViewModel(bus, 1, {
            modelOf: () => entry.model,
            modulesOf: () => [entry.module],
          });
          bus.emit('weapon_switched', {
            owner: 1,
            weapon: entry.weapon,
            slot: 0,
          });
          await view.load();
          scene.add(view.root);
          camera.updateMatrixWorld();
          view.place(camera.matrixWorld, 0, {
            held: 'gun',
            horizontalSpeed: 0,
            aim,
          });
          const visual = view.root.getObjectByName(`module_${entry.shape}`);
          if (!visual)
            throw new Error(`Nie załadowano ${entry.model}/${entry.shape}`);
          if (shot === 'side') {
            // Ten sam model i dodatki, poza pozą FPP; widoczny lewy bok oraz przód lufy.
            const gun = visual.parent;
            scene.add(gun);
            gun.traverse((part) => {
              part.layers.set(0);
              if (part.userData.noOutline) part.visible = false;
            });
            view.root.visible = false;
            const { frameModuleSide } =
              await import('/tools/screens/moduleSideCamera.ts');
            frameModuleSide(camera, gun);
            renderer.render(scene, camera);
          } else {
            renderWithViewmodel(renderer, scene, camera);
            camera.fov = viewmodelFov(camera);
            camera.updateProjectionMatrix();
          }
          // Rzut fizycznych części modułu, przed uwzględnieniem zasłonięcia dłonią.
          const screenBox = new THREE.Box2();
          const point = new THREE.Vector3();
          const pixel = new THREE.Vector2();
          visual.traverseVisible((mesh) => {
            if (!mesh.isMesh || mesh.userData.noOutline) return;
            const vertices = mesh.geometry.getAttribute('position');
            for (let i = 0; i < vertices.count; i++) {
              point
                .fromBufferAttribute(vertices, i)
                .applyMatrix4(mesh.matrixWorld)
                .project(camera);
              screenBox.expandByPoint(
                pixel.set((point.x + 1) * 640, (1 - point.y) * 360),
              );
            }
          });
          const projected = screenBox.getSize(new THREE.Vector2());
          document.getElementById('caption').textContent =
            `${entry.weapon} / ${entry.shape} / ${shot === 'side' ? 'podgląd 3/4' : aim ? 'ADS (poza)' : 'biodro'}${entry.compatible ? '' : ' / tylko geometria — niedostępne w grze'}`;
          window.modulePreviewCleanup = () => {
            view.dispose();
            renderer.dispose();
            renderer.domElement.remove();
          };
          return {
            children: visual.children.length,
            projectedBboxPx: { width: projected.x, height: projected.y },
          };
        },
        { entry, aim, shot },
      );
      if (errors.length) throw new Error(errors.join('\n'));
      const file = `${entry.weapon}-${entry.shape}-${shot}.png`;
      await page.screenshot({ path: join(output, file) });
      manifest.push({ ...entry, aim, shot, file, ...result });
    }
  }
  await writeFile(
    join(output, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  );
  console.log(`Zapisano ${manifest.length} ujęć FPP: ${output}`);
} finally {
  await browser.close();
}
