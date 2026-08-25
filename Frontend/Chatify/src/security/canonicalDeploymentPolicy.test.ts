import { describe, expect, it } from 'vitest';

import deploymentConfig from '../../vercel.json?raw';

describe('canonical deployment origin policy', () => {
  it('does not hard-code one backend deployment into generic browser policy', () => {
    const vercel = JSON.parse(deploymentConfig) as {
      rewrites?: Array<{ source: string; destination: string }>;
    };
    const serialized = JSON.stringify(vercel);

    expect(serialized).not.toContain('chatify-ckmn.onrender.com');
    expect(vercel.rewrites ?? []).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ destination: expect.stringMatching(/^https?:\/\//) }),
      ])
    );
  });
});
