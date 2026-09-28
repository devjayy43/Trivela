// @ts-check

/**
 * Middleware that applies login streak bonuses to user reward calculations.
 * Intercepts reward events and multiplies points based on user's current streak.
 *
 * Attaches `req.streakBonus` with multiplier and bonus info for downstream handlers.
 *
 * @param {{ streakService: any, logger?: any }} options
 */
export function createLoginStreakBonusMiddleware({ streakService, logger = console }) {
  return (req, res, next) => {
    const userId = req.user?.id || req.query.user || req.body?.user;

    if (!userId) {
      req.streakBonus = { multiplier: 1.0, bonusPoints: 0, streakDay: 0 };
      return next();
    }

    try {
      const loginResult = streakService.recordLogin(userId, 10);

      // Attach to request for handler use
      req.streakBonus = {
        multiplier: loginResult.multiplier,
        bonusPoints: loginResult.bonusPoints,
        streakDay: loginResult.streak,
        isNewStreak: loginResult.isNewStreak,
      };

      if (loginResult.bonusPoints > 0) {
        logger?.debug?.({
          event: 'login_streak_bonus',
          userId,
          streak: loginResult.streak,
          multiplier: loginResult.multiplier,
          bonus: loginResult.bonusPoints,
        });
      }
    } catch (error) {
      logger?.error?.('Failed to process login streak', error);
      req.streakBonus = { multiplier: 1.0, bonusPoints: 0, streakDay: 0 };
    }

    next();
  };
}

/**
 * Helper to apply streak multiplier to a base reward amount.
 *
 * @param {number} baseReward
 * @param {{ multiplier: number, bonusPoints: number }} streakBonus
 * @returns {number} total reward with streak multiplier applied
 */
export function applyStreakMultiplier(baseReward, streakBonus) {
  return baseReward * streakBonus.multiplier;
}
