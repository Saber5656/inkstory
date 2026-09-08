import { z } from 'zod';

import { BONE_IDS, JOINT_NAMES } from './skeleton';
import { idSchema } from './ids';

const finiteNumber = z.number().finite();
const timestamp = finiteNumber.int().nonnegative();
const point = z.tuple([finiteNumber, finiteNumber]);
const localeRecord = z
  .object({ ja: z.string().max(200), en: z.string().max(200) })
  .strict();
const keywordRecord = z
  .object({
    ja: z.array(z.string().max(80)).max(32),
    en: z.array(z.string().max(80)).max(32),
  })
  .strict();

function isBlobLike(value: unknown): value is Blob {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Blob;
  return (
    (typeof Blob !== 'undefined' && value instanceof Blob) ||
    (Object.prototype.toString.call(value) === '[object Blob]' &&
      typeof candidate.size === 'number' &&
      typeof candidate.type === 'string' &&
      typeof candidate.arrayBuffer === 'function')
  );
}

const jointShape = Object.fromEntries(
  JOINT_NAMES.map((name) => [name, point]),
) as Record<(typeof JOINT_NAMES)[number], typeof point>;
const boneAngleShape = Object.fromEntries(
  BONE_IDS.map((bone) => [bone, finiteNumber.min(-100000).max(100000)]),
) as Record<(typeof BONE_IDS)[number], typeof finiteNumber>;
const boneTrackShape = Object.fromEntries(
  BONE_IDS.map((bone) => [
    bone,
    z.array(finiteNumber.min(-100000).max(100000)).max(3600),
  ]),
) as Record<(typeof BONE_IDS)[number], z.ZodArray<typeof finiteNumber>>;

const effectPrefs = z
  .object({
    effectIds: z
      .array(z.string().regex(/^[a-z0-9_]{1,32}$/))
      .max(3)
      .optional(),
    intensity: finiteNumber.min(0).max(1).optional(),
    seed: finiteNumber.int().optional(),
    reducedMotion: z.boolean().optional(),
  })
  .strict();

export const BlobRecordSchema = z
  .object({
    id: idSchema,
    mime: z.string().min(1).max(255),
    data: z.custom<Blob>(isBlobLike, 'Expected Blob'),
    size: finiteNumber.int().nonnegative(),
    createdAt: timestamp,
  })
  .strict();

export const DrawingSchema = z
  .object({
    id: idSchema,
    createdAt: timestamp,
    source: z.enum(['camera', 'file']),
    imageBlobId: idSchema,
    width: z.number().int().positive().max(4096),
    height: z.number().int().positive().max(4096),
  })
  .strict();

export const CharacterRigSchema = z
  .object({
    schemaVersion: z.literal(1),
    joints: z.object(jointShape).strict(),
    mesh: z
      .object({
        vertices: z.array(finiteNumber).max(6000),
        triangles: z.array(z.number().int().nonnegative()).max(18000),
      })
      .strict(),
    weights: z
      .array(
        z
          .array(
            z
              .object({
                boneIndex: z
                  .number()
                  .int()
                  .min(0)
                  .max(BONE_IDS.length - 1),
                w: finiteNumber.min(0).max(1),
              })
              .strict(),
          )
          .max(2),
      )
      .max(3000),
    meshMethod: z.enum(['cdt', 'grid']),
    textureSize: z.tuple([
      z.number().int().positive().max(4096),
      z.number().int().positive().max(4096),
    ]),
  })
  .strict()
  .superRefine((rig, ctx) => {
    if (rig.mesh.vertices.length % 2 !== 0)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['mesh', 'vertices'],
        message: 'vertices must contain x/y pairs',
      });
    if (rig.mesh.triangles.length % 3 !== 0)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['mesh', 'triangles'],
        message: 'triangles must contain triples',
      });
    const vertexCount = Math.floor(rig.mesh.vertices.length / 2);
    rig.mesh.triangles.forEach((index, i) => {
      if (index >= vertexCount)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['mesh', 'triangles', i],
          message: 'triangle index is out of bounds',
        });
    });
    if (rig.weights.length !== vertexCount)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['weights'],
        message: 'weights must have one entry per vertex',
      });
  });

export const CharacterSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(50),
    createdAt: timestamp,
    updatedAt: timestamp,
    rigType: z.enum(['humanoid', 'cutout']),
    drawingId: idSchema,
    textureBlobId: idSchema,
    thumbBlobId: idSchema,
    rig: CharacterRigSchema.nullable(),
    effectPrefs,
  })
  .strict();

export const BookSchema = z
  .object({
    id: idSchema,
    title: z.string().min(1).max(100),
    createdAt: timestamp,
    updatedAt: timestamp,
    pageOrder: z.array(idSchema).max(1000),
  })
  .strict();

export const PageSchema = z
  .object({
    id: idSchema,
    bookId: idSchema,
    characterId: idSchema.optional(),
    backgroundId: z.string().min(1).max(64),
    text: z.string().max(500),
    motionId: z
      .string()
      .regex(/^[a-z0-9_]{1,32}$/)
      .optional(),
    effectIds: z.array(z.string().regex(/^[a-z0-9_]{1,32}$/)).max(3),
    narrationBlobId: idSchema.optional(),
    narrationMime: z.string().min(1).max(255).optional(),
    advance: z.enum(['tap', 'auto']),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict();

export const SettingsSchema = z
  .object({ key: z.string().min(1).max(100), value: z.unknown() })
  .strict();

export const MotionClipSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^[a-z0-9_]{1,32}$/),
    name: localeRecord,
    keywords: keywordRecord,
    category: z.enum([
      'idle',
      'locomotion',
      'dance',
      'greeting',
      'emotion',
      'action',
    ]),
    fps: z.union([z.literal(24), z.literal(30), z.literal(60)]),
    frameCount: z.number().int().min(2).max(3600),
    loop: z.boolean(),
    rootTranslation: z.array(point).max(3600),
    restAngles: z.object(boneAngleShape).strict(),
    frames: z.object(boneTrackShape).strict(),
  })
  .strict()
  .superRefine((motion, ctx) => {
    if (motion.rootTranslation.length !== motion.frameCount)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rootTranslation'],
        message: 'rootTranslation length must equal frameCount',
      });
    for (const bone of BONE_IDS) {
      if (motion.frames[bone].length !== motion.frameCount)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['frames', bone],
          message: 'bone track length must equal frameCount',
        });
    }
  });

export const ExportManifestSchema = z
  .object({
    formatVersion: z.literal(1),
    appVersion: z.string().min(1).max(32),
    exportedAt: timestamp,
    characterIds: z.array(idSchema).max(1000),
    bookIds: z.array(idSchema).max(1000),
  })
  .strict();

export type BlobRecord = z.infer<typeof BlobRecordSchema>;
export type Drawing = z.infer<typeof DrawingSchema>;
export type CharacterRig = z.infer<typeof CharacterRigSchema>;
export type Character = z.infer<typeof CharacterSchema>;
export type Book = z.infer<typeof BookSchema>;
export type Page = z.infer<typeof PageSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type MotionClip = z.infer<typeof MotionClipSchema>;
export type ExportManifest = z.infer<typeof ExportManifestSchema>;
