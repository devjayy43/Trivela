// @ts-check
import test from 'node:test';
import assert from 'node:assert';
import { calculateStreakMultiplier, calculateBonusPoints } from './loginStreakService.js';

test('calculateStreakMultiplier', async (t) => {
  await t.test('day 1 returns base multiplier 1.0', () => {
    assert.strictEqual(calculateStreakMultiplier(1), 1.0);
  });

  await t.test('day 5 returns 1.2x', () => {
    assert.strictEqual(calculateStreakMultiplier(5), 1.2);
  });

  await t.test('day 10 returns 1.45x', () => {
    assert.strictEqual(calculateStreakMultiplier(10), 1.45);
  });

  await t.test('day 21 returns capped 2.0x', () => {
    assert.strictEqual(calculateStreakMultiplier(21), 2.0);
  });

  await t.test('day 30 returns capped 2.0x', () => {
    assert.strictEqual(calculateStreakMultiplier(30), 2.0);
  });

  await t.test('day 0 or negative returns base 1.0', () => {
    assert.strictEqual(calculateStreakMultiplier(0), 1.0);
    assert.strictEqual(calculateStreakMultiplier(-1), 1.0);
  });
});

test('calculateBonusPoints', async (t) => {
  await t.test('base reward with 1.0x multiplier', () => {
    assert.strictEqual(calculateBonusPoints(100, 1.0), 100);
  });

  await t.test('base reward with 1.5x multiplier', () => {
    assert.strictEqual(calculateBonusPoints(100, 1.5), 150);
  });

  await t.test('rounds down fractional points', () => {
    assert.strictEqual(calculateBonusPoints(100, 1.3), 130);
    assert.strictEqual(calculateBonusPoints(100, 1.33), 133);
  });

  await t.test('2.0x multiplier doubles points', () => {
    assert.strictEqual(calculateBonusPoints(50, 2.0), 100);
  });
});
