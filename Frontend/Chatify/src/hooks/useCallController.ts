import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '../types/auth';
import type {
  CallActionAck,
  CallIceConfig,
  CallMode,
  CallSessionPayload,
  CallSignalEvent,
  CallUiStatus,
  Chat,
  ConversationControls,
  UserOnlineStatus,
} from '../types/chat';
import {
  WebRtcCallSession,
  isWebRTCSupported,
  requestCallMedia,
  stopMediaStream,
  type ChatifyPeerState,
} from '../utils/webrtcCallSession';

type CallAction<TPayload> = (payload: TPayload) => Promise<CallActionAck>;

export interface CallSocketActions {
  emitCallStart: CallAction<{ chatId: string; mode: CallMode }>;
  emitCallAccept: CallAction<{ chatId: string; callId: string }>;
  emitCallReject: CallAction<{ chatId: string; callId: string }>;
  emitCallEnd: CallAction<{ chatId: string; callId: string; reason?: string }>;
  emitCallSync: CallAction<{ chatId: string }>;
  emitCallOffer: CallAction<{ chatId: string; callId: string; signal: RTCSessionDescriptionInit }>;
  emitCallAnswer: CallAction<{ chatId: string; callId: string; signal: RTCSessionDescriptionInit }>;
  emitCallIceCandidate: CallAction<{ chatId: string; callId: string; signal: RTCIceCandidateInit }>;
}

export interface CallAvailability {
  available: boolean;
  reason: string | null;
}

export interface CallControllerState {
  status: CallUiStatus;
  session: CallSessionPayload | null;
  mode: CallMode | null;
  peer: User | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  cameraEnabled: boolean;
  audioFallbackOffered: boolean;
  error: string | null;
  startedAt: string | null;
  connectedAt: string | null;
}

export interface UseCallControllerOptions {
  selectedChat: Chat | null;
  currentUserId?: string;
  otherMember: User | null;
  otherMemberStatus: UserOnlineStatus | null;
  conversationControls?: ConversationControls;
  isAuthenticated: boolean;
  isSocketConnected: boolean;
  callConfig: CallIceConfig | null;
  socketActions: CallSocketActions;
}

const idleState: CallControllerState = {
  status: 'idle',
  session: null,
  mode: null,
  peer: null,
  localStream: null,
  remoteStream: null,
  muted: false,
  cameraEnabled: true,
  audioFallbackOffered: false,
  error: null,
  startedAt: null,
  connectedAt: null,
};

const terminalStatusMap: Partial<Record<string, CallUiStatus>> = {
  rejected: 'rejected',
  missed: 'missed',
  ended: 'ended',
  failed: 'failed',
  canceled: 'ended',
  blocked: 'ended',
};

const CALL_DISCONNECT_GRACE_MS = 15_000;
const CALL_ONLINE_REQUIREMENT_REASON = 'Both users must be online to call.';

const getAckErrorCopy = (ack: CallActionAck) => {
  if (ack.code === 'call_busy') {
    return 'This conversation is already in a call.';
  }

  if (ack.code === 'conversation_blocked') {
    return 'Conversation activity is disabled for this chat.';
  }

  if (ack.code === 'callee_unavailable') {
    return 'This person is not available for a call right now.';
  }

  if (ack.code === 'ack_timeout') {
    return 'The call request timed out.';
  }

  return ack.message ?? 'Call action failed.';
};

const getMediaErrorStatus = (error: unknown): Pick<CallControllerState, 'status' | 'error'> => {
  const name = error instanceof DOMException ? error.name : '';

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return {
      status: 'permission_denied',
      error: 'Microphone or camera permission was denied.',
    };
  }

  return {
    status: 'failed',
    error: 'Could not access the requested media device.',
  };
};

