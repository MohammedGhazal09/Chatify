import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SESSION_BROADCAST_CHANNEL,
  SESSION_BROADCAST_STORAGE_KEY,
  broadcastSessionEvent,
  createSessionBroadcastPayload,
  useSessionBroadcast,
} from './useSessionBroadcast';

type BroadcastMessage = { data: unknown };

class MockBroadcastChannel {
  static channels: MockBroadcastChannel[] = [];

  name: string;
  onmessage: ((event: BroadcastMessage) => void) | null = null;
  close = vi.fn(() => {
    MockBroadcastChannel.channels = MockBroadcastChannel.channels.filter((channel) => channel !== this);
  });

  constructor(name: string) {
    this.name = name;
    MockBroadcastChannel.channels.push(this);
  }

  postMessage(message: unknown) {
    MockBroadcastChannel.channels
      .filter((channel) => channel !== this && channel.name === this.name)
      .forEach((channel) => channel.onmessage?.({ data: message }));
  }
}

const originalBroadcastChannel = window.BroadcastChannel;

describe('useSessionBroadcast', () => {
  afterEach(() => {
    Object.defineProperty(window, 'BroadcastChannel', {
      configurable: true,
      value: originalBroadcastChannel,
    });
    MockBroadcastChannel.channels = [];
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('creates sanitized session payloads without account or message data', () => {
    const payload = createSessionBroadcastPayload('logout', 'user');

    expect(payload).toEqual({
      type: 'logout',
      reason: 'user',
      createdAt: expect.any(String),
    });
    expect(Object.keys(payload).sort()).toEqual(['createdAt', 'reason', 'type']);
  });

  it('delivers logout events through BroadcastChannel', () => {
    Object.defineProperty(window, 'BroadcastChannel', {
      configurable: true,
      value: MockBroadcastChannel,
    });
    const listener = vi.fn();

    renderHook(() => useSessionBroadcast(listener));
    broadcastSessionEvent('logout', 'user');

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      type: 'logout',
      reason: 'user',
    }));
    expect(MockBroadcastChannel.channels.every((channel) => channel.name === SESSION_BROADCAST_CHANNEL)).toBe(true);
  });

  it('falls back to storage events when BroadcastChannel is unavailable', () => {
    Object.defineProperty(window, 'BroadcastChannel', {
      configurable: true,
      value: undefined,
    });
    const listener = vi.fn();
    const payload = createSessionBroadcastPayload('auth-expired', 'refresh_failed');

    renderHook(() => useSessionBroadcast(listener));
    window.dispatchEvent(new StorageEvent('storage', {
      key: SESSION_BROADCAST_STORAGE_KEY,
      newValue: JSON.stringify(payload),
    }));

    expect(listener).toHaveBeenCalledWith(payload);
  });
});
