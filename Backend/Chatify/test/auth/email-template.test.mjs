import { describe, expect, it, vi } from 'vitest';
import { HTMLTemplate } from '../../Utils/emailmsg.mjs';

describe('password reset email template', () => {
  it('uses the current year and renders the reset code', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-28T00:00:00Z'));

    try {
      const html = HTMLTemplate('123456');

      expect(html).toContain('123456');
      expect(html).toContain('&copy; 2026 Chatify');
      expect(html).toContain('This code expires in 5 minutes');
      expect(html).toContain('#000000');
      expect(html).toContain('#111827');
      expect(html).toContain('#00FF00');
      expect(html).toContain('#4ade80');
      expect(html).not.toContain('2025 Chatify');
      expect(html).not.toContain('#2563eb');
      expect(html).not.toContain('#2CB7A7');
    } finally {
      vi.useRealTimers();
    }
  });
});
