import { useEffect } from 'react';

export type SessionBroadcastType = 'logout' | 'auth-expired';

export interface SessionBroadcastPayload {
  type: SessionBroadcastType;
  reason: 'user' | 'refresh_failed' | 'remote';
  createdAt: string;
}

export const SESSION_BROADCAST_CHANNEL = 'chatify-session';
export const SESSION_BROADCAST_STORAGE_KEY = 'chatify_session_event';

type BroadcastChannelConstructor = typeof BroadcastChannel;

const getBroadcastChannelConstructor = (): BroadcastChannelConstructor | null => {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
    return null;
  }

  return window.BroadcastChannel;
};

export const createSessionBroadcastPayload = (
  type: SessionBroadcastType,
  reason: SessionBroadcastPayload['reason']
): SessionBroadcastPayload => ({
  type,
  reason,
  createdAt: new Date().toISOString(),
});

const isSessionBroadcastPayload = (value: unknown): value is SessionBroadcastPayload => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SessionBroadcastPayload>;
  return (
    (candidate.type === 'logout' || candidate.type === 'auth-expired') &&
    (candidate.reason === 'user' || candidate.reason === 'refresh_failed' || candidate.reason === 'remote') &&
    typeof candidate.createdAt === 'string'
  );
};

export const broadcastSessionEvent = (
  type: SessionBroadcastType,
  reason: SessionBroadcastPayload['reason'] = type === 'logout' ? 'user' : 'refresh_failed'
) => {
  if (typeof window === 'undefined') {
    return;
  }

  const payload = createSessionBroadcastPayload(type, reason);
  const BroadcastChannelApi = getBroadcastChannelConstructor();

  if (BroadcastChannelApi) {
    const channel = new BroadcastChannelApi(SESSION_BROADCAST_CHANNEL);
    channel.postMessage(payload);
    channel.close();
  }

  try {
    window.localStorage.setItem(SESSION_BROADCAST_STORAGE_KEY, JSON.stringify(payload));
    window.localStorage.removeItem(SESSION_BROADCAST_STORAGE_KEY);
  } catch {
    // BroadcastChannel is preferred; storage fallback is best effort only.
  }
};

export const useSessionBroadcast = (onSessionEvent: (payload: SessionBroadcastPayload) => void) => {
  useEffect(() => {
    const BroadcastChannelApi = getBroadcastChannelConstructor();
    const channel = BroadcastChannelApi ? new BroadcastChannelApi(SESSION_BROADCAST_CHANNEL) : null;

    const handlePayload = (payload: unknown) => {
      if (isSessionBroadcastPayload(payload)) {
        onSessionEvent(payload);
      }
    };

    if (channel) {
      channel.onmessage = (event) => handlePayload(event.data);
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== SESSION_BROADCAST_STORAGE_KEY || !event.newValue) {
        return;
      }

      try {
        handlePayload(JSON.parse(event.newValue) as unknown);
      } catch {
        // Ignore malformed cross-tab storage events.
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      channel?.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, [onSessionEvent]);
};
