import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { makeChat, makeUser } from '../test/chatFixtures';
import type {
  CallActionAck,
  CallIceConfig,
  CallSessionPayload,
  ConversationControls,
} from '../types/chat';
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

const makeActions = (): CallSocketActions => ({
  emitCallStart: vi.fn(async (): Promise<CallActionAck> => ({ ok: true, event: 'call:start' })),
  emitCallAccept: vi.fn(async (): Promise<CallActionAck> => ({ ok: true, event: 'call:accept' })),
  emitCallReject: vi.fn(async (): Promise<CallActionAck> => ({ ok: true, event: 'call:reject' })),
  emitCallEnd: vi.fn(async (): Promise<CallActionAck> => ({ ok: true, event: 'call:end' })),
  emitCallSync: vi.fn(async (): Promise<CallActionAck> => ({ ok: true, event: 'call:sync', call: null })),
  emitCallOffer: vi.fn(async (): Promise<CallActionAck> => ({ ok: true, event: 'call:offer' })),
  emitCallAnswer: vi.fn(async (): Promise<CallActionAck> => ({ ok: true, event: 'call:answer' })),
  emitCallIceCandidate: vi.fn(async (): Promise<CallActionAck> => ({ ok: true, event: 'call:ice-candidate' })),
});

type InspectablePeerConnection = {
  configuration: RTCConfiguration;
};

const getPeerConnections = () => (
  (globalThis as typeof globalThis & {
    __mockRTCPeerConnections?: InspectablePeerConnection[];
  }).__mockRTCPeerConnections ?? []
);

describe('Phase 15 authorized call ICE configuration', () => {
  it('prefers the active call session configuration over credential-free readiness', async () => {
    const readinessConfig: CallIceConfig = {
      iceServers: [],
      turnReady: true,
      productionReady: true,
    };
    const sessionConfig: CallIceConfig = {
      iceServers: [{
        urls: 'turns:turn.example.test:5349?transport=tcp',
        username: 'authorized-call-user',
        credential: 'authorized-call-credential',
      }],
      turnReady: true,
      productionReady: true,
    };
    const session: CallSessionPayload = {
      callId: 'phase-15-call',
      chatId: 'chat-1',
      callerId: 'user-2',
      calleeId: 'user-1',
      mode: 'audio',
      status: 'ringing',
      startedAt: '2026-08-23T00:00:00.000Z',
      ringingAt: '2026-08-23T00:00:01.000Z',
      deliveredTo: ['user-1'],
      callConfig: sessionConfig,
    };
    const selectedChat = makeChat({ conversationControls });
    const peer = makeUser({ _id: 'user-2', firstName: 'Secure', lastName: 'Caller' });
    const socketActions = makeActions();
    const { result } = renderHook(() => useCallController({
      selectedChat,
      currentUserId: 'user-1',
      otherMember: peer,
      otherMemberStatus: {
        userId: 'user-2',
        isOnline: true,
        isCallReachable: true,
      },
      conversationControls,
      isAuthenticated: true,
      isSocketConnected: true,
      callConfig: readinessConfig,
      socketActions,
    }));

    act(() => {
      result.current.socketHandlers.handleIncomingCall(session);
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('incoming');
    });

    await act(async () => {
      await result.current.acceptCall();
    });

    const peerConnection = getPeerConnections()[0];
    expect(peerConnection).toBeDefined();
    expect(peerConnection?.configuration).toEqual({
      iceServers: sessionConfig.iceServers,
    });
  });
});
