import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeChat, makeUser } from '../test/chatFixtures';
import type { CallActionAck, CallMode, CallSessionPayload, ConversationControls } from '../types/chat';
import { useCallController, type CallSocketActions } from './useCallController';

const conversationControls: ConversationControls = {
  isDirectChat: true,
  peerId: 'user-2',
  canSendMessage: true,
  canBlockUser: true,
  canUnblockUser: false,
  blockedByMe: false,
  blockedMe: false,
  messagingDisabledReason: null,
};

const makeCallSession = (overrides: Partial<CallSessionPayload> = {}): CallSessionPayload => ({
  callId: 'call-1',
  chatId: 'chat-1',
  callerId: 'user-1',
  calleeId: 'user-2',
  mode: 'audio',
  status: 'ringing',
  startedAt: '2026-06-13T10:00:00.000Z',
  ringingAt: '2026-06-13T10:00:01.000Z',
  deliveredTo: ['user-2'],
  ...overrides,
});

const makeAck = (event: CallActionAck['event'], mode: CallMode = 'audio'): CallActionAck => ({
  ok: true,
  event,
  ...makeCallSession({ mode }),
});

const makeActions = (): CallSocketActions => ({
  emitCallStart: vi.fn(async ({ mode }) => makeAck('call:start', mode)),
  emitCallAccept: vi.fn(async () => makeAck('call:accept')),
  emitCallReject: vi.fn(async (): Promise<CallActionAck> => ({ ok: true, event: 'call:reject' })),
  emitCallEnd: vi.fn(async (): Promise<CallActionAck> => ({ ok: true, event: 'call:end' })),
  emitCallSync: vi.fn(async (): Promise<CallActionAck> => ({ ok: true, event: 'call:sync', call: null })),
  emitCallOffer: vi.fn(async (): Promise<CallActionAck> => ({ ok: true, event: 'call:offer' })),
  emitCallAnswer: vi.fn(async (): Promise<CallActionAck> => ({ ok: true, event: 'call:answer' })),
  emitCallIceCandidate: vi.fn(async (): Promise<CallActionAck> => ({ ok: true, event: 'call:ice-candidate' })),
});

const renderController = (overrides: Partial<Parameters<typeof useCallController>[0]> = {}) => {
  const chat = makeChat({ conversationControls });
  const peer = makeUser({ _id: 'user-2', firstName: 'Grace', lastName: 'Hopper' });
  const actions = makeActions();
  const props = {
    selectedChat: chat,
    currentUserId: 'user-1',
    otherMember: peer,
    otherMemberStatus: { userId: 'user-2', isOnline: true },
    conversationControls,
    isAuthenticated: true,
    isSocketConnected: true,
    callConfig: { iceServers: [], turnReady: false, productionReady: false },
    socketActions: actions,
    ...overrides,
  };

  const result = renderHook((props: Parameters<typeof useCallController>[0]) => useCallController(props), {
    initialProps: props,
  });

  return { ...result, actions, chat, peer, props };
};

