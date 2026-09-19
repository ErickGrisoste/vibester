import { vi } from 'vitest';
import { FastifyRequest } from 'fastify';
import { logAuthFailure, maskSubject } from '../../src/observability/auth-audit';

const makeRequest = () =>
  ({ log: { warn: vi.fn() }, ip: '203.0.113.10' }) as unknown as FastifyRequest;

describe('auth-audit', () => {
  describe('maskSubject', () => {
    it('should keep only the first letter of the email local part', () => {
      expect(maskSubject('joao.silva@email.com')).toBe('j***@email.com');
    });

    it('should mask a username that is not an email', () => {
      expect(maskSubject('joaosilva')).toBe('j***');
    });

    it('should not crash on missing or malformed input', () => {
      expect(maskSubject(undefined)).toBe('unknown');
      expect(maskSubject('@email.com')).toBe('@***');
    });
  });

  describe('logAuthFailure', () => {
    it('should log as warn, not error — 401/422 are expected client outcomes', () => {
      const request = makeRequest();

      logAuthFailure(request, 'login', 'invalid_password', 'joao@email.com');

      expect(request.log.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'auth.login.failed',
          reason: 'invalid_password',
          ip: '203.0.113.10',
        }),
        expect.any(String),
      );
    });

    it('should never put the raw identifier in the log', () => {
      const request = makeRequest();

      logAuthFailure(request, 'verify-email', 'code_mismatch', 'joao@email.com');

      const [payload] = vi.mocked(request.log.warn).mock.calls[0];
      expect(JSON.stringify(payload)).not.toContain('joao@email.com');
      expect((payload as { subject: string }).subject).toBe('j***@email.com');
    });
  });
});
