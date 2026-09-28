export const version = 48;
export const description = 'Single Sign-On (SSO) integration for operators with Google and GitHub (#1270)';

/**
 * Adds OAuth/OIDC provider support for operator authentication.
 * - operator_oauth_providers: maps operators to their OAuth provider accounts
 * - oauth_tokens: stores encrypted refresh tokens for token refresh flow
 *
 * Supports Google OAuth 2.0 and GitHub OAuth 2.0 with standard validation.
 */
export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS operator_oauth_providers (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      operator_id      TEXT NOT NULL,
      provider         TEXT NOT NULL CHECK (provider IN ('google', 'github')),
      provider_user_id TEXT NOT NULL,
      email            TEXT NOT NULL,
      name             TEXT,
      avatar_url       TEXT,
      verified         INTEGER NOT NULL DEFAULT 1,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(operator_id, provider),
      UNIQUE(provider, provider_user_id)
    );

    CREATE TABLE IF NOT EXISTS oauth_tokens (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      oauth_provider_id INTEGER NOT NULL,
      refresh_token    TEXT,
      token_expires_at TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (oauth_provider_id) REFERENCES operator_oauth_providers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_oauth_providers_operator
      ON operator_oauth_providers(operator_id);
    CREATE INDEX IF NOT EXISTS idx_oauth_providers_email
      ON operator_oauth_providers(email);
    CREATE INDEX IF NOT EXISTS idx_oauth_tokens_provider
      ON oauth_tokens(oauth_provider_id);
  `);
}

export function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS oauth_tokens;
    DROP TABLE IF EXISTS operator_oauth_providers;
  `);
}
