import { beforeEach, describe, expect, it, vi } from 'vitest';

const axiosMock = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('./axios', () => ({
  default: axiosMock,
}));

import { deliveryHealthApi } from './deliveryHealthApi';

describe('deliveryHealthApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests admin delivery health with the selected diagnostic window', () => {
    deliveryHealthApi.getDeliveryHealth('7d');

    expect(axiosMock.get).toHaveBeenCalledWith('/api/admin/delivery-health', {
      params: { window: '7d' },
    });
  });

  it('defaults to the 24 hour diagnostic window', () => {
    deliveryHealthApi.getDeliveryHealth();

    expect(axiosMock.get).toHaveBeenCalledWith('/api/admin/delivery-health', {
      params: { window: '24h' },
    });
  });
});
