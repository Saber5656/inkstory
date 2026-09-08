import { describe, expect, it } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';

import {
  BlobRecordSchema,
  BookSchema,
  CharacterRigSchema,
  CharacterSchema,
  DrawingSchema,
  ExportManifestSchema,
  MotionClipSchema,
  PageSchema,
  SettingsSchema,
  parseOrThrow,
} from './index';
import { BONE_IDS, JOINT_NAMES } from './skeleton';

const id = '00000000-0000-4000-8000-000000000001';
const tuple = (x: number, y: number): [number, number] => [x, y];

const rig = () => ({
  schemaVersion: 1 as const,
  joints: Object.fromEntries(
    JOINT_NAMES.map((name, index) => [name, tuple(index, index)]),
  ),
  mesh: {
    vertices: [0, 0, 1, 1],
    triangles: [0, 1, 0],
  },
  weights: [[{ boneIndex: 0, w: 1 }], [{ boneIndex: 0, w: 1 }]],
  meshMethod: 'grid' as const,
  textureSize: tuple(2, 2),
});

const clip = () => ({
  schemaVersion: 1 as const,
  id: 'wave',
  name: { ja: 'てをふる', en: 'Wave' },
  keywords: { ja: ['バイバイ'], en: ['bye'] },
  category: 'greeting' as const,
  fps: 30 as const,
  frameCount: 2,
  loop: true,
  rootTranslation: [tuple(0, 0), tuple(0.1, 0)],
  restAngles: Object.fromEntries(BONE_IDS.map((bone) => [bone, 0])),
  frames: Object.fromEntries(BONE_IDS.map((bone) => [bone, [0, 10]])),
});

describe('domain schemas', () => {
  it('accepts valid entities and rejects unknown keys', () => {
    const drawing = DrawingSchema.parse({
      id,
      createdAt: 1,
      source: 'file',
      imageBlobId: id,
      width: 2,
      height: 2,
    });
    expect(drawing.id).toBe(id);
    expect(() => DrawingSchema.parse({ ...drawing, extra: true })).toThrow();

    const character = CharacterSchema.parse({
      id,
      name: 'Momo',
      createdAt: 1,
      updatedAt: 1,
      rigType: 'humanoid',
      drawingId: id,
      textureBlobId: id,
      thumbBlobId: id,
      rig: rig(),
      effectPrefs: {},
    });
    expect(character.rig?.schemaVersion).toBe(1);
    expect(() =>
      CharacterSchema.parse({ ...character, name: 'x'.repeat(51) }),
    ).toThrow();
    expect(() =>
      CharacterRigSchema.parse({
        ...rig(),
        joints: { ...rig().joints, extra: [0, 0] },
      }),
    ).toThrow();
  });

  it('enforces bounded motion tracks and triangle references', () => {
    expect(MotionClipSchema.parse(clip()).frameCount).toBe(2);
    expect(() =>
      MotionClipSchema.parse({ ...clip(), frameCount: 1 }),
    ).toThrow();
    expect(() =>
      MotionClipSchema.parse({
        ...clip(),
        frames: { ...clip().frames, torso: [0] },
      }),
    ).toThrow();
    expect(() =>
      CharacterRigSchema.parse({
        ...rig(),
        mesh: { ...rig().mesh, triangles: [0, 1, 9] },
      }),
    ).toThrow();
    expect(() =>
      CharacterRigSchema.parse({
        ...rig(),
        mesh: { ...rig().mesh, triangles: [0, 1, 0.5] },
      }),
    ).toThrow();
    expect(
      CharacterRigSchema.parse({
        ...rig(),
        mesh: { ...rig().mesh, uvs: [0, 0, 1, 1] },
      }).mesh.uvs,
    ).toEqual([0, 0, 1, 1]);
    expect(() =>
      CharacterRigSchema.parse({
        ...rig(),
        mesh: { ...rig().mesh, uvs: [0, 0] },
      }),
    ).toThrow(/uvs length/);
  });

  it('validates all entity boundaries, including Blob and bundle manifest', () => {
    const data = new NodeBlob(['drawing'], { type: 'image/png' });
    expect(
      BlobRecordSchema.parse({
        id,
        mime: 'image/png',
        data,
        size: data.size,
        createdAt: 1,
      }).size,
    ).toBe(data.size);
    expect(
      BookSchema.parse({
        id,
        title: 'Story',
        createdAt: 1,
        updatedAt: 1,
        pageOrder: [id],
      }).pageOrder,
    ).toEqual([id]);
    expect(
      PageSchema.parse({
        id,
        bookId: id,
        backgroundId: 'plain_cream',
        text: '',
        effectIds: [],
        advance: 'tap',
        createdAt: 1,
        updatedAt: 1,
      }).bookId,
    ).toBe(id);
    expect(SettingsSchema.parse({ key: 'locale', value: 'ja' }).value).toBe(
      'ja',
    );
    expect(
      ExportManifestSchema.parse({
        formatVersion: 1,
        appVersion: '0.1.0',
        exportedAt: 1,
        characterIds: [id],
        bookIds: [],
      }).formatVersion,
    ).toBe(1);
    expect(() =>
      parseOrThrow(DrawingSchema, { id, createdAt: Number.NaN }, 'drawing'),
    ).toThrow(/drawing/);
  });
});
