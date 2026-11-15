import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimationAction, AnimationMixer, Vector3 } from 'three';
import type { Mesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EnemyView } from '../../src/enemies/enemyView';
import { HeldShield } from '../../src/enemies/heldShield';
import { enemySchema } from '../../src/enemies/enemySchema';
import { selectEnemyAnimation } from '../../src/enemies/enemyAnimation';
import type { Enemy, EnemySnapshot } from '../../src/enemies/types';
import shielderRaw from '../../src/data/enemies/shielder.json';
import chiefRaw from '../../src/data/enemies/securityChief.json';

const shielder = enemySchema.parse(shielderRaw);
const chief = enemySchema.parse(chiefRaw);
async function load(name: string) {
  const file = readFileSync(
    join(__dirname, '../../public/assets/models', `${name}.glb`),
  );
  return new GLTFLoader().parseAsync(
    file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
    '',
  );
}
const snapshot = (): EnemySnapshot => ({
  state: 'idle',
  stateTimeS: 0,
  speed: 0,
  distance: 0,
  yaw: 0,
  position: { x: 0, y: 0, z: 0 },
});
const views: EnemyView[] = [];
afterEach(() => {
  for (const view of views.splice(0)) view.dispose();
  vi.restoreAllMocks();
});

describe('tarcza Tarczownika trzymana w ręce', () => {
  it('stoi przed lewą połową tułowia, jest przypięta do kości ręki i podąża za klipami', async () => {
    const gltf = await load('enemy_shielder');
    const root = gltf.scene;
    const shield = root.getObjectByName('shield') as Mesh;
    const hold = shielder.animation!.shieldHold!;
    const mixer = new AnimationMixer(root);
    const clip = (name: string) =>
      gltf.animations.find((c) => c.name === name)!;
    mixer.clipAction(clip('Idle_Loop')).play();
    mixer.setTime(0);
    const held = HeldShield.mount(shield, root, hold)!;
    expect(held).not.toBeNull();
    expect(shield.parent).toBe(root);
    const center = new Vector3();
    const bone = root.getObjectByName(hold.bone)!;
    const tracked = new Vector3();
    shield.getWorldPosition(center);
    expect(center.x).toBeCloseTo(hold.position.x);
    expect(center.y).toBeCloseTo(hold.position.y);
    expect(center.z).toBeCloseTo(hold.position.z);
    const reach = center.distanceTo(bone.getWorldPosition(tracked));
    for (const name of [
      'Idle_Loop',
      'Walk_Loop',
      'Jog_Fwd_Loop',
      'Punch_Enter',
      'Punch_Cross',
      'Hit_Chest',
    ]) {
      mixer.stopAllAction();
      mixer.clipAction(clip(name)).reset().play();
      for (let i = 0; i <= 12; i++) {
        mixer.setTime((clip(name).duration * i) / 12);
        root.updateMatrixWorld(true);
        held.update();
        shield.getWorldPosition(center);
        bone.getWorldPosition(tracked);
        // Środek tarczy zostaje na stałej odległości od kości (przypięcie), tarcza stoi i patrzy przed siebie.
        expect(center.distanceTo(tracked), `${name} ${i}`).toBeLessThan(
          reach + 0.15,
        );
        const up = new Vector3(0, 1, 0).transformDirection(shield.matrixWorld);
        const face = new Vector3(0, 0, 1).transformDirection(
          shield.matrixWorld,
        );
        expect(up.y, `${name} ${i}: tarcza stoi`).toBeGreaterThan(0.7);
        expect(face.z, `${name} ${i}: tarcza do przodu`).toBeGreaterThan(0.7);
      }
    }
  });

  it('widok montuje tarczę w modelu i ustawia ją w pozie odniesienia z danych', async () => {
    const source = await load('enemy_shielder');
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(source);
    const enemy = {
      id: 1,
      definition: { ...shielder, model: 'test-held-shielder' },
      previous: snapshot(),
      current: { ...snapshot(), shieldUp: true },
      removed: false,
      step() {},
      dispose() {},
    } as unknown as Enemy;
    const view = new EnemyView(enemy);
    views.push(view);
    await vi.waitFor(() =>
      expect(view.root.getObjectByName('armored_body')).toBeDefined(),
    );
    const shield = view.root.getObjectByName('shield')!;
    expect(shield.parent).toBe(view.root);
    const hold = shielder.animation!.shieldHold!;
    expect(view.root.getObjectByName(hold.bone)).toBeDefined();
    const center = shield.getWorldPosition(new Vector3());
    expect(center.x).toBeCloseTo(hold.position.x);
    expect(center.y).toBeCloseTo(hold.position.y);
    expect(center.z).toBeCloseTo(hold.position.z);
  });
});

