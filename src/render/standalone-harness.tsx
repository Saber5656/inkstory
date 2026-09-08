import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatedStage } from './AnimatedStage';
import './standalone-harness.css';

const jointNames = [
  'root',
  'hip',
  'torso',
  'neck',
  'right_shoulder',
  'right_elbow',
  'right_hand',
  'left_shoulder',
  'left_elbow',
  'left_hand',
  'right_hip',
  'right_knee',
  'right_foot',
  'left_hip',
  'left_knee',
  'left_foot',
] as const;
const joints = Object.fromEntries(
  jointNames.map((name, index) => [
    name,
    [(index % 4) / 3, Math.floor(index / 4) / 3] as [number, number],
  ]),
) as Record<(typeof jointNames)[number], [number, number]>;
const rig = {
  schemaVersion: 1 as const,
  joints,
  mesh: {
    vertices: [-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5],
    triangles: [0, 1, 2, 0, 2, 3],
  },
  weights: [
    [{ boneIndex: 0, w: 1 }],
    [{ boneIndex: 4, w: 1 }],
    [{ boneIndex: 10, w: 1 }],
    [{ boneIndex: 13, w: 1 }],
  ],
  meshMethod: 'grid' as const,
  textureSize: [2, 2] as [number, number],
};
const character = {
  textureUrl:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+H7bXAAAAAElFTkSuQmCC',
  rig,
  rigType: 'humanoid' as const,
};

function Harness() {
  const [motionId, setMotionId] = useState('wave');
  const [width, setWidth] = useState(480);
  Object.assign(window, {
    __inkstoryHarness: { setMotion: setMotionId, resize: setWidth },
  });
  return (
    <div>
      <p id="harness-status">ready:{motionId}</p>
      <button type="button" onClick={() => setMotionId('jump')}>
        jump
      </button>
      <div
        id="stage-host"
        className={width === 480 ? 'stage-default' : 'stage-wide'}
      >
        <AnimatedStage
          character={character}
          motionId={motionId}
          effectIds={['sparkles']}
          backgroundId="meadow"
        />
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<Harness />);
Object.assign(window, { __inkstoryUnmount: () => root.unmount() });
