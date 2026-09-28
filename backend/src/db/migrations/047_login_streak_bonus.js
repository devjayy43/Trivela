export const version = 47;
export const description = 'Daily Login Streak Bonus system with exponential point multipliers (#1276)';

/**
 * Tracks login streaks per user with exponential multiplier bonuses.
 * - login_streaks: primary table tracking current streak state
 * - streak_records: historical log of streak changes and bonus rewards
 */
export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS login_streaks (
      user              TEXT PRIMARY KEY,
      current_streak    INTEGER NOT NULL DEFAULT 0,
      max_streak        INTEGER NOT NULL DEFAULT 0,
      last_login_date   TEXT NOT NULL DEFAULT (date('now')),
      multiplier        REAL NOT NULL DEFAULT 1.0,
      bonus_points      INTEGER NOT NULL DEFAULT 0,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS streak_records (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      user             TEXT NOT NULL,
      streak_day       INTEGER NOT NULL,
      multiplier       REAL NOT NULL,
      bonus_points     INTEGER NOT NULL,
      recorded_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_streak_records_user
      ON streak_records(user, recorded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_streak_records_date
      ON streak_records(recorded_at);
  `);
}

export function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS streak_records;
    DROP TABLE IF EXISTS login_streaks;
  `);
}
