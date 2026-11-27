import { readFile } from 'node:fs/promises';
import { Box3, Mesh, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import bounds from '../../src/data/render/mapModelBounds.json';
import { isCityModelFile } from '../../src/render/cityModels';
import { applyStyle } from '../../src/render/materials';

const sizes = {
  bw_reception_counter: [4, 1.15, 0.95],
  bw_waiting_seats: [2.8, 0.95, 0.75],
  bw_entry_scanner: [3.8, 3.1, 0.8],
  bw_treatment_screen: [2.8, 1.55, 0.14],
  bw_treatment_bed: [0.85, 1.05, 2],
  bw_sample_fridge: [1.2, 2.15, 0.95],
  bw_freight_lift_frame: [5, 4.2, 1.1],
  bw_door_portal: [4.6, 3.7, 0.6],
  bw_curtain_wall_frame: [4, 5, 0.3],
  bw_glass_balustrade: [4, 1.1, 0.12],
  bw_ceiling_panel: [2.4, 0.3, 1.2],
  bw_operating_table: [0.9, 1, 2.2],
  bw_surgical_robot: [2.4, 2.9, 1.6],
  bw_resonance_scanner: [2.8, 2.5, 3.4],
  bw_regen_pod: [1.3, 2.5, 1.3],
  bw_regen_pod_open: [1.3, 2.5, 1.6],
  bw_calibration_chair: [1.1, 2.2, 2],
  bw_kamerton_cradle: [2.6, 3.3, 2.6],
  bw_pharmacy_dispenser: [2.4, 2.4, 0.9],
  bw_implant_showcase: [1, 2.1, 1],
  bw_lab_analyzer_bench: [2.4, 1.5, 0.8],
  bw_med_cart: [0.6, 1, 0.9],
  bw_info_totem: [0.8, 2.2, 0.3],
  bw_planter_bio: [2.4, 1.9, 2.4],
  bw_helix_sculpture: [3, 8, 3],
} as const;

it.each(Object.keys(sizes) as (keyof typeof sizes)[])(
  '%s ładuje się z właściwą obwiednią i materiałami gry',
  async (id) => {
    expect(isCityModelFile(id)).toBe(true);
    const bytes = await readFile(`public/assets/models/city/${id}.glb`);
    const { scene } = await new GLTFLoader().parseAsync(
      Uint8Array.from(bytes).buffer,
      '',
    );
    scene.updateMatrixWorld(true);
    const box = new Box3().setFromObject(scene, true);
    expect(box.min.y).toBeCloseTo(0, 4);
    const center = box.getCenter(new Vector3());
    expect(Math.hypot(center.x, center.z)).toBeLessThan(0.001);
    const size = box.getSize(new Vector3()).toArray();
    sizes[id].forEach((target, axis) => {
      expect(Math.abs(size[axis]! / target - 1)).toBeLessThanOrEqual(0.03);
      expect(box.min.toArray()[axis]).toBeCloseTo(bounds[id].min[axis]!, 3);
      expect(box.max.toArray()[axis]).toBeCloseTo(bounds[id].max[axis]!, 3);
    });
    applyStyle(scene);
    const names = new Set<string>();
    scene.traverse((mesh) => {
      if (!(mesh instanceof Mesh)) return;
      for (const mat of [mesh.material].flat()) {
        names.add(mat.name);
        if (mat.name === 'mat_clinic_glass') {
          expect(mat.transparent).toBe(true);
          expect(mat.opacity).toBeGreaterThan(0);
          expect(mat.opacity).toBeLessThan(1);
        }
      }
    });
    expect(names.has('mat_world')).toBe(false);
    expect([...names].sort()).toEqual(bounds[id].materials);
    if (
      [
        'bw_treatment_screen',
        'bw_sample_fridge',
        'bw_door_portal',
        'bw_glass_balustrade',
        'bw_regen_pod',
        'bw_regen_pod_open',
        'bw_implant_showcase',
        'bw_pharmacy_dispenser',
        'bw_lab_analyzer_bench',
        'bw_med_cart',
      ].includes(id)
    )
      expect(names.has('mat_clinic_glass')).toBe(true);
    if (id === 'bw_regen_pod' || id === 'bw_regen_pod_open')
      expect(names.has('mat_neon_green')).toBe(id === 'bw_regen_pod');
    if (
      id === 'bw_entry_scanner' ||
      id === 'bw_freight_lift_frame' ||
      id === 'bw_door_portal'
    ) {
      const half = id === 'bw_entry_scanner' ? 1.5 : 2;
      const height = id === 'bw_door_portal' ? 3.4 : 3;
      const hit = (x: number, y: number) =>
        new Raycaster(
          new Vector3(x, y, 2),
          new Vector3(0, 0, -1),
        ).intersectObject(scene).length;
      for (const x of [0, half - 0.001, -half + 0.001])
        for (const y of [0.002, 1.5, height - 0.001]) expect(hit(x, y)).toBe(0);
      for (const x of [half + 0.12, -half - 0.12])
        expect(hit(x, 1.5)).toBeGreaterThan(0);
      expect(hit(0, height + 0.05)).toBeGreaterThan(0);
    }
  },
);
