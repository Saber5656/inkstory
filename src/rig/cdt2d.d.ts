declare module 'cdt2d' {
  type Point = [number, number];
  type Edge = [number, number];
  type Options = { exterior?: boolean; infinity?: boolean };
  export default function cdt2d(
    points: readonly Point[],
    edges?: readonly Edge[],
    options?: Options,
  ): number[][];
}
