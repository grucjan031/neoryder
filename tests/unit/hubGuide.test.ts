// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { hubGuideTarget } from '../../src/world/hubGuide';
import { HubGuide } from '../../src/ui/hubGuide';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import { tuning } from '../../src/core/tuning';
import text from '../../src/data/ui/meta.pl.json';

afterEach(() => document.body.replaceChildren());

it.each([
  [0, 0, 'missions'],
  [0, 3, 'missions'],
  [1, 2, 'talents'],
  [1, 0, null],
] as const)('runs=%i, punkty=%i → %s', (runs, points, target) => {
  const meta = createStarterMetaState();
  meta.stats.runs = runs;
  expect(hubGuideTarget(meta, points)).toBe(target);
});

it('pokazuje tytuł stacji, dystans i obrót względem yaw; zmienia cel', () => {
  const guide = new HubGuide();
  const root = document.querySelector<HTMLElement>('[data-hub-guide]')!;
  expect(root.hidden).toBe(true);
  const player = { position: { x: 0, y: 1, z: 0 }, yaw: 0 };
  guide.update('missions', { x: 0, z: -10 }, player);
  expect(root.hidden).toBe(false);
  expect(root.dataset.target).toBe('missions');
  expect(root.textContent).toContain(
    `${text.hub.stations.missions.title} · 10 m`,
  );
  expect(root.textContent).toContain(text.hub.guide.firstRun);
  expect(root.querySelector('span')!.style.transform).toBe('rotate(0rad)');
  guide.update('talents', { x: 0, z: -10 }, { ...player, yaw: Math.PI });
  expect(root.dataset.target).toBe('talents');
  expect(root.textContent).toContain(text.hub.stations.talents.title);
  expect(root.textContent).not.toContain(text.hub.guide.firstRun);
  expect(root.querySelector('span')!.style.transform).toBe(
    `rotate(${Math.PI}rad)`,
  );
  guide.dispose();
  expect(document.querySelector('[data-hub-guide]')).toBeNull();
});

it('chowa się poniżej promienia, przy blokadzie lub braku celu i wraca po odblokowaniu', () => {
  const guide = new HubGuide();
  const root = document.querySelector<HTMLElement>('[data-hub-guide]')!;
  const player = { position: { x: 0, y: 0, z: 0 }, yaw: 0 };
  const position = { x: 0, z: -tuning.hub.guideHideRadiusM };
  guide.update('missions', { x: 0, z: position.z + 0.01 }, player);
  expect(root.hidden).toBe(true);
  guide.update('missions', position, player);
  expect(root.hidden).toBe(false);
  guide.update('missions', position, player, true);
  expect(root.hidden).toBe(true);
  guide.update('missions', position, player, false);
  expect(root.hidden).toBe(false);
  guide.update(null, position, player);
  expect(root.hidden).toBe(true);
  expect(root.dataset.target).toBeUndefined();
  guide.update('missions', null, player);
  expect(root.hidden).toBe(true);
});
