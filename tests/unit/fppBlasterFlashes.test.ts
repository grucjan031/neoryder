import { expect, it } from 'vitest';
import type { MeshBasicMaterial } from 'three';
import { EventBus } from '../../src/core/events';
import { FppBlaster } from '../../src/render/fppBlaster';

type FlashMaterials = {
  flashMaterial: MeshBasicMaterial;
  flashCoreMaterial: MeshBasicMaterial;
  flashConeMaterial: MeshBasicMaterial;
};

it.each([true, false])(
  'błysk wylotu respektuje ustawienie „Błyski ekranu” (flashes=%s)',
  (flashes) => {
    const bus = new EventBus();
    const gun = new FppBlaster(bus, 1, { settings: { flashes } });
    bus.emit('weapon_fired', { owner: 1 } as never);
    const m = gun as unknown as FlashMaterials;
    expect(m.flashMaterial.visible).toBe(flashes);
    expect(m.flashCoreMaterial.visible).toBe(flashes);
    // Płatek zostaje zawsze (strzał czytelny), przygaszony bez błysków.
    expect(m.flashConeMaterial.visible).toBe(true);
    expect(m.flashConeMaterial.opacity).toBeCloseTo(flashes ? 0.9 : 0.3);
    gun.dispose();
  },
);
