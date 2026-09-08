import { z } from 'zod';

import { CharacterRigSchema, ExportManifestSchema } from '../domain/schemas';
import { idSchema } from '../domain/ids';

const localizedEffects = z
  .object({
    effectIds: z
      .array(z.string().regex(/^[a-z0-9_]{1,32}$/))
      .max(3)
      .optional(),
    intensity: z.number().finite().min(0).max(1).optional(),
    seed: z.number().finite().int().optional(),
    reducedMotion: z.boolean().optional(),
  })
  .strict();

export const PortableCharacterSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(50),
    createdAt: z.number().finite().int().nonnegative(),
    updatedAt: z.number().finite().int().nonnegative(),
    rigType: z.enum(['humanoid', 'cutout']),
    rig: CharacterRigSchema.nullable(),
    effectPrefs: localizedEffects,
  })
  .strict();

export const PortablePageSchema = z
  .object({
    id: idSchema,
    characterId: idSchema.optional(),
    backgroundId: z.string().min(1).max(64),
    text: z.string().max(500),
    motionId: z
      .string()
      .regex(/^[a-z0-9_]{1,32}$/)
      .optional(),
    effectIds: z.array(z.string().regex(/^[a-z0-9_]{1,32}$/)).max(3),
    narrationMime: z.string().min(1).max(255).optional(),
    advance: z.enum(['tap', 'auto']),
    createdAt: z.number().finite().int().nonnegative(),
    updatedAt: z.number().finite().int().nonnegative(),
  })
  .strict();

export const PortableBookSchema = z
  .object({
    id: idSchema,
    title: z.string().min(1).max(100),
    createdAt: z.number().finite().int().nonnegative(),
    updatedAt: z.number().finite().int().nonnegative(),
    pages: z.array(PortablePageSchema).max(1000),
  })
  .strict();

export const BundleManifestSchema = ExportManifestSchema.superRefine(
  (manifest, ctx) => {
    if (new Set(manifest.characterIds).size !== manifest.characterIds.length)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['characterIds'],
        message: 'characterIds must be unique',
      });
    if (new Set(manifest.bookIds).size !== manifest.bookIds.length)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bookIds'],
        message: 'bookIds must be unique',
      });
  },
);
export type PortableCharacter = z.infer<typeof PortableCharacterSchema>;
export type PortablePage = z.infer<typeof PortablePageSchema>;
export type PortableBook = z.infer<typeof PortableBookSchema>;
export type BundleManifest = z.infer<typeof BundleManifestSchema>;

export const BUNDLE_PATH_RE =
  /^(manifest\.json|characters\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/(character\.json|texture\.png|thumb\.png)|books\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/(book\.json|audio\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.bin))$/;

export const MAX_BUNDLE_BYTES = 256 * 1024 * 1024;
export const MAX_ENTRIES = 1000;
export const MAX_ENTRY_BYTES = 64 * 1024 * 1024;
export const MAX_TOTAL_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
export const MAX_COMPRESSION_RATIO = 1000;

export function isAllowedBundlePath(path: string): boolean {
  return BUNDLE_PATH_RE.test(path);
}

export function parseJson<T extends z.ZodTypeAny>(
  schema: T,
  bytes: Uint8Array,
  path: string,
): z.infer<T> {
  try {
    return schema.parse(
      JSON.parse(new TextDecoder().decode(bytes)),
    ) as z.infer<T>;
  } catch (error) {
    throw new BundleValidationError(path, 'invalid JSON or schema', error);
  }
}

export class BundleValidationError extends Error {
  readonly path: string;
  readonly cause: unknown;
  constructor(path: string, message: string, cause?: unknown) {
    super(`${path}: ${message}`);
    this.name = 'BundleValidationError';
    this.path = path;
    this.cause = cause;
  }
}
