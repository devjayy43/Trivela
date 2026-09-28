// @ts-check
import crypto from 'node:crypto';

/**
 * Validates Google OAuth token response.
 * Performs defensive checks on issuer, audience, and expiration.
 *
 * @param {{ iss: string, aud: string, exp: number }} claims
 * @param {string} clientId
 * @returns {boolean}
 */
export function validateGoogleToken(claims, clientId) {
  const validIssuers = ['https://accounts.google.com', 'https://oauth.google.com'];
  const now = Math.floor(Date.now() / 1000);

  if (!validIssuers.includes(claims.iss)) return false;
  if (claims.aud !== clientId) return false;
  if (claims.exp <= now) return false;

  return true;
}

/**
 * Validates GitHub OAuth response.
 * Checks API response structure and token validity.
 *
 * @param {{ access_token: string, token_type: string, scope: string }} response
 * @returns {boolean}
 */
export function validateGithubToken(response) {
  if (!response.access_token || response.token_type !== 'bearer') {
    return false;
  }
  const requiredScopes = ['user:email', 'read:user'];
  const grantedScopes = (response.scope || '').split(',').map((s) => s.trim());
  return requiredScopes.every((s) => grantedScopes.includes(s));
}

/**
 * Creates an SSO service for managing OAuth provider authentication.
 *
 * @param {{ db: any, logger?: any }} options
 */
export function createSsoService({ db, logger = console }) {
  return {
    /**
     * Generates CSRF token for OAuth flow protection.
     *
     * @returns {string}
     */
    generateCsrfToken() {
      return crypto.randomBytes(32).toString('hex');
    },

    /**
     * Validates CSRF token (constant-time comparison).
     *
     * @param {string} token
     * @param {string} expected
     * @returns {boolean}
     */
    validateCsrfToken(token, expected) {
      return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
    },

    /**
     * Links an OAuth provider to an operator account.
     *
     * @param {string} operatorId
     * @param {{ provider: string, providerId: string, email: string, name?: string, avatarUrl?: string }} oauthData
     * @returns {{ id: number, operatorId: string, provider: string }}
     */
    linkOAuthProvider(operatorId, oauthData) {
      const { provider, providerId, email, name, avatarUrl } = oauthData;

      if (!['google', 'github'].includes(provider)) {
        throw new Error(`Invalid OAuth provider: ${provider}`);
      }

      const result = db
        .prepare(
          `INSERT OR REPLACE INTO operator_oauth_providers
           (operator_id, provider, provider_user_id, email, name, avatar_url)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(operatorId, provider, providerId, email, name || null, avatarUrl || null);

      logger?.info?.({
        event: 'oauth_provider_linked',
        operatorId,
        provider,
        email,
      });

      return {
        id: result.lastInsertRowid,
        operatorId,
        provider,
      };
    },

    /**
     * Gets OAuth provider for an operator.
     *
     * @param {string} operatorId
     * @param {string} provider - 'google' or 'github'
     * @returns {{ id: number, operatorId: string, email: string, verified: boolean } | null}
     */
    getOAuthProvider(operatorId, provider) {
      return db
        .prepare(
          `SELECT * FROM operator_oauth_providers
           WHERE operator_id = ? AND provider = ?`,
        )
        .get(operatorId, provider);
    },

    /**
     * Finds operator by OAuth provider and ID.
     *
     * @param {string} provider - 'google' or 'github'
     * @param {string} providerId
     * @returns {{ operatorId: string, email: string, name: string } | null}
     */
    findOperatorByOAuth(provider, providerId) {
      return db
        .prepare(
          `SELECT operator_id, email, name FROM operator_oauth_providers
           WHERE provider = ? AND provider_user_id = ?`,
        )
        .get(provider, providerId);
    },

    /**
     * Stores OAuth refresh token (for token refresh flow).
     *
     * @param {number} oauthProviderId
     * @param {string} refreshToken
     * @param {string} expiresAt - ISO datetime
     */
    storeRefreshToken(oauthProviderId, refreshToken, expiresAt) {
      db.prepare(
        `INSERT INTO oauth_tokens (oauth_provider_id, refresh_token, token_expires_at)
         VALUES (?, ?, ?)`,
      ).run(oauthProviderId, refreshToken, expiresAt);
    },

    /**
     * Gets stored refresh token for provider.
     *
     * @param {number} oauthProviderId
     * @returns {{ refreshToken: string, tokenExpiresAt: string } | null}
     */
    getRefreshToken(oauthProviderId) {
      const row = db
        .prepare(
          `SELECT refresh_token, token_expires_at FROM oauth_tokens
           WHERE oauth_provider_id = ?
           ORDER BY created_at DESC LIMIT 1`,
        )
        .get(oauthProviderId);

      if (!row) return null;

      return {
        refreshToken: row.refresh_token,
        tokenExpiresAt: row.token_expires_at,
      };
    },

    /**
     * Unlinks an OAuth provider from an operator.
     *
     * @param {string} operatorId
     * @param {string} provider
     */
    unlinkOAuthProvider(operatorId, provider) {
      db.prepare(
        `DELETE FROM operator_oauth_providers
         WHERE operator_id = ? AND provider = ?`,
      ).run(operatorId, provider);

      logger?.info?.({
        event: 'oauth_provider_unlinked',
        operatorId,
        provider,
      });
    },
  };
}
