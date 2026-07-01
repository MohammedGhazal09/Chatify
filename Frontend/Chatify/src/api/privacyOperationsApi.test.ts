import { beforeEach, describe, expect, it, vi } from 'vitest';

const axiosMock = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('./axios', () => ({
  default: axiosMock,
}));

import { privacyOperationsApi } from './privacyOperationsApi';

describe('privacyOperationsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests admin privacy operation diagnostics', () => {
    privacyOperationsApi.getPrivacyOperations();

    expect(axiosMock.get).toHaveBeenCalledWith('/api/admin/privacy-operations');
  });
});
