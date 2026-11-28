import { Euler, Vector3 } from 'three';
import type { Scene as ThreeScene } from 'three';
import type { GameContext } from '../core/context';
import type { InputSnapshot } from '../core/input';
import data from '../data/scenes/horizonTest.json';
import { weatherDefinitions } from '../render/weatherSchema';
import { loadRoom } from '../world/roomSchema';
import type { RoomDefinition } from '../world/roomSchema';
import type { Scene } from './index';
import { createRoomTest } from './roomTest';
import { mountWeatherControls } from './weatherTest';

const OFFICE_TOWER_PROFILE = 'kuroganeOfficeTower';
const FOREST_PROFILE = 'kuroganeForestResidence';
const OFFICE_TOWER_DROP_M = 180;

const idle: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};

function parseDropM(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Układ dla sceny `?scene=horizonTest`.
 * Domyślnie zachowuje 600 × 600 m `horizonTest.json`; `?profile=kuroganeOfficeTower`
 * uruchamia przeszklony pokład na 60. piętrze (`panoramaDropM: 180`) z „żywym miastem”
 * i nowymi materiałami `off_*`, a `?drop=<m>` / `?weather=<id>` nadpisuje bazowy układ.
 */
export function horizonTestLayout(
  search = typeof location === 'undefined' ? '' : location.search,
): RoomDefinition {
  const params = new URLSearchParams(search);
  const profile = params.get('profile');
  const weatherParam = params.get('weather');
  const weather =
    weatherParam && weatherDefinitions.has(weatherParam)
      ? weatherParam
      : undefined;
  const drop = parseDropM(params.get('drop'));
  if (profile === FOREST_PROFILE) {
    return loadRoom({
      id: 'horizonTestForestResidence',
      name: 'Horyzont — nocny las za szybą rezydencji',
      type: 'combat',
      theme: 'neonStreet',
      weather: weather ?? FOREST_PROFILE,
      playerSpawn: { x: 0, y: 0, z: -7 },
      blocks: [
        {
          position: { x: 0, y: -0.4, z: 0 },
          size: { x: 24, y: 0.8, z: 22 },
          material: 'res_dark_walnut',
          walkable: true,
        },
        {
          position: { x: 0, y: 4.8, z: -10.9 },
          size: { x: 22, y: 9.6, z: 0.2 },
          material: 'glass_clear',
        },
        {
          position: { x: -11.9, y: 4.8, z: 0 },
          size: { x: 0.2, y: 9.6, z: 22 },
          material: 'glass_clear',
        },
        {
          position: { x: 11.9, y: 4.8, z: 0 },
          size: { x: 0.2, y: 9.6, z: 22 },
          material: 'glass_clear',
        },
        {
          position: { x: 0, y: 4.8, z: 10.9 },
          size: { x: 24, y: 9.6, z: 0.2 },
          material: 'res_arch_concrete',
        },
        {
          position: { x: 0, y: 9.8, z: 0 },
          size: { x: 24, y: 0.4, z: 22 },
          material: 'res_arch_concrete',
          ceiling: true,
        },
        {
          position: { x: -7, y: 0.05, z: 3 },
          size: { x: 4, y: 0.1, z: 4 },
          material: 'res_plush_carpet',
          walkable: true,
        },
        {
          position: { x: 7, y: 0.1, z: 3 },
          size: { x: 4, y: 0.2, z: 4 },
          material: 'res_nero_marble',
          walkable: true,
        },
      ],
      rainShelters: [
        { position: { x: 0, y: 4.8, z: 0 }, size: { x: 24, y: 9.6, z: 22 } },
      ],
      lights: [
        {
          position: { x: 0, y: 7, z: 2 },
          color: '#fff1d6',
          intensity: 26,
          range: 16,
          floorY: 0,
        },
      ],
      spawnPoints: [
        { x: -6, z: -3 },
        { x: 6, z: -3 },
        { x: -6, z: 6 },
        { x: 6, z: 6 },
      ],
      doors: [
        {
          id: 'entry',
          role: 'entry',
          position: { x: -4, y: 1.5, z: 9 },
          size: { x: 2, y: 3, z: 1 },
        },
        {
          id: 'exit',
          role: 'exit',
          position: { x: 4, y: 1.5, z: 9 },
          size: { x: 2, y: 3, z: 1 },
        },
      ],
    });
  }
  if (profile === OFFICE_TOWER_PROFILE) {
    const panoramaDropM = drop ?? OFFICE_TOWER_DROP_M;
    return loadRoom({
      id: 'horizonTestOfficeTower',
      name: 'Horyzont — Wieżowiec Kurogane Arms (Piętra 60–62)',
      type: 'combat',
      theme: 'neonStreet',
      weather: weather ?? OFFICE_TOWER_PROFILE,
      panoramaDropM,
      // Gracz stoi 3 m od północnej przeszklonej balustrady (bez niskiego sufitu nad głową),
      // dzięki czemu od razu widzi głęboki kanion 180 m w dole i pełne sylwetki bliskich wieżowców.
      playerSpawn: { x: 0, y: 0, z: -12 },
      blocks: [
        {
          position: { x: 0, y: -0.5, z: 0 },
          size: { x: 30, y: 1, z: 30 },
          material: 'off_polished_granite',
          walkable: true,
        },
        {
          position: { x: 0, y: 0.55, z: -14.9 },
          size: { x: 30, y: 1.1, z: 0.2 },
          material: 'glass_clear',
        },
        {
          position: { x: -14.9, y: 0.55, z: 0 },
          size: { x: 0.2, y: 1.1, z: 29.6 },
          material: 'glass_clear',
        },
        {
          position: { x: 14.9, y: 0.55, z: 0 },
          size: { x: 0.2, y: 1.1, z: 29.6 },
          material: 'glass_clear',
        },
        // Osłonięta wnęka biurowa z tyłu tarasu (za graczem): sufit, rainShelter i próbki off_*.
        {
          position: { x: 0, y: 2.2, z: 14.9 },
          size: { x: 30, y: 4.4, z: 0.2 },
          material: 'glass_clear',
        },
        {
          position: { x: 0, y: 4.6, z: 11 },
          size: { x: 30, y: 0.4, z: 8 },
          material: 'mall_acoustic_ceiling',
          ceiling: true,
        },
        {
          position: { x: -8, y: 2.2, z: 11 },
          size: { x: 2, y: 4.4, z: 2 },
          material: 'off_wood_slat_wall',
        },
        {
          position: { x: 8, y: 0.1, z: 11 },
          size: { x: 4, y: 0.2, z: 4 },
          material: 'off_carpet_tile',
          walkable: true,
        },
      ],
      rainShelters: [
        {
          position: { x: 0, y: 2.2, z: 11 },
          size: { x: 29.6, y: 4.4, z: 7.6 },
        },
      ],
      lights: [
        {
          position: { x: 0, y: 4.1, z: -8 },
          color: '#fff1d6',
          intensity: 24,
          range: 16,
          floorY: 0,
        },
        {
          position: { x: 0, y: 4.1, z: 10 },
          color: '#ffae1a',
          intensity: 24,
          range: 16,
          floorY: 0,
        },
      ],
      spawnPoints: [
        { x: -10, z: -6 },
        { x: 10, z: -6 },
        { x: -10, z: 4 },
        { x: 10, z: 4 },
      ],
      doors: [
        {
          id: 'entry',
          role: 'entry',
          position: { x: -4, y: 1.5, z: 14.5 },
          size: { x: 2, y: 3, z: 1 },
        },
        {
          id: 'exit',
          role: 'exit',
          position: { x: 4, y: 1.5, z: 14.5 },
          size: { x: 2, y: 3, z: 1 },
        },
      ],
    });
  }
  return loadRoom({
    ...data,
    ...(weather && { weather }),
    ...(drop !== null && { panoramaDropM: drop }),
  });
}

export class HorizonTest implements Scene {
  readonly id = 'horizonTest';
  private readonly layout: RoomDefinition;
  private readonly room: ReturnType<typeof createRoomTest>;
  private readonly position = new Vector3();
  private readonly movement = new Vector3();
  private readonly rotation = new Euler(0, 0, 0, 'YXZ');
  private ctx!: GameContext;
  private flying = false;
  private controls?: HTMLDivElement;
  private unregister?: () => void;

  constructor(search?: string) {
    this.layout = horizonTestLayout(search);
    this.room = createRoomTest(false, this.layout);
  }

  async init(ctx: GameContext, three: ThreeScene): Promise<void> {
    this.ctx = ctx;
    await this.room.init(ctx, three);
    ctx.commands?.execute('god');
    this.controls = mountWeatherControls(ctx);
    if (this.controls && typeof location !== 'undefined') {
      const elevated = this.layout.id === 'horizonTestOfficeTower';
      const forest = this.layout.id === 'horizonTestForestResidence';
      const modes = [
        {
          id: 'default',
          label: 'Horyzont bazowy (drop 0 m)',
          active: !elevated && !forest,
        },
        {
          id: OFFICE_TOWER_PROFILE,
          label: `Wieżowiec 60p (drop ${OFFICE_TOWER_DROP_M} m)`,
          active: elevated,
        },
        {
          id: FOREST_PROFILE,
          label: 'Rezydencja — las za szybą',
          active: forest,
        },
      ] as const;
      for (const mode of modes) {
        const button = document.createElement('button');
        button.dataset.horizonProfile = mode.id;
        button.textContent = mode.label;
        button.setAttribute('aria-pressed', String(mode.active));
        if (mode.active) {
          button.style.fontWeight = '700';
          button.style.outline = '2px solid #ffae1a';
        }
        button.addEventListener('click', () => {
          const next = new URLSearchParams(location.search);
          next.set('scene', 'horizonTest');
          next.delete('drop');
          next.delete('weather');
          if (mode.id === 'default') next.delete('profile');
          else next.set('profile', mode.id);
          location.search = `?${next.toString()}`;
        });
        this.controls.append(button);
      }
    }
    this.unregister = ctx.commands?.register('fly', 'fly', () => {
      const camera = ctx.camera;
      if (!camera) return 'Brak kamery.';
      this.flying = !this.flying;
      this.position.copy(camera.position);
      this.rotation.setFromQuaternion(camera.quaternion);
      return this.flying ? 'Wolna kamera.' : 'Kamera gracza.';
    });
  }

  step(dt: number, input: InputSnapshot): void {
    this.room.step(dt, this.flying ? idle : input);
    if (!this.flying) return;
    const { held, lookDelta } = input;
    const speed = this.ctx.tuning.horizon.flySpeedMps;
    const sensitivity = this.ctx.tuning.player.lookSensitivity;
    this.rotation.y -= lookDelta.x * sensitivity;
    this.rotation.x = Math.max(
      -Math.PI / 2,
      Math.min(Math.PI / 2, this.rotation.x - lookDelta.y * sensitivity),
    );
    this.movement
      .set(
        Number(held.has('moveRight')) - Number(held.has('moveLeft')),
        0,
        Number(held.has('moveBack')) - Number(held.has('moveForward')),
      )
      .applyEuler(this.rotation);
    this.movement.y += Number(held.has('jump')) - Number(held.has('crouch'));
    this.movement.normalize();
    this.position.addScaledVector(this.movement, speed * dt);
  }

  render(alpha: number, dt = 0): void {
    this.room.render(
      alpha,
      dt,
      this.flying
        ? { position: this.position, rotation: this.rotation }
        : undefined,
    );
  }

  query(name: string): unknown {
    if (name === 'panoramaDropM') return this.layout.panoramaDropM ?? 0;
    if (
      name === 'horizonProfile' &&
      this.layout.id === 'horizonTestForestResidence'
    )
      return FOREST_PROFILE;
    if (name === 'horizonProfile')
      return this.layout.id === 'horizonTestOfficeTower'
        ? OFFICE_TOWER_PROFILE
        : 'default';
    return this.room.query(name);
  }

  dispose(): void {
    this.unregister?.();
    this.controls?.remove();
    this.room.dispose();
  }
}
