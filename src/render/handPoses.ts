import { z } from 'zod';
import data from '../data/hands/handPoses.json';
import bladeGripData from '../data/hands/bladeGrip.json';

export const handNodes = [
  'forearm',
  'wrist',
  'palm',
  'index_1',
  'index_2',
  'index_3',
  'middle_1',
  'middle_2',
  'middle_3',
  'ring_1',
  'ring_2',
  'ring_3',
  'pinky_1',
  'pinky_2',
  'pinky_3',
  'thumb_1',
  'thumb_2',
  'thumb_3',
  'palm_center',
  'resonance_core',
  'socket_blade',
  'socket_gun',
  'socket_support',
] as const;
const angle = z.number().finite();
const vector = z.tuple([angle, angle, angle]);
export const bladeGrip = z
  .strictObject({
    socketPosition: vector,
    idlePosition: vector,
    idleRotation: vector,
    offhandDropM: z.number().finite().nonnegative(),
  })
  .parse(bladeGripData);
const poseSchema = z.partialRecord(
  z.enum(handNodes),
  z.tuple([angle, angle, angle]),
);
export const handPosesSchema = z.strictObject({
  poses: z.strictObject({
    relaxed: poseSchema,
    open: poseSchema,
    fist: poseSchema,
    gripBlade: poseSchema,
    gripGun: poseSchema,
    gripGunFire: poseSchema,
    support: poseSchema,
    // Chwyty dopasowane do modeli broni (pole `grip` w src/data/weapons/*.json).
    gripPistol: poseSchema,
    gripPistolFire: poseSchema,
    supportPistol: poseSchema,
    gripRifle: poseSchema,
    gripRifleFire: poseSchema,
    gripScatter: poseSchema,
    gripScatterFire: poseSchema,
    gripSniper: poseSchema,
    gripSniperFire: poseSchema,
    gripBeam: poseSchema,
    gripBeamFire: poseSchema,
    gripEmp: poseSchema,
    gripEmpFire: poseSchema,
    supportRifle: poseSchema,
    supportScatter: poseSchema,
    supportSniper: poseSchema,
    supportBeam: poseSchema,
    supportEmp: poseSchema,
  }),
});
export const handPoses = handPosesSchema.parse(data).poses;
export type HandPose = keyof typeof handPoses;
export function isHandPose(name: string): name is HandPose {
  return Object.hasOwn(handPoses, name);
}
export type HandSocket = 'socket_blade' | 'socket_gun' | 'socket_support';
