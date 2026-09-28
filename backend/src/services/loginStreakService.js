// @ts-check

/**
 * Calculates exponential multiplier based on streak day.
 * Formula: 1.0 + (streak_day - 1) * 0.05, with 2.0x cap at day 21+
 *
 * Examples:
 * - Day 1: 1.0x (base)
 * - Day 5: 1.2x
 * - Day 10: 1.45x
 * - Day 21+: 2.0x (capped)
 *
 * @param {number} streakDay
 * @returns {number} multiplier value
 */
export function calculateStreakMultiplier(streakDay) {
  if (streakDay <= 0) return 1.0;
  if (streakDay >= 21) return 2.0;
  return 1.0 + (streakDay - 1) * 0.05;
}

/**
 * Calculates bonus points based on base reward and streak multiplier.
 *
 * @param {number} baseReward - base points earned (e.g., from campaign action)
 * @param {number} multiplier - streak multiplier (from calculateStreakMultiplier)
 * @returns {number} bonus points (rounded down)
 */
export function calculateBonusPoints(baseReward, multiplier) {
  return Math.floor(baseReward * multiplier);
}

/**
 * Creates a login streak service for managing daily login tracking and bonuses.
 *
 * @param {{ db: any, logger?: any }} options
 */
export function createLoginStreakService({ db, logger = console }) {
  return {
    /**
     * Records a login for a user and updates their streak.
     * Returns the streak bonus points earned today.
     *
     * @param {string} userId
     * @param {number} baseRewardPoints - base reward for today's login (default 10)
     * @returns {{ streak: number, multiplier: number, bonusPoints: number, isNewStreak: boolean }}
     */
    recordLogin(userId, baseRewardPoints = 10) {
      const today = new Date().toISOString().split('T')[0];

      const existing = db
        .prepare('SELECT * FROM login_streaks WHERE user = ?')
        .get(userId);

      let streak = 0;
      let multiplier = 1.0;
      let isNewStreak = false;

      if (!existing) {
        isNewStreak = true;
        streak = 1;
        multiplier = calculateStreakMultiplier(1);

        db.prepare(
          `INSERT INTO login_streaks (user, current_streak, max_streak, last_login_date, multiplier)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(userId, 1, 1, today, multiplier);
      } else {
        const lastLoginDate = existing.last_login_date;
        const lastDate = new Date(lastLoginDate);
        const todayDate = new Date(today);
        const daysDiff = Math.floor(
          (todayDate - lastDate) / (1000 * 60 * 60 * 24),
        );

        if (daysDiff === 0) {
          // Already logged in today
          return {
            streak: existing.current_streak,
            multiplier: existing.multiplier,
            bonusPoints: 0,
            isNewStreak: false,
          };
        } else if (daysDiff === 1) {
          // Consecutive day
          streak = existing.current_streak + 1;
          multiplier = calculateStreakMultiplier(streak);

          const maxStreak = Math.max(existing.max_streak, streak);
          db.prepare(
            `UPDATE login_streaks
             SET current_streak = ?, max_streak = ?, last_login_date = ?, multiplier = ?
             WHERE user = ?`,
          ).run(streak, maxStreak, today, multiplier, userId);
        } else {
          // Streak broken, reset to 1
          isNewStreak = true;
          streak = 1;
          multiplier = calculateStreakMultiplier(1);

          db.prepare(
            `UPDATE login_streaks
             SET current_streak = ?, last_login_date = ?, multiplier = ?
             WHERE user = ?`,
          ).run(1, today, multiplier, userId);
        }
      }

      const bonusPoints = calculateBonusPoints(baseRewardPoints, multiplier);

      // Record in history
      db.prepare(
        `INSERT INTO streak_records (user, streak_day, multiplier, bonus_points)
         VALUES (?, ?, ?, ?)`,
      ).run(userId, streak, multiplier, bonusPoints);

      return {
        streak,
        multiplier,
        bonusPoints,
        isNewStreak,
      };
    },

    /**
     * Gets current streak information for a user.
     *
     * @param {string} userId
     * @returns {{ streak: number, maxStreak: number, multiplier: number, lastLoginDate: string } | null}
     */
    getStreak(userId) {
      const row = db
        .prepare('SELECT * FROM login_streaks WHERE user = ?')
        .get(userId);

      if (!row) return null;

      return {
        streak: row.current_streak,
        maxStreak: row.max_streak,
        multiplier: row.multiplier,
        lastLoginDate: row.last_login_date,
      };
    },

    /**
     * Gets streak history for a user.
     *
     * @param {string} userId
     * @param {number} limit
     * @returns {Array}
     */
    getStreakHistory(userId, limit = 30) {
      return db
        .prepare(
          `SELECT * FROM streak_records
           WHERE user = ?
           ORDER BY recorded_at DESC
           LIMIT ?`,
        )
        .all(userId, limit);
    },

    /**
     * Resets a user's streak (for testing or admin purposes).
     *
     * @param {string} userId
     */
    resetStreak(userId) {
      db.prepare('DELETE FROM login_streaks WHERE user = ?').run(userId);
      logger?.info?.(`Reset login streak for user ${userId}`);
    },
  };
}
