import { z } from 'zod';

export const JOINT_IDS = [
  'root', 'hip', 'torso', 'neck', 'right_shoulder', 'right_elbow', 'right_hand',
  'left_shoulder', 'left_elbow', 'left_hand', 'right_hip', 'right_knee',
  'right_foot', 'left_hip', 'left_knee', 'left_foot',
] as const;

export const BONE_IDS = [
  'hip', 'torso', 'neck', 'right_shoulder', 'right_elbow', 'right_hand',
  'left_shoulder', 'left_elbow', 'left_hand', 'right_hip', 'right_knee',
  'right_foot', 'left_hip', 'left_knee', 'left_foot',
] as const;

export type JointId = (typeof JOINT_IDS)[number];
export type BoneId = (typeof BONE_IDS)[number];
export type Vec2 = [number, number];
export type LocaleText = { ja: string; en: string };
export type MotionCategory = 'idle' | 'locomotion' | 'dance' | 'greeting' | 'emotion' | 'action';

const finiteNumber = z.number().finite();
const angleFrames = Object.fromEntries(BONE_IDS.map((bone) => [bone, z.array(finiteNumber).min(1).max(3600)])) as Record<BoneId, z.ZodArray<typeof finiteNumber>>;
const restAngleShape = Object.fromEntries(BONE_IDS.map((bone) => [bone, finiteNumber])) as Record<BoneId, typeof finiteNumber>;

export const MotionClipSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9_]{1,32}$/),
  name: z.object({ ja: z.string().min(1), en: z.string().min(1) }).strict(),
  keywords: z.object({ ja: z.array(z.string()).min(1), en: z.array(z.string()).min(1) }).strict(),
  category: z.enum(['idle', 'locomotion', 'dance', 'greeting', 'emotion', 'action']),
  fps: z.number().finite().positive().max(120),
  frameCount: z.number().int().positive().max(3600),
  loop: z.boolean(),
  rootTranslation: z.array(z.tuple([finiteNumber, finiteNumber])).min(1).max(3600),
  restAngles: z.object(restAngleShape).strict(),
  frames: z.object(angleFrames).strict(),
}).strict().superRefine((clip, ctx) => {
  if (clip.rootTranslation.length !== clip.frameCount) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rootTranslation'], message: 'frame count mismatch' });
  for (const [bone, frames] of Object.entries(clip.frames)) {
    if (frames.length !== clip.frameCount) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['frames', bone], message: 'frame count mismatch' });
  }
});

export type MotionClip = z.infer<typeof MotionClipSchema>;
export type MotionSample = { angles: Record<BoneId, number>; rootT: Vec2; frame: number };

export type MotionIndexEntry = { id: string; file: string; category: MotionCategory; sha256: string };
export const MotionIndexSchema = z.array(z.object({ id: z.string().regex(/^[a-z0-9_]{1,32}$/), file: z.string().regex(/^\/motions\/[a-z0-9_]+\.json$/), category: z.enum(['idle', 'locomotion', 'dance', 'greeting', 'emotion', 'action']), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict());

export const makeEmptyAngles = (): Record<BoneId, number> => {
  const output = {} as Record<BoneId, number>;
  for (const bone of BONE_IDS) output[bone] = 0;
  return output;
};
