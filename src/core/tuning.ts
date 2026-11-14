import GUI from 'lil-gui';

export const tuning = {
  time: {
    hitstopLightMs: 40,
    hitstopHeavyMs: 80,
    lastKillSlowmoS: 0.3,
    lastKillTimeScale: 0.2,
  },
  /** Kamera FPP (#03). Wstrząs: trauma 0..1, amplituda = trauma² × shakeMax. Czasy w s. */
  camera: {
    fov: 90,
    shakeMax: 0.4,
    shakeMaxAngleDeg: 5,
    shakeMaxOffset: 0.06,
    shakeFrequency: 22,
    shakeDamageRef: 40,
    shakeOnHitScale: 0.3,
    sprintFovKick: 6,
    dashFovKick: 12,
    fovLerpRate: 9,
    bobEnabled: 1,
    bobAmount: 0.03,
    bobStride: 2.4,
    landingDipPerSpeed: 0.012,
    landingDipMax: 0.16,
    landingRecoverRate: 9,
    eyeLerpRate: 16,
  },
  render: {
    world: '#ffffff',
    enemy: '#e0262b',
    enemyGlow: '#ff5050',
    interactive: '#080808',
    player: '#00e5ff',
    power: '#ff2bd6',
    outline: 1,
    outlineThickness: 1,
    outlineDepthThreshold: 0.025,
    outlineNormalThreshold: 0.2,
    outlineColor: '#30343b',
    hemiIntensity: 0.6,
    keyIntensity: 2.4,
  },
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
    /** Dash (#04): dystans w m w czasie dashDurationS, odnowienie przez stat dashCooldown. */
    dashDistance: 6,
    dashDurationS: 0.18,
    dashCooldownS: 1.2,
    dashExitSpeed: 9,
    dashInvulnerable: 0,
    /** Slide (#04): crouch przy prędkości ≥ slideMinSpeed na ziemi. */
    slideMinSpeed: 9,
    slideBoost: 2.5,
    slideMaxSpeed: 15,
    slideFriction: 1.4,
    slideSteer: 6,
    slideEndSpeed: 4,
    slideMaxS: 1.1,
    slideCapsuleHeight: 1.0,
    crouchSpeed: 3.5,
  },
  physics: { gravity: -20, maxDynamicBodies: 300 },
  damage: { playerInvulnMs: 250, respawnS: 1.5 },
  weapons: { overheatLockS: 1.5, coolDelayS: 0.25, maxProjectiles: 256 },
  sandbox: { cubeSpawnHeight: 6 },
};
export type Tuning = typeof tuning;

export function createTuningGui(t: Tuning = tuning): GUI {
  const gui = new GUI({ title: 'NEORYDER — strojenie' });
  function populate(parent: GUI, group: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(group)) {
      if (typeof value === 'number') parent.add(group, key);
      else if (typeof value === 'string' && value.startsWith('#'))
        parent.addColor(group, key);
      else if (typeof value === 'object' && value !== null)
        populate(parent.addFolder(key), value as Record<string, unknown>);
    }
  }
  populate(gui, t);
  return gui;
}
