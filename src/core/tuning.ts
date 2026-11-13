import GUI from 'lil-gui';

export const tuning = {
  time: {
    hitstopLightMs: 40,
    hitstopHeavyMs: 80,
    lastKillSlowmoS: 0.3,
    lastKillTimeScale: 0.2,
  },
  camera: { fov: 90, shakeMax: 0.4 },
  /** Kontroler FPP (#02). Prędkości m/s, przyspieszenia m/s², czasy ms. */
  player: {
    walkSpeed: 7,
    sprintSpeed: 11,
    groundAccel: 90,
    airAccel: 30,
    groundFriction: 12,
    jumpVelocity: 8,
    doubleJumpVelocity: 7.5,
    coyoteTimeMs: 100,
    jumpBufferMs: 120,
    capsuleHeight: 1.8,
    capsuleRadius: 0.35,
    eyeHeight: 1.65,
    stepHeight: 0.35,
    maxSlopeDeg: 45,
    lookSensitivity: 0.0022,
    maxPitchDeg: 89,
    controllerOffset: 0.02,
    stepMinWidth: 0.2,
    snapToGroundDistance: 0.3,
    groundStickSpeed: 2,
  },
  physics: { gravity: -20, maxDynamicBodies: 300 },
  sandbox: { cubeSpawnHeight: 6 },
};
export type Tuning = typeof tuning;

export function createTuningGui(t: Tuning = tuning): GUI {
  const gui = new GUI({ title: 'NEORYDER — strojenie' });
  function populate(parent: GUI, group: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(group)) {
      if (typeof value === 'number') parent.add(group, key);
      else if (typeof value === 'object' && value !== null)
        populate(parent.addFolder(key), value as Record<string, unknown>);
    }
  }
  populate(gui, t);
  return gui;
}
