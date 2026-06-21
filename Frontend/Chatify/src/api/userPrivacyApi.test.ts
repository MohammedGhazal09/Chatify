import { beforeEach, describe, expect, it, vi } from 'vitest';

const axiosMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('./axios', () => ({
  default: axiosMock,
}));

import { userApi } from './userApi';

describe('userApi privacy controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds the privacy summary and account export routes', () => {
    userApi.getPrivacySummary();
    userApi.exportAccountData();

    expect(axiosMock.get).toHaveBeenCalledWith('/api/user/privacy/summary');
    expect(axiosMock.post).toHaveBeenCalledWith('/api/user/privacy/export', {});
  });

  it('builds reversible deletion request routes without payload identifiers', () => {
    userApi.requestAccountDeletion();
    userApi.cancelAccountDeletion();

    expect(axiosMock.post).toHaveBeenNthCalledWith(1, '/api/user/privacy/deletion-request', {});
    expect(axiosMock.post).toHaveBeenNthCalledWith(2, '/api/user/privacy/deletion-request/cancel', {});
    expect(JSON.stringify(axiosMock.post.mock.calls)).not.toContain('@');
  });
});
