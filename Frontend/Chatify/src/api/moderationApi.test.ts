import { beforeEach, describe, expect, it, vi } from 'vitest';

const axiosMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}));

vi.mock('./axios', () => ({
  default: axiosMock,
}));

import { moderationApi } from './moderationApi';

describe('moderationApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds user appeal and own enforcement routes', () => {
    moderationApi.listMyEnforcements();
    moderationApi.submitAppeal('report-1', { reason: 'Please review' });

    expect(axiosMock.get).toHaveBeenCalledWith('/api/moderation/my-enforcements');
    expect(axiosMock.post).toHaveBeenCalledWith('/api/moderation/reports/report-1/appeal', {
      reason: 'Please review',
    });
  });

  it('builds reviewer assignment, metrics, history, and appeal review routes', () => {
    moderationApi.assignReport('report-1', { assignedTo: 'admin-2' });
    moderationApi.getOpsSummary();
    moderationApi.getEnforcementHistory('user-2');
    moderationApi.reviewAppeal('report-1', 'appeal-1', {
      status: 'accepted',
      reviewerNote: 'Accepted',
    });

    expect(axiosMock.patch).toHaveBeenNthCalledWith(1, '/api/moderation/reports/report-1/assign', {
      assignedTo: 'admin-2',
    });
    expect(axiosMock.get).toHaveBeenNthCalledWith(1, '/api/moderation/ops-summary');
    expect(axiosMock.get).toHaveBeenNthCalledWith(2, '/api/moderation/users/user-2/enforcement-history');
    expect(axiosMock.patch).toHaveBeenNthCalledWith(2, '/api/moderation/reports/report-1/appeals/appeal-1', {
      status: 'accepted',
      reviewerNote: 'Accepted',
    });
    expect(JSON.stringify(axiosMock.patch.mock.calls)).not.toContain('@example.test');
  });
});
