export type Data = Record<string, any>;
export interface Room extends Data {
  width?: number;
  depth?: number;
  height?: number;
}
export interface Support {
  id: string;
  surface: string;
  x: number;
  z: number;
  yaw: number;
}
export interface Item extends Data {
  id: string;
  kind: string;
  x: number;
  z: number;
  yaw: number;
  asset_id?: string;
  on?: Support;
}
export interface Asset extends Data {
  kind?: string;
  size: [number, number];
  height: number;
  elevation?: number;
  placement?: string;
  surfaces?: Record<string, Data>;
  interactions?: Record<string, Data>;
}
export interface State extends Data {
  revision: number;
  objects: Item[];
  character: Data;
  room?: Room;
  interaction?: Data;
  control_revisions?: Record<string, number>;
}
export interface Context {
  assets: Record<string, Asset>;
  catalog: Record<string, Asset>;
  wallpapers: Data;
  presets: Data;
  definitions: Record<string, [string, Data, string[]]>;
  defaultState: State;
}
export const record = (value: unknown): value is Data =>
  value !== null && typeof value === "object" && !Array.isArray(value);
export const clone = <T>(value: T): T => structuredClone(value);
export const length = (s: string) => [...s].length;
export function requireValue(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}
export function number(
  v: unknown,
  low: number,
  high: number,
  floatBounds = false,
): number {
  requireValue(
    typeof v === "number" && Number.isFinite(v) && v >= low && v <= high,
    `Expected finite number in [${floatBounds && Number.isInteger(low) ? low.toFixed(1) : low}, ${floatBounds && Number.isInteger(high) ? high.toFixed(1) : high}]`,
  );
  return v;
}
export function round(v: number, digits: number) {
  const f = 10 ** digits;
  return Math.round((v + Number.EPSILON) * f) / f;
}
export function same(a: unknown, b: unknown): boolean {
  return stable(a) === stable(b);
}
export function stable(value: any): string {
  return JSON.stringify(value, (_key, v) =>
    record(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );
}
export function extra(value: Data, allowed: Iterable<string>) {
  const keys = new Set(allowed);
  return Object.keys(value).some((k) => !keys.has(k));
}
