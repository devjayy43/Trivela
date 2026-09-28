// @ts-check
import test from 'node:test';
import assert from 'node:assert';
import { validateGoogleToken, validateGithubToken } from './ssoService.js';

test('validateGoogleToken', async (t) => {
  const validClaims = {
    iss: 'https://accounts.google.com',
    aud: 'my-client-id',
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  await t.test('accepts valid Google token claims', () => {
    assert.strictEqual(validateGoogleToken(validClaims, 'my-client-id'), true);
  });

  await t.test('rejects invalid issuer', () => {
    const invalid = { ...validClaims, iss: 'https://evil.com' };
    assert.strictEqual(validateGoogleToken(invalid, 'my-client-id'), false);
  });

  await t.test('rejects mismatched audience', () => {
    const invalid = { ...validClaims, aud: 'other-client-id' };
    assert.strictEqual(validateGoogleToken(invalid, 'my-client-id'), false);
  });

  await t.test('rejects expired token', () => {
    const invalid = { ...validClaims, exp: Math.floor(Date.now() / 1000) - 1 };
    assert.strictEqual(validateGoogleToken(invalid, 'my-client-id'), false);
  });
});

test('validateGithubToken', async (t) => {
  const validResponse = {
    access_token: 'gho_1234567890',
    token_type: 'bearer',
    scope: 'user:email,read:user',
  };

  await t.test('accepts valid GitHub token response', () => {
    assert.strictEqual(validateGithubToken(validResponse), true);
  });

  await t.test('rejects missing access_token', () => {
    const invalid = { token_type: 'bearer', scope: 'user:email,read:user' };
    assert.strictEqual(validateGithubToken(invalid), false);
  });

  await t.test('rejects invalid token_type', () => {
    const invalid = { access_token: 'gho_123', token_type: 'basic', scope: 'user:email' };
    assert.strictEqual(validateGithubToken(invalid), false);
  });

  await t.test('rejects missing required scopes', () => {
    const invalid = { access_token: 'gho_123', token_type: 'bearer', scope: 'user:email' };
    assert.strictEqual(validateGithubToken(invalid), false);
  });
});
