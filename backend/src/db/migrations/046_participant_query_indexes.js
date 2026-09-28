export const version = 46;
export const description = 'Automated database index optimization for participant queries (#1269)';

/**
 * Adds composite and single-column indexes to optimize participant query performance.
 * Covers common query patterns:
 * - Participants by campaign (filtering, aggregation)
 * - Participants by registration date (time-range queries)
 * - Combined queries on campaign + registration time (analytics, reporting)
 * - Covering indexes for full row retrieval without table lookups
 */
export function up(db) {
  db.exec(`
    -- Optimize filtering/aggregation queries by campaign
    CREATE INDEX IF NOT EXISTS idx_participants_campaign_asc
      ON participants(campaign_id ASC);

    -- Optimize time-range queries (recently registered participants)
    CREATE INDEX IF NOT EXISTS idx_participants_registered_at
      ON participants(registered_at DESC);

    -- Composite index for campaign + time range (common reporting query)
    CREATE INDEX IF NOT EXISTS idx_participants_campaign_registered
      ON participants(campaign_id, registered_at DESC);

    -- Covering index: campaign + user + registration time (full row read optimization)
    CREATE INDEX IF NOT EXISTS idx_participants_campaign_user_time
      ON participants(campaign_id, user, registered_at DESC);

    -- Optimize user-centric queries (find all campaigns a user is in)
    CREATE INDEX IF NOT EXISTS idx_participants_user
      ON participants(user, campaign_id);
  `);
}

export function down(db) {
  db.exec(`
    DROP INDEX IF EXISTS idx_participants_campaign_asc;
    DROP INDEX IF EXISTS idx_participants_registered_at;
    DROP INDEX IF EXISTS idx_participants_campaign_registered;
    DROP INDEX IF EXISTS idx_participants_campaign_user_time;
    DROP INDEX IF EXISTS idx_participants_user;
  `);
}
