import { serializeCallSession } from './callSessionState.mjs';

export const CALL_SOCKET_EVENTS = Object.freeze({
  START: 'call:start',
  INCOMING: 'call:incoming',
  ACCEPT: 'call:accept',
  REJECT: 'call:reject',
  END: 'call:end',
  OFFER: 'call:offer',
  ANSWER: 'call:answer',
  ICE_CANDIDATE: 'call:ice-candidate',
  SYNC: 'call:sync',
  ERROR: 'call:error',
});

export const callSocketErrorMessages = Object.freeze({
  invalid_payload: 'Invalid call payload',
  invalid_call_mode: 'Call mode must be audio or video',
  not_direct_chat: 'Calls are available only in direct chats',
  forbidden_or_not_found: 'Forbidden or not found',
  call_forbidden: 'Call not found',
  conversation_blocked: 'Conversation activity is not available',
  call_busy: 'A participant is already in a call',
  callee_unavailable: 'This person is not available for a call right now',
  invalid_call_signal: 'Invalid call signal',
  stale_call: 'This call is no longer active',
  rate_limited: 'Too many socket events',
  server_error: 'Call action failed',
});

export const buildCallAck = (event, data = {}) => ({
  ok: true,
  event,
  ...data,
});

export const buildCallErrorAck = (event, error = {}) => {
  const code = error?.code ?? 'server_error';

  return {
    ok: false,
    event,
    code,
    message: callSocketErrorMessages[code] ?? callSocketErrorMessages.server_error,
  };
};

export const buildCallSessionPayload = (session, extra = {}) => ({
  ...serializeCallSession(session),
  ...extra,
});

export const emitCallAck = (ack, event, data = {}) => {
  const payload = buildCallAck(event, data);

  if (typeof ack === 'function') {
    ack(payload);
  }

  return payload;
};

export const emitCallError = (socket, event, error, ack) => {
  const payload = buildCallErrorAck(event, error);

  if (typeof ack === 'function') {
    ack(payload);
    return payload;
  }

  socket.emit(CALL_SOCKET_EVENTS.ERROR, payload);
  return payload;
};