describe('useCallController', () => {
  beforeEach(() => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockClear();
  });

  it('uses the same online requirement reason for unavailable audio and video calls', () => {
    const { result } = renderController({
      otherMemberStatus: { userId: 'user-2', isOnline: false },
    });

    expect(result.current.audioAvailability).toEqual({
      available: false,
      reason: 'Both users must be online to call.',
    });
    expect(result.current.videoAvailability).toEqual({
      available: false,
      reason: 'Both users must be online to call.',
    });
  });

  it('uses the online requirement reason when the realtime session is disconnected', () => {
    const { result } = renderController({
      isSocketConnected: false,
    });

    expect(result.current.audioAvailability).toEqual({
      available: false,
      reason: 'Both users must be online to call.',
    });
    expect(result.current.videoAvailability).toEqual({
      available: false,
      reason: 'Both users must be online to call.',
    });
  });

  it('requests microphone access before starting an audio call', async () => {
    const getUserMedia = vi.mocked(navigator.mediaDevices.getUserMedia);
    const { result, actions } = renderController();

    await act(async () => {
      await result.current.startCall('audio');
    });

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
    expect(actions.emitCallStart).toHaveBeenCalledWith({ chatId: 'chat-1', mode: 'audio' });
    expect(getUserMedia.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(actions.emitCallStart).mock.invocationCallOrder[0]
    );
    expect(result.current.state.status).toBe('outgoing');
  });

  it('falls back to audio when camera capture fails before the call is started', async () => {
    const getUserMedia = vi.mocked(navigator.mediaDevices.getUserMedia);
    getUserMedia
      .mockRejectedValueOnce(new DOMException('No camera', 'NotFoundError'))
      .mockResolvedValueOnce(new MediaStream());
    const { result, actions } = renderController();

    await act(async () => {
      await result.current.startCall('video');
    });

    expect(getUserMedia).toHaveBeenNthCalledWith(1, { audio: true, video: true });
    expect(getUserMedia).toHaveBeenNthCalledWith(2, { audio: true, video: false });
    expect(actions.emitCallStart).toHaveBeenCalledWith({ chatId: 'chat-1', mode: 'audio' });
    expect(result.current.state.audioFallbackOffered).toBe(true);
    expect(result.current.state.mode).toBe('audio');
  });

  it('requests media before accepting an incoming call', async () => {
    const getUserMedia = vi.mocked(navigator.mediaDevices.getUserMedia);
    const session = makeCallSession({ callerId: 'user-2', calleeId: 'user-1', mode: 'video' });
    const { result, actions } = renderController();

    act(() => {
      result.current.socketHandlers.handleIncomingCall(session);
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('incoming');
    });

    await act(async () => {
      await result.current.acceptCall();
    });

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: true });
    expect(actions.emitCallAccept).toHaveBeenCalledWith({ chatId: 'chat-1', callId: 'call-1' });
    expect(getUserMedia.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(actions.emitCallAccept).mock.invocationCallOrder[0]
    );
  });

  it('accepts an incoming call by session chat id when no conversation is selected', async () => {
    const session = makeCallSession({ callerId: 'user-2', calleeId: 'user-1', mode: 'audio' });
    const { result, actions } = renderController({
      selectedChat: null,
      otherMember: null,
      otherMemberStatus: null,
    });

    act(() => {
      result.current.socketHandlers.handleIncomingCall(session);
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('incoming');
    });

    await act(async () => {
      await result.current.acceptCall();
    });

    expect(actions.emitCallAccept).toHaveBeenCalledWith({ chatId: 'chat-1', callId: 'call-1' });
  });

  it('fails an accepted media setup instead of staying in connecting forever', async () => {
    const { result, actions } = renderController();

    await act(async () => {
      await result.current.startCall('audio');
    });

    const activeStream = result.current.state.localStream;
    const activeTrack = activeStream?.getTracks()[0] as (MediaStreamTrack & { stop: ReturnType<typeof vi.fn> }) | undefined;

    vi.useFakeTimers();
    try {
      await act(async () => {
        await result.current.socketHandlers.handleCallSync(makeCallSession({
          status: 'connected',
          answeredAt: '2026-06-13T10:00:05.000Z',
        }));
      });

      expect(result.current.state.status).toBe('connecting');

      act(() => {
        vi.advanceTimersByTime(20_000);
      });

      expect(actions.emitCallEnd).toHaveBeenCalledWith({
        chatId: 'chat-1',
        callId: 'call-1',
        reason: 'failed',
      });
      expect(activeTrack?.stop).toHaveBeenCalledTimes(1);
      expect(result.current.state.status).toBe('failed');
      expect(result.current.state.error).toMatch(/could not connect/i);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ends the active call through the socket authority', async () => {
    const { result, actions } = renderController();

    await act(async () => {
      await result.current.startCall('audio');
    });

    await act(async () => {
      await result.current.endCall();
    });

    expect(actions.emitCallEnd).toHaveBeenCalledWith({
      chatId: 'chat-1',
      callId: 'call-1',
      reason: 'ended',
    });
    expect(result.current.state.status).toBe('ended');
  });

  it('fails and stops local media after prolonged realtime loss', async () => {
    const { result, rerender, props } = renderController();

    await act(async () => {
      await result.current.startCall('audio');
    });
    const activeStream = result.current.state.localStream;
    const activeTrack = activeStream?.getTracks()[0] as (MediaStreamTrack & { stop: ReturnType<typeof vi.fn> }) | undefined;

    vi.useFakeTimers();
    try {
      act(() => {
        rerender({ ...props, isSocketConnected: false });
      });

      expect(result.current.state.status).toBe('reconnecting');

      act(() => {
        vi.advanceTimersByTime(15_000);
      });

      expect(activeTrack?.stop).toHaveBeenCalledTimes(1);
      expect(result.current.state.status).toBe('failed');
      expect(result.current.state.error).toMatch(/realtime connection was lost/i);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ends an active call when authentication is lost', async () => {
    const { result, rerender, props, actions } = renderController();

    await act(async () => {
      await result.current.startCall('audio');
    });

    act(() => {
      rerender({ ...props, isAuthenticated: false });
    });

    await waitFor(() => {
      expect(actions.emitCallEnd).toHaveBeenCalledWith({
        chatId: 'chat-1',
        callId: 'call-1',
        reason: 'ended',
      });
    });
    await waitFor(() => {
      expect(result.current.state.status).toBe('ended');
    });
  });
});
