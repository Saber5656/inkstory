import { z } from 'zod';
import { MotionClipSchema as DomainMotionClipSchema } from '../domain';
import { BONE_IDS as DOMAIN_BONE_IDS, JOINT_NAMES } from '../domain/skeleton';

export const JOINT_IDS = JOINT_NAMES;
export const BONE_IDS = DOMAIN_BONE_IDS;
export type JointId = (typeof JOINT_IDS)[number];
export type BoneId = (typeof BONE_IDS)[number];
export type Vec2 = [number, number];
export type LocaleText = { ja: string; en: string };
export type MotionCategory =
  'idle' | 'locomotion' | 'dance' | 'greeting' | 'emotion' | 'action';
export const MotionClipSchema = DomainMotionClipSchema;
export type MotionClip = z.infer<typeof DomainMotionClipSchema>;
export type MotionSample = {
  angles: Record<BoneId, number>;
  rootT: Vec2;
  frame: number;
};
export type MotionIndexEntry = {
  id: string;
  file: string;
  category: MotionCategory;
  sha256: string;
};
export const MotionIndexSchema = z.array(
  z
    .object({
      id: z.string().regex(/^[a-z0-9_]{1,32}$/),
      file: z.string().regex(/^\/motions\/[a-z0-9_]+\.json$/),
      category: z.enum([
        'idle',
        'locomotion',
        'dance',
        'greeting',
        'emotion',
        'action',
      ]),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict(),
);
export const makeEmptyAngles = (): Record<BoneId, number> =>
  Object.fromEntries(BONE_IDS.map((bone) => [bone, 0])) as Record<
    BoneId,
    number
  >;
