export const steps = [
  'capture',
  'crop',
  'mask',
  'rigType',
  'joints',
  'preview',
  'saved',
] as const;
export type Step = (typeof steps)[number];
export function nextStep(step: Step, type: 'humanoid' | 'cutout'): Step {
  const flow = steps.filter((s) => type !== 'cutout' || s !== 'joints');
  return flow[Math.min(flow.indexOf(step) + 1, flow.length - 1)] ?? 'capture';
}
export function previousStep(step: Step, type: 'humanoid' | 'cutout'): Step {
  const flow = steps.filter((s) => type !== 'cutout' || s !== 'joints');
  return flow[Math.max(flow.indexOf(step) - 1, 0)] ?? 'capture';
}
