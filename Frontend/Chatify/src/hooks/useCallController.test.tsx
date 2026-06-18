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

type MockPeerConnection = {
  addIceCandidate: ReturnType<typeof vi.fn>;
  setRemoteDescription: ReturnType<typeof vi.fn>;
};

const getMockPeerConnections = () => (
  (globalThis as typeof globalThis & { __mockRTCPeerConnections?: MockPeerConnection[] }).__mockRTCPeerConnections ?? []
);

const renderController = (overrides: Partial<Parameters<typeof useCallController>[0]> = {}) => {
  const chat = makeChat({ conversationControls });
  const peer = makeUser({ _id: 'user-2', firstName: 'Grace', lastName: 'Hopper' });
  const actions = makeActions();
  const props = {
    selectedChat: chat,
    currentUserId: 'user-1',
    otherMember: peer,
    otherMemberStatus: { userId: 'user-2', isOnline: true, isCallReachable: true },
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

  it('uses the realtime readiness reason when the current socket is disconnected', () => {
    const { result } = renderController({
      isSocketConnected: false,
    });

    expect(result.current.audioAvailability).toEqual({
      available: false,
      reason: 'Realtime connection is not ready for calls.',
    });
    expect(result.current.videoAvailability).toEqual({
      available: false,
      reason: 'Realtime connection is not ready for calls.',
    });
  });

  it('allows calls when the peer is online even if reachability is stale', () => {
    const { result } = renderController({
      otherMemberStatus: { userId: 'user-2', isOnline: true, isCallReachable: false },
    });

    expect(result.current.audioAvailability).toEqual({
      available: true,
      reason: null,
    });
    expect(result.current.videoAvailability).toEqual({
      available: true,
      reason: null,
    });
  });

  it('allows calls when the peer is online and reachability is missing from presence', () => {
    const { result } = renderController({
      otherMemberStatus: { userId: 'user-2', isOnline: true },
    });

    expect(result.current.audioAvailability).toEqual({
      available: true,
      reason: null,
    });
    expect(result.current.videoAvailability).toEqual({
      available: true,
      reason: null,
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

  it('surfaces backend peer-unreachable acknowledgement after allowing an online call attempt', async () => {
    const { result, actions } = renderController({
      otherMemberStatus: { userId: 'user-2', isOnline: true, isCallReachable: false },
    });
    vi.mocked(actions.emitCallStart).mockResolvedValueOnce({
      ok: false,
      event: 'call:start',
      code: 'callee_unavailable',
    });

    await act(async () => {
      await result.current.startCall('audio');
    });

    expect(actions.emitCallStart).toHaveBeenCalledWith({ chatId: 'chat-1', mode: 'audio' });
    expect(result.current.state.status).toBe('failed');
    expect(result.current.state.error).toBe('This person is online but not reachable for calls yet.');
  });

  it('fails video capture instead of silently falling back to audio', async () => {
    const getUserMedia = vi.mocked(navigator.mediaDevices.getUserMedia);
    getUserMedia.mockRejectedValueOnce(new DOMException('No camera', 'NotFoundError'));
    const { result, actions } = renderController();

    await act(async () => {
      await result.current.startCall('video');
    });

    expect(getUserMedia).toHaveBeenNthCalledWith(1, { audio: true, video: true });
    expect(actions.emitCallStart).not.toHaveBeenCalled();
    expect(result.current.state.audioFallbackOffered).toBe(false);
    expect(result.current.state.mode).toBe('video');
    expect(result.current.state.status).toBe('failed');
    expect(result.current.state.error).toMatch(/camera/i);
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

  it('ends a ringing call as failed when the callee cannot capture media', async () => {
    const getUserMedia = vi.mocked(navigator.mediaDevices.getUserMedia);
    getUserMedia.mockRejectedValueOnce(new DOMException('No camera', 'NotFoundError'));
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

    expect(actions.emitCallEnd).toHaveBeenCalledWith({
      chatId: 'chat-1',
      callId: 'call-1',
      reason: 'failed',
    });
    expect(actions.emitCallAccept).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe('failed');
    expect(result.current.state.error).toMatch(/camera/i);
  });

  it('buffers ICE candidates until the remote description is ready', async () => {
    const session = makeCallSession({ callerId: 'user-2', calleeId: 'user-1', mode: 'audio' });
    const { result } = renderController();
    const candidate = {
      candidate: 'candidate:1 1 udp 2122260223 192.0.2.1 54400 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
    };
    const offer = {
      type: 'offer',
      sdp: 'mock-offer',
    } as RTCSessionDescriptionInit;

    act(() => {
      result.current.socketHandlers.handleIncomingCall(session);
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('incoming');
    });

    await act(async () => {
      await result.current.socketHandlers.handleCallIceCandidate({
        callId: session.callId,
        chatId: session.chatId,
        fromUserId: session.callerId,
        signal: candidate,
      });
    });

    expect(getMockPeerConnections()).toHaveLength(0);

    await act(async () => {
      await result.current.acceptCall();
    });

    const peerConnection = getMockPeerConnections()[0];
    if (!peerConnection) {
      throw new Error('Expected a peer connection to be created.');
    }

    expect(peerConnection.addIceCandidate).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.socketHandlers.handleCallOffer({
        callId: session.callId,
        chatId: session.chatId,
        fromUserId: session.callerId,
        signal: offer,
      });
    });

    expect(peerConnection.setRemoteDescription).toHaveBeenCalledWith(offer);
    expect(peerConnection.addIceCandidate).toHaveBeenCalledWith(candidate);
  });

  it('drops late ICE candidates after the call has ended', async () => {
    const session = makeCallSession({ callerId: 'user-2', calleeId: 'user-1', mode: 'audio' });
    const { result } = renderController();
    const candidate = {
      candidate: 'candidate:2 1 udp 2122260223 192.0.2.2 54401 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
    };

    act(() => {
      result.current.socketHandlers.handleIncomingCall(session);
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('incoming');
    });

    await act(async () => {
      await result.current.acceptCall();
    });

    await waitFor(() => {
      expect(getMockPeerConnections()).toHaveLength(1);
    });

    const peerConnection = getMockPeerConnections()[0];
    if (!peerConnection) {
      throw new Error('Expected a peer connection to be created.');
    }

    await act(async () => {
      await result.current.socketHandlers.handleCallSync({
        ...session,
        status: 'ended',
        endedAt: '2026-06-13T10:00:06.000Z',
        endedReason: 'ended',
      });
    });

    await act(async () => {
      await result.current.socketHandlers.handleCallIceCandidate({
        callId: session.callId,
        chatId: session.chatId,
        fromUserId: session.callerId,
        signal: candidate,
      });
    });

    expect(peerConnection.addIceCandidate).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe('ended');
  });

  it('ignores answers for a different active call id', async () => {
    const { result } = renderController();
    const answer = {
      type: 'answer',
      sdp: 'mock-answer',
    } as RTCSessionDescriptionInit;

    await act(async () => {
      await result.current.startCall('audio');
    });

    await act(async () => {
      await result.current.socketHandlers.handleCallSync(makeCallSession({
        status: 'connected',
        answeredAt: '2026-06-13T10:00:05.000Z',
      }));
    });

    await waitFor(() => {
      expect(getMockPeerConnections()).toHaveLength(1);
    });

    const peerConnection = getMockPeerConnections()[0];
    if (!peerConnection) {
      throw new Error('Expected a peer connection to be created.');
    }

    await act(async () => {
      await result.current.socketHandlers.handleCallAnswer({
        callId: 'stale-call',
        chatId: 'chat-1',
        fromUserId: 'user-2',
        signal: answer,
      });
    });

    expect(peerConnection.setRemoteDescription).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.socketHandlers.handleCallAnswer({
        callId: 'call-1',
        chatId: 'chat-1',
        fromUserId: 'user-2',
        signal: answer,
      });
    });

    expect(peerConnection.setRemoteDescription).toHaveBeenCalledWith(answer);
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
