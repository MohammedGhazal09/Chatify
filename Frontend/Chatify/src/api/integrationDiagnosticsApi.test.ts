import { beforeEach, describe, expect, it, vi } from 'vitest';

const axiosMock = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('./axios', () => ({
  default: axiosMock,
}));

import { integrationDiagnosticsApi } from './integrationDiagnosticsApi';

describe('integrationDiagnosticsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests admin integration diagnostics', () => {
    integrationDiagnosticsApi.getIntegrationDiagnostics();

    expect(axiosMock.get).toHaveBeenCalledWith('/api/admin/integrations');
  });
});
