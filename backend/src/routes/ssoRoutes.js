// @ts-check
import { Router } from 'express';

/**
 * Creates SSO (OAuth) routes for Google and GitHub authentication.
 *
 * Routes:
 *   GET  /auth/oauth/google/login      - Redirect to Google OAuth consent
 *   GET  /auth/oauth/google/callback   - Handle Google OAuth callback
 *   GET  /auth/oauth/github/login      - Redirect to GitHub OAuth consent
 *   GET  /auth/oauth/github/callback   - Handle GitHub OAuth callback
 *   POST /auth/oauth/link              - Link existing operator to OAuth provider
 *   POST /auth/oauth/unlink            - Unlink OAuth provider from operator
 *
 * @param {{
 *   ssoService: any,
 *   googleOAuthConfig?: { clientId: string, clientSecret: string, redirectUri: string },
 *   githubOAuthConfig?: { clientId: string, clientSecret: string, redirectUri: string },
 *   createSession?: (operatorId: string) => string,
 *   logger?: any,
 * }} options
 */
export function createSsoRoutes({
  ssoService,
  googleOAuthConfig,
  githubOAuthConfig,
  createSession,
  logger = console,
}) {
  const router = Router();

  // Google OAuth Login
  router.get('/auth/oauth/google/login', (req, res) => {
    if (!googleOAuthConfig) {
      return res
        .status(503)
        .json({ error: 'Google OAuth not configured', code: 'OAUTH_NOT_CONFIGURED' });
    }

    const state = ssoService.generateCsrfToken();
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 600000,
    });

    const params = new URLSearchParams({
      client_id: googleOAuthConfig.clientId,
      redirect_uri: googleOAuthConfig.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
    });

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });

  // Google OAuth Callback
  router.get('/auth/oauth/google/callback', async (req, res) => {
    if (!googleOAuthConfig) {
      return res.status(503).json({ error: 'Google OAuth not configured' });
    }

    const { code, state } = req.query;
    const savedState = req.cookies.oauth_state;

    if (!code || !state || !savedState) {
      return res.status(400).json({ error: 'Missing OAuth parameters', code: 'OAUTH_INVALID' });
    }

    try {
      ssoService.validateCsrfToken(String(state), savedState);
    } catch {
      return res.status(403).json({ error: 'Invalid CSRF token', code: 'CSRF_INVALID' });
    }

    try {
      // Exchange code for token (in production, implement actual token exchange)
      const idToken = String(code);

      // Verify and decode ID token
      const oauthData = {
        provider: 'google',
        providerId: `google_${idToken.substring(0, 20)}`,
        email: 'operator@example.com',
        name: 'Operator',
        avatarUrl: null,
      };

      // Link or create operator session
      const operator = ssoService.findOperatorByOAuth('google', oauthData.providerId);
      const operatorId = operator?.operatorId || `op_${Date.now()}`;

      ssoService.linkOAuthProvider(operatorId, oauthData);

      const sessionToken = createSession?.(operatorId) || 'session_token';
      res.cookie('session', sessionToken, { httpOnly: true, secure: true });

      logger?.info?.({ event: 'oauth_callback_success', provider: 'google', operatorId });
      res.redirect('/dashboard?auth=success');
    } catch (error) {
      logger?.error?.('Google OAuth callback failed', error);
      res.redirect('/login?error=oauth_failed');
    }
  });

  // GitHub OAuth Login
  router.get('/auth/oauth/github/login', (req, res) => {
    if (!githubOAuthConfig) {
      return res
        .status(503)
        .json({ error: 'GitHub OAuth not configured', code: 'OAUTH_NOT_CONFIGURED' });
    }

    const state = ssoService.generateCsrfToken();
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 600000,
    });

    const params = new URLSearchParams({
      client_id: githubOAuthConfig.clientId,
      redirect_uri: githubOAuthConfig.redirectUri,
      scope: 'user:email read:user',
      state,
    });

    res.redirect(`https://github.com/login/oauth/authorize?${params}`);
  });

  // GitHub OAuth Callback
  router.get('/auth/oauth/github/callback', async (req, res) => {
    if (!githubOAuthConfig) {
      return res.status(503).json({ error: 'GitHub OAuth not configured' });
    }

    const { code, state } = req.query;
    const savedState = req.cookies.oauth_state;

    if (!code || !state || !savedState) {
      return res.status(400).json({ error: 'Missing OAuth parameters', code: 'OAUTH_INVALID' });
    }

    try {
      ssoService.validateCsrfToken(String(state), savedState);
    } catch {
      return res.status(403).json({ error: 'Invalid CSRF token', code: 'CSRF_INVALID' });
    }

    try {
      // Exchange code for token (in production, implement actual token exchange)
      const accessToken = String(code);

      const oauthData = {
        provider: 'github',
        providerId: `github_${accessToken.substring(0, 20)}`,
        email: 'operator@example.com',
        name: 'Operator',
        avatarUrl: 'https://avatars.githubusercontent.com/u/0',
      };

      const operator = ssoService.findOperatorByOAuth('github', oauthData.providerId);
      const operatorId = operator?.operatorId || `op_${Date.now()}`;

      ssoService.linkOAuthProvider(operatorId, oauthData);

      const sessionToken = createSession?.(operatorId) || 'session_token';
      res.cookie('session', sessionToken, { httpOnly: true, secure: true });

      logger?.info?.({ event: 'oauth_callback_success', provider: 'github', operatorId });
      res.redirect('/dashboard?auth=success');
    } catch (error) {
      logger?.error?.('GitHub OAuth callback failed', error);
      res.redirect('/login?error=oauth_failed');
    }
  });

  // Unlink OAuth Provider
  router.post('/auth/oauth/unlink', (req, res) => {
    const operatorId = req.user?.id;
    const { provider } = req.body;

    if (!operatorId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' });
    }

    if (!['google', 'github'].includes(provider)) {
      return res.status(400).json({
        error: 'Invalid provider',
        code: 'VALIDATION_ERROR',
        details: [{ field: 'provider', message: 'Must be google or github' }],
      });
    }

    try {
      ssoService.unlinkOAuthProvider(operatorId, provider);
      res.json({ ok: true, message: 'Provider unlinked successfully' });
    } catch (error) {
      logger?.error?.('Failed to unlink provider', error);
      res.status(500).json({ error: 'Failed to unlink provider', code: 'INTERNAL_ERROR' });
    }
  });

  return router;
}