describe('animacja bossa', () => {
  const attack = { kind: 'slam', telegraphS: 0.9, recoveryS: 0.7 };
  const snap = (s: Partial<EnemySnapshot>): EnemySnapshot => ({
    ...snapshot(),
    ...s,
  });

  it('chodzi klipem Walk_Loop także przy pełnej prędkości, w miejscu stoi', () => {
    expect(
      selectEnemyAnimation(
        chief,
        snap({ state: 'chase', speed: chief.moveSpeed }),
      ),
    ).toMatchObject({ clip: 'Walk_Loop', moving: true });
    expect(selectEnemyAnimation(chief, snap({ state: 'idle' }))).toMatchObject({
      clip: 'Idle_Loop',
      moving: false,
    });
  });

  it('zapowiedź dochodzi do chwili skutku, wymach i regeneracja kontynuują tę samą akcję', () => {
    const spec = chief.boss!.attackAnimations!.slam!;
    const telegraph = selectEnemyAnimation(
      chief,
      snap({ state: 'telegraph', attack }),
    );
    expect(telegraph.clip).toBe(spec.clip);
    expect(telegraph.segment).toEqual({
      from: 0,
      to: spec.impact,
      spanS: attack.telegraphS,
    });
    for (const state of ['swing', 'recovery'] as const) {
      const next = selectEnemyAnimation(chief, snap({ state, attack }));
      expect(next.continues).toBe(true);
      expect(next.segment).toEqual({
        from: spec.impact,
        to: spec.end,
        spanS: chief.swingActiveS + attack.recoveryS,
      });
    }
    // Bez wzorca (np. przesunięcie fazy) obowiązuje zwykły klip.
    expect(
      selectEnemyAnimation(chief, snap({ state: 'recovery' })).segment,
    ).toBeUndefined();
  });

  async function bossView() {
    const source = await load('enemy_executor');
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(source);
    const actions = vi.spyOn(AnimationMixer.prototype, 'clipAction');
    const enemy = {
      id: 2,
      definition: { ...chief, model: 'test-boss-model' },
      previous: snapshot(),
      current: snapshot(),
      removed: false,
      step() {},
      dispose() {},
    } as unknown as Enemy;
    const view = new EnemyView(enemy);
    views.push(view);
    await vi.waitFor(() =>
      expect(view.root.getObjectByName('armored_body')).toBeDefined(),
    );
    const find = (name: string) =>
      actions.mock.results
        .map((r) => r.value as AnimationAction)
        .find((a) => a.getClip().name === name)!;
    return { enemy, view, find };
  }

  it('tempo chodu zależy od prędkości, w bezruchu gra klip Idle', async () => {
    const { enemy, view, find } = await bossView();
    enemy.current.state = 'chase';
    enemy.current.speed = chief.moveSpeed;
    view.render(1);
    const walk = find('Walk_Loop');
    const full =
      (walk.getClip().duration * chief.moveSpeed) / chief.animation!.strideM;
    expect(walk.getEffectiveTimeScale()).toBeCloseTo(full);
    expect(full).toBeGreaterThan(0);
    enemy.current.speed = chief.moveSpeed / 2;
    view.render(1);
    expect(walk.getEffectiveTimeScale()).toBeCloseTo(full / 2);
    enemy.current.state = 'idle';
    enemy.current.speed = 0;
    view.render(1);
    expect(find('Idle_Loop').getEffectiveTimeScale()).toBe(1);
  });

  it('akcja ataku nie jest resetowana między zapowiedzią a wymachem, tempo wynika z danych', async () => {
    const { enemy, view, find } = await bossView();
    const spec = chief.boss!.attackAnimations!.slam!;
    const action = find(spec.clip);
    const reset = vi.spyOn(action, 'reset');
    enemy.current.state = 'telegraph';
    enemy.current.attack = attack;
    enemy.current.stateTimeS = 0.3;
    view.render(1);
    expect(reset).toHaveBeenCalledOnce();
    expect(action.getEffectiveTimeScale()).toBeCloseTo(
      (spec.impact * action.getClip().duration) / attack.telegraphS,
    );
    enemy.current.state = 'swing';
    enemy.current.stateTimeS = 0.02;
    view.render(1);
    expect(reset).toHaveBeenCalledOnce();
    expect(action.getEffectiveTimeScale()).toBeCloseTo(
      ((spec.end - spec.impact) * action.getClip().duration) /
        (chief.swingActiveS + attack.recoveryS),
    );
  });
});
