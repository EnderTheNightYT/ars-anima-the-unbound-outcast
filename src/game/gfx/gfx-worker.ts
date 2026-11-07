// @ts-nocheck
/// <reference lib="webworker" />
/** Builds per-region LUT and environment probe off the main thread; buffers are returned as Transferables. */
import { buildLut, buildEnvMap } from './grading';
import { zoneGrade } from './zones';

export interface ZoneJob { id: number; region: string; lutSize: number; envW: number; envH: number; ceiling: number[]; fog: number[]; floor: number[]; lights: number[][] }
export interface ZoneResult { id: number; region: string; lut: Uint8Array; env: Uint8Array }

export function buildZone(job: ZoneJob): ZoneResult {
  return { id: job.id, region: job.region, lut: buildLut(job.lutSize, zoneGrade(job.region)), env: buildEnvMap(job.envW, job.envH, job.ceiling, job.fog, job.floor, job.lights) };
}

if (typeof self !== 'undefined' && typeof (self as unknown as { importScripts?: unknown }).importScripts === 'function') {
  self.onmessage = (e: MessageEvent<ZoneJob>) => {
    const r = buildZone(e.data);
    (self as unknown as Worker).postMessage(r, [r.lut.buffer, r.env.buffer]);
  };
}