export const useCallController = ({
  selectedChat,
  currentUserId,
  otherMember,
  otherMemberStatus,
  conversationControls,
  isAuthenticated,
  isSocketConnected,
  callConfig,
  socketActions,
}: UseCallControllerOptions) => {
  const [state, setState] = useState<CallControllerState>(idleState);
  const stateRef = useRef(state);
  const peerSessionRef = useRef<WebRtcCallSession | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const offerSentRef = useRef(false);
  const disconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  stateRef.current = state;

  const clearDisconnectTimeout = useCallback(() => {
    if (disconnectTimeoutRef.current) {
      clearTimeout(disconnectTimeoutRef.current);
      disconnectTimeoutRef.current = null;
    }
  }, []);

  const resetPeer = useCallback(() => {
    clearDisconnectTimeout();
    peerSessionRef.current?.close();
    peerSessionRef.current = null;
    stopMediaStream(localStreamRef.current);
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    offerSentRef.current = false;
  }, [clearDisconnectTimeout]);

  const resetCallState = useCallback((nextState: Partial<CallControllerState> = {}) => {
    resetPeer();
    setState({
      ...idleState,
      ...nextState,
    });
  }, [resetPeer]);

  const getAvailability = useCallback((mode: CallMode): CallAvailability => {
    if (!selectedChat) {
      return { available: false, reason: 'Select a conversation first.' };
    }

    if (!isAuthenticated) {
      return { available: false, reason: 'Sign in to start calls.' };
    }

    if (selectedChat.isGroupChat || !conversationControls?.isDirectChat) {
      return { available: false, reason: 'Calls are available only in direct chats.' };
    }

    if (conversationControls?.canSendMessage === false) {
      return { available: false, reason: 'Conversation activity is disabled for this chat.' };
    }

    if (!isSocketConnected) {
      return { available: false, reason: CALL_ONLINE_REQUIREMENT_REASON };
    }

    if (!otherMember) {
      return { available: false, reason: 'Call recipient is unavailable.' };
    }

    if (!otherMemberStatus?.isOnline) {
      return { available: false, reason: CALL_ONLINE_REQUIREMENT_REASON };
    }

    if (!isWebRTCSupported()) {
      return { available: false, reason: 'Calls require a supported secure browser.' };
    }

    if (stateRef.current.status !== 'idle' && stateRef.current.status !== 'ended') {
      return { available: false, reason: 'A call is already active.' };
    }

    if (mode === 'video' && typeof navigator !== 'undefined' && !navigator.mediaDevices?.getUserMedia) {
      return { available: false, reason: 'Camera access is not available in this browser.' };
    }

    return { available: true, reason: null };
  }, [
    conversationControls?.canSendMessage,
    conversationControls?.isDirectChat,
    isAuthenticated,
    isSocketConnected,
    otherMember,
    otherMemberStatus?.isOnline,
    selectedChat,
  ]);

  const createPeerSession = useCallback((session: CallSessionPayload, stream: MediaStream) => {
    if (peerSessionRef.current) {
      return peerSessionRef.current;
    }

    const peerSession = new WebRtcCallSession({
      iceConfig: callConfig ?? session.callConfig ?? null,
      localStream: stream,
      onRemoteStream: (remoteStream) => {
        remoteStreamRef.current = remoteStream;
        setState((current) => ({ ...current, remoteStream }));
      },
      onIceCandidate: (candidate) => {
        socketActions.emitCallIceCandidate({
          chatId: session.chatId,
          callId: session.callId,
          signal: candidate,
        });
      },
      onStateChange: (peerState: ChatifyPeerState) => {
        setState((current) => {
          if (peerState === 'connected') {
            return {
              ...current,
              status: 'connected',
              connectedAt: current.connectedAt ?? new Date().toISOString(),
            };
          }

          if (peerState === 'reconnecting') {
            return { ...current, status: 'reconnecting' };
          }

          if (peerState === 'failed' || peerState === 'closed') {
            return { ...current, status: peerState === 'failed' ? 'failed' : current.status };
          }

          return { ...current, status: current.status === 'connected' ? 'connected' : 'connecting' };
        });
      },
    });

    peerSessionRef.current = peerSession;
    return peerSession;
  }, [callConfig, socketActions]);

  const requestMediaForCall = useCallback(async (mode: CallMode) => {
    const media = await requestCallMedia(mode);
    localStreamRef.current = media.stream;
    setState((current) => ({
      ...current,
      localStream: media.stream,
      mode: media.mode,
      cameraEnabled: media.mode === 'video',
      audioFallbackOffered: media.audioFallback,
    }));
    return media;
  }, []);

  const startCall = useCallback(async (mode: CallMode) => {
    const availability = getAvailability(mode);

    if (!availability.available || !selectedChat || !otherMember) {
      setState((current) => ({
        ...current,
        status: 'failed',
        error: availability.reason,
      }));
      return;
    }

    try {
      setState({
        ...idleState,
        status: 'connecting',
        mode,
        peer: otherMember,
        startedAt: new Date().toISOString(),
      });
      const media = await requestMediaForCall(mode);
      const ack = await socketActions.emitCallStart({
        chatId: selectedChat._id,
        mode: media.mode,
      });

      if (!ack.ok || !ack.callId || !ack.chatId || !ack.callerId || !ack.calleeId || !ack.mode || !ack.status) {
        resetPeer();
        setState((current) => ({
          ...current,
          status: ack.code === 'call_busy' ? 'busy' : 'failed',
          error: getAckErrorCopy(ack),
        }));
        return;
      }

      const session = ack as CallSessionPayload;
      setState((current) => ({
        ...current,
        status: 'outgoing',
        session,
        mode: session.mode,
        peer: otherMember,
        startedAt: session.startedAt ?? current.startedAt,
        error: null,
      }));
    } catch (error) {
      resetPeer();
      setState((current) => ({
        ...current,
        ...getMediaErrorStatus(error),
      }));
    }
  }, [getAvailability, otherMember, requestMediaForCall, resetPeer, selectedChat, socketActions]);

  const acceptCall = useCallback(async () => {
    const session = stateRef.current.session;

    if (!session || !selectedChat) {
      return;
    }

    try {
      setState((current) => ({ ...current, status: 'connecting', error: null }));
      const media = await requestMediaForCall(session.mode);
      const ack = await socketActions.emitCallAccept({
        chatId: selectedChat._id,
        callId: session.callId,
      });

      if (!ack.ok) {
        resetPeer();
        setState((current) => ({ ...current, status: 'failed', error: getAckErrorCopy(ack) }));
        return;
      }

      createPeerSession(session, media.stream);
      setState((current) => ({
        ...current,
        status: 'connecting',
        session: { ...session, ...(ack as Partial<CallSessionPayload>) },
        error: null,
      }));
    } catch (error) {
      resetPeer();
      setState((current) => ({ ...current, ...getMediaErrorStatus(error) }));
    }
  }, [createPeerSession, requestMediaForCall, resetPeer, selectedChat, socketActions]);

  const rejectCall = useCallback(async () => {
    const session = stateRef.current.session;

    if (!session) {
      resetCallState();
      return;
    }

    await socketActions.emitCallReject({ chatId: session.chatId, callId: session.callId });
    resetCallState({ status: 'rejected', session, peer: stateRef.current.peer });
  }, [resetCallState, socketActions]);

  const endCall = useCallback(async (reason = 'ended') => {
    const session = stateRef.current.session;

    if (session) {
      await socketActions.emitCallEnd({ chatId: session.chatId, callId: session.callId, reason });
    }

    resetCallState({ status: 'ended', session, peer: stateRef.current.peer });
  }, [resetCallState, socketActions]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;

    stream?.getAudioTracks().forEach((track) => {
      track.enabled = stateRef.current.muted;
    });

    setState((current) => ({ ...current, muted: !current.muted }));
  }, []);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;

    stream?.getVideoTracks().forEach((track) => {
      track.enabled = !stateRef.current.cameraEnabled;
    });

    setState((current) => ({ ...current, cameraEnabled: !current.cameraEnabled }));
  }, []);

  const handleIncomingCall = useCallback((event: CallSessionPayload) => {
    if (currentUserId && event.calleeId !== currentUserId) {
      return;
    }

    setState({
      ...idleState,
      status: 'incoming',
      session: event,
      mode: event.mode,
      peer: otherMember,
      startedAt: event.startedAt ?? null,
    });
  }, [currentUserId, otherMember]);

  const handleCallSync = useCallback(async (event: CallSessionPayload) => {
    const current = stateRef.current;

    if (current.session && current.session.callId !== event.callId) {
      return;
    }

    if (event.status === 'ringing') {
      setState((existing) => ({
        ...existing,
        session: event,
        status: existing.status === 'incoming' ? 'incoming' : 'ringing',
      }));
      return;
    }

    if (event.status === 'connected') {
      setState((existing) => ({
        ...existing,
        session: event,
        status: existing.status === 'connected' ? 'connected' : 'connecting',
        connectedAt: event.answeredAt ?? existing.connectedAt,
      }));

      const stream = localStreamRef.current;
      if (stream) {
        const peerSession = createPeerSession(event, stream);
        const isCaller = currentUserId === event.callerId;

        if (isCaller && !offerSentRef.current) {
          offerSentRef.current = true;
          const offer = await peerSession.createOffer();
          await socketActions.emitCallOffer({
            chatId: event.chatId,
            callId: event.callId,
            signal: offer,
          });
        }
      }
      return;
    }

    const terminalStatus = terminalStatusMap[event.status];
    if (terminalStatus) {
      resetPeer();
      setState((existing) => ({
        ...existing,
        status: terminalStatus,
        session: event,
        error: event.endedReason === 'blocked' ? 'The call ended because the conversation was blocked.' : existing.error,
      }));
    }
  }, [createPeerSession, currentUserId, resetPeer, socketActions]);

  const handleCallOffer = useCallback(async (event: CallSignalEvent) => {
    const session = stateRef.current.session;
    const stream = localStreamRef.current;

    if (!session || !stream || session.callId !== event.callId || !event.signal) {
      return;
    }

    const peerSession = createPeerSession(session, stream);
    const answer = await peerSession.createAnswer(event.signal as RTCSessionDescriptionInit);
    await socketActions.emitCallAnswer({
      chatId: event.chatId,
      callId: event.callId,
      signal: answer,
    });
  }, [createPeerSession, socketActions]);

  const handleCallAnswer = useCallback(async (event: CallSignalEvent) => {
    if (!peerSessionRef.current || !event.signal) {
      return;
    }

    await peerSessionRef.current.acceptAnswer(event.signal as RTCSessionDescriptionInit);
  }, []);

  const handleCallIceCandidate = useCallback(async (event: CallSignalEvent) => {
    if (!peerSessionRef.current || !event.signal) {
      return;
    }

    await peerSessionRef.current.addIceCandidate(event.signal as RTCIceCandidateInit);
  }, []);

  useEffect(() => {
    if (!selectedChat?._id) {
      resetCallState();
      return;
    }

    socketActions.emitCallSync({ chatId: selectedChat._id }).then((ack) => {
      if (ack.ok && ack.call) {
        handleCallSync(ack.call);
      }
    });
  }, [handleCallSync, resetCallState, selectedChat?._id, socketActions]);

  useEffect(() => {
    if (isAuthenticated) {
      return;
    }

    if (stateRef.current.session) {
      void endCall('ended');
      return;
    }

    resetCallState();
  }, [endCall, isAuthenticated, resetCallState]);

  useEffect(() => {
    if (conversationControls?.canSendMessage !== false || !stateRef.current.session) {
      return;
    }

    void endCall('blocked');
  }, [conversationControls?.canSendMessage, endCall]);

  useEffect(() => {
    if (isSocketConnected) {
      clearDisconnectTimeout();
      return undefined;
    }

    const current = stateRef.current;
    if (!current.session || current.status === 'idle' || current.status === 'ended' || current.status === 'failed') {
      return undefined;
    }

    setState((existing) => ({
      ...existing,
      status: existing.status === 'connected' || existing.status === 'connecting' || existing.status === 'outgoing' || existing.status === 'ringing'
        ? 'reconnecting'
        : existing.status,
      error: 'Realtime connection interrupted. Trying to recover.',
    }));

    disconnectTimeoutRef.current = setTimeout(() => {
      resetPeer();
      setState((existing) => ({
        ...existing,
        status: 'failed',
        error: 'Realtime connection was lost. Call media has been stopped.',
      }));
    }, CALL_DISCONNECT_GRACE_MS);

    return () => {
      clearDisconnectTimeout();
    };
  }, [clearDisconnectTimeout, isSocketConnected, resetPeer]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      const session = stateRef.current.session;
      if (session) {
        socketActions.emitCallEnd({ chatId: session.chatId, callId: session.callId, reason: 'ended' });
      }
      resetPeer();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
    };
  }, [resetPeer, socketActions]);

  const audioAvailability = useMemo(() => getAvailability('audio'), [getAvailability]);
  const videoAvailability = useMemo(() => getAvailability('video'), [getAvailability]);

  const socketHandlers = useMemo(() => ({
    handleIncomingCall,
    handleCallSync,
    handleCallOffer,
    handleCallAnswer,
    handleCallIceCandidate,
  }), [
    handleCallAnswer,
    handleCallIceCandidate,
    handleCallOffer,
    handleCallSync,
    handleIncomingCall,
  ]);

  return {
    state,
    audioAvailability,
    videoAvailability,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    socketHandlers,
  };
};

export default useCallController;
