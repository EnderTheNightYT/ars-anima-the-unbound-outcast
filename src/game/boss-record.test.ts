import { beforeEach, expect, it } from 'vitest';
import { bossRecords, readStats, recordBoss, mergeStats } from './statistics';
import { collectSave, applySave } from './cloud-save';
beforeEach(() => localStorage.clear());
it('preserves boss time, damage and difficulty across cloud restore without duplicates', () => {
  const record = { floor: 1, difficulty: 'pesadilla', seconds: 82.5, damage: 12, score: 600 };
  recordBoss('run', record); recordBoss('run', record);
  const first = readStats(), snapshot = collectSave(localStorage);
  localStorage.clear(); applySave(localStorage, snapshot);
  expect(bossRecords(mergeStats(first, readStats()))).toEqual([record]);
});