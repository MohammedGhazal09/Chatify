import { randomUUID } from 'node:crypto';
import CallSession from '../Models/callSessionModel.mjs';
import Message from '../Models/messageModel.mjs';
import { ChatAccessError, normalizeObjectId } from './chatAccess.mjs';
import {
  assertConversationActivityAllowed,
  getDirectChatPeerId,
  isDirectChat,
} from './conversationControls.mjs';
import { serializeMessage, toIdString } from './messageState.mjs';

export const CALL_RING_TIMEOUT_MS = 30_000;

export const CALL_MODE = Object.freeze({
  AUDIO: 'audio',
  VIDEO: 'video',
});

export const CALL_STATUS = Object.freeze({
  RINGING: 'ringing',
  CONNECTED: 'connected',
  REJECTED: 'rejected',
  MISSED: 'missed',
  ENDED: 'ended',
  FAILED: 'failed',
  CANCELED: 'canceled',
  BLOCKED: 'blocked',
});

export const CALL_ACTIVITY_TYPE = 'call';

export const CALL_ACTIVITY_RESULT = Object.freeze({
  MISSED: 'missed',
  REJECTED: 'rejected',
  ENDED: 'ended',
  FAILED: 'failed',
  CANCELED: 'canceled',
  BLOCKED: 'blocked',
});

export const CALL_ACTIVE_STATUSES = Object.freeze([
  CALL_STATUS.RINGING,
  CALL_STATUS.CONNECTED,
]);

const TERMINAL_ACTIVITY_RESULTS = new Set(Object.values(CALL_ACTIVITY_RESULT));
const ACTIVITY_STATUSES = new Set([
  CALL_STATUS.REJECTED,
  CALL_STATUS.MISSED,
  CALL_STATUS.ENDED,
  CALL_STATUS.FAILED,
  CALL_STATUS.CANCELED,
  CALL_STATUS.BLOCKED,
]);

export class CallSessionError extends Error {
  constructor(code, message = 'Call action failed', statusCode = 400) {
    super(message);
    this.name = 'CallSessionError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const toCallSocketError = (error) => {
  if (error instanceof CallSessionError) {
    return new ChatAccessError(error.code, error.message);
  }

  return error;
};

const normalizeParticipantId = (value) => normalizeObjectId(value?._id ?? value);

const idsEqual = (left, right) => {
  const leftId = toIdString(left);
  const rightId = toIdString(right);
  return Boolean(leftId && rightId && leftId === rightId);
};

const serializeDate = (value) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const normalizeCallMode = (mode) => {
  if (mode === CALL_MODE.AUDIO || mode === CALL_MODE.VIDEO) {
    return mode;
  }

  throw new CallSessionError('invalid_call_mode', 'Call mode must be audio or video');
};

export const serializeCallSession = (session) => {
  const plainSession = session?.toObject?.() ?? session ?? {};

  return {
    callId: plainSession.callId ?? null,
    chatId: toIdString(plainSession.chatId),
    callerId: toIdString(plainSession.callerId),
    calleeId: toIdString(plainSession.calleeId),
    mode: plainSession.mode ?? CALL_MODE.AUDIO,
    status: plainSession.status ?? CALL_STATUS.FAILED,
    startedAt: serializeDate(plainSession.startedAt),
    ringingAt: serializeDate(plainSession.ringingAt),
    answeredAt: serializeDate(plainSession.answeredAt),
    endedAt: serializeDate(plainSession.endedAt),
    endedReason: plainSession.endedReason ?? null,
    deliveredTo: (plainSession.deliveredTo ?? []).map((userId) => toIdString(userId)).filter(Boolean),
    durationSeconds: Number.isFinite(Number(plainSession.durationSeconds))
      ? Number(plainSession.durationSeconds)
      : null,
  };
};

export const assertDirectCallChat = (chat) => {
  if (!isDirectChat(chat)) {
    throw new CallSessionError('not_direct_chat', 'Calls are available only in direct chats');
  }

  return chat;
};

export const getCallPeerId = ({ chat, userId }) => {
  assertDirectCallChat(chat);
  return getDirectChatPeerId(chat, userId);
};

export const assertCallParticipant = (session, userId) => {
  const userObjectId = normalizeParticipantId(userId);

  if (!idsEqual(session?.callerId, userObjectId) && !idsEqual(session?.calleeId, userObjectId)) {
    throw new CallSessionError('call_forbidden', 'Call not found');
  }

  return userObjectId;
};

export const getCallPeerForParticipant = (session, userId) => {
  const userObjectId = assertCallParticipant(session, userId);
  return idsEqual(session.callerId, userObjectId) ? session.calleeId : session.callerId;
};

export const isCallTerminal = (session) => !CALL_ACTIVE_STATUSES.includes(session?.status);

export const findActiveCallForUser = (userId) => {
  const userObjectId = normalizeParticipantId(userId);

  return CallSession.findOne({
    status: { $in: CALL_ACTIVE_STATUSES },
    $or: [
      { callerId: userObjectId },
      { calleeId: userObjectId },
    ],
  }).sort({ createdAt: -1 });
};

export const findActiveCallForChat = (chatId) => {
  return CallSession.findOne({
    chatId: normalizeObjectId(chatId),
    status: { $in: CALL_ACTIVE_STATUSES },
  }).sort({ createdAt: -1 });
};

export const findActiveCallForUserInChat = (userId, chatId) => {
  const userObjectId = normalizeParticipantId(userId);

  return CallSession.findOne({
    chatId: normalizeObjectId(chatId),
    status: { $in: CALL_ACTIVE_STATUSES },
    $or: [
      { callerId: userObjectId },
      { calleeId: userObjectId },
    ],
  }).sort({ createdAt: -1 });
};

const assertNoActiveUserCall = async ({ callerId, calleeId }) => {
  const callerObjectId = normalizeParticipantId(callerId);
  const calleeObjectId = normalizeParticipantId(calleeId);
  const activeCall = await CallSession.findOne({
    status: { $in: CALL_ACTIVE_STATUSES },
    $or: [
      { callerId: callerObjectId },
      { calleeId: callerObjectId },
      { callerId: calleeObjectId },
      { calleeId: calleeObjectId },
    ],
  }).lean();

  if (activeCall) {
    throw new CallSessionError('call_busy', 'A participant is already in a call', 409);
  }
};

export const startCallSession = async ({
  chat,
  callerId,
  mode,
  deliveredTo = [],
  now = new Date(),
}) => {
  assertDirectCallChat(chat);
  await assertConversationActivityAllowed({ chat, actorId: callerId });

  const callerObjectId = normalizeParticipantId(callerId);
  const calleeId = getCallPeerId({ chat, userId: callerObjectId });
  const normalizedMode = normalizeCallMode(mode);

  await assertNoActiveUserCall({ callerId: callerObjectId, calleeId });

  return CallSession.create({
    callId: randomUUID(),
    chatId: chat._id,
    callerId: callerObjectId,
    calleeId,
    mode: normalizedMode,
    status: CALL_STATUS.RINGING,
    startedAt: now,
    ringingAt: now,
    deliveredTo: deliveredTo.map((userId) => normalizeParticipantId(userId)),
  });
};

export const loadCallSessionForAction = async ({ callId, chatId, actorId }) => {
  const session = await CallSession.findOne({
    callId,
    ...(chatId ? { chatId: normalizeObjectId(chatId) } : {}),
  });

  if (!session) {
    throw new CallSessionError('stale_call', 'Call not found', 404);
  }

  assertCallParticipant(session, actorId);
  return session;
};

const computeConnectedDuration = ({ answeredAt, endedAt }) => {
  if (!answeredAt || !endedAt) {
    return undefined;
  }

  return Math.max(0, Math.round((endedAt.getTime() - answeredAt.getTime()) / 1000));
};

const terminalPatchForStatus = ({ status, reason, now, session }) => {
  const patch = {
    status,
    endedAt: now,
    endedReason: reason,
  };

  if (status === CALL_STATUS.ENDED && session.answeredAt) {
    patch.durationSeconds = computeConnectedDuration({
      answeredAt: session.answeredAt,
      endedAt: now,
    });
  }

  return patch;
};

export const acceptCallSession = async ({ callId, chatId, actorId, now = new Date() }) => {
  const session = await loadCallSessionForAction({ callId, chatId, actorId });

  if (!idsEqual(session.calleeId, actorId)) {
    throw new CallSessionError('call_forbidden', 'Only the callee can accept this call', 403);
  }

  const updatedSession = await CallSession.findOneAndUpdate(
    {
      _id: session._id,
      status: CALL_STATUS.RINGING,
    },
    {
      $set: {
        status: CALL_STATUS.CONNECTED,
        answeredAt: now,
      },
    },
    { new: true }
  );

  if (!updatedSession) {
    throw new CallSessionError('stale_call', 'Call is no longer ringing', 409);
  }

  return updatedSession;
};

export const rejectCallSession = async ({ callId, chatId, actorId, now = new Date() }) => {
  const session = await loadCallSessionForAction({ callId, chatId, actorId });

  if (!idsEqual(session.calleeId, actorId)) {
    throw new CallSessionError('call_forbidden', 'Only the callee can reject this call', 403);
  }

  const updatedSession = await CallSession.findOneAndUpdate(
    {
      _id: session._id,
      status: CALL_STATUS.RINGING,
    },
    {
      $set: terminalPatchForStatus({
        status: CALL_STATUS.REJECTED,
        reason: CALL_ACTIVITY_RESULT.REJECTED,
        now,
        session,
      }),
    },
    { new: true }
  );

  if (!updatedSession) {
    throw new CallSessionError('stale_call', 'Call is no longer ringing', 409);
  }

  await createCallActivityForSession(updatedSession);
  return updatedSession;
};

export const timeoutCallSession = async ({ callId, now = new Date() }) => {
  const session = await CallSession.findOne({ callId });

  if (!session || session.status !== CALL_STATUS.RINGING) {
    return null;
  }

  const delivered = (session.deliveredTo ?? []).length > 0;
  const status = delivered ? CALL_STATUS.MISSED : CALL_STATUS.FAILED;
  const reason = delivered ? CALL_ACTIVITY_RESULT.MISSED : CALL_ACTIVITY_RESULT.FAILED;
  const updatedSession = await CallSession.findOneAndUpdate(
    {
      _id: session._id,
      status: CALL_STATUS.RINGING,
    },
    {
      $set: terminalPatchForStatus({ status, reason, now, session }),
    },
    { new: true }
  );

  if (updatedSession && delivered) {
    await createCallActivityForSession(updatedSession);
  }

  return updatedSession;
};

export const endCallSession = async ({
  callId,
  chatId,
  actorId,
  reason = CALL_ACTIVITY_RESULT.ENDED,
  now = new Date(),
}) => {
  const session = await loadCallSessionForAction({ callId, chatId, actorId });

  if (isCallTerminal(session)) {
    return session;
  }

  const endingStatus = reason === CALL_ACTIVITY_RESULT.FAILED
    ? CALL_STATUS.FAILED
    : session.status === CALL_STATUS.RINGING && idsEqual(session.callerId, actorId)
      ? CALL_STATUS.CANCELED
      : reason === CALL_ACTIVITY_RESULT.BLOCKED
      ? CALL_STATUS.BLOCKED
      : CALL_STATUS.ENDED;

  const updatedSession = await CallSession.findOneAndUpdate(
    {
      _id: session._id,
      status: { $in: CALL_ACTIVE_STATUSES },
    },
    {
      $set: terminalPatchForStatus({
        status: endingStatus,
        reason: endingStatus === CALL_STATUS.CANCELED ? CALL_ACTIVITY_RESULT.CANCELED : reason,
        now,
        session,
      }),
    },
    { new: true }
  );

  if (!updatedSession) {
    throw new CallSessionError('stale_call', 'Call is no longer active', 409);
  }

  await createCallActivityForSession(updatedSession);
  return updatedSession;
};

export const failCallSession = async ({ callId, chatId, actorId, reason = CALL_ACTIVITY_RESULT.FAILED }) => {
  return endCallSession({ callId, chatId, actorId, reason });
};

export const endActiveCallForChat = async ({ chatId, reason = CALL_ACTIVITY_RESULT.BLOCKED }) => {
  const session = await findActiveCallForChat(chatId);

  if (!session) {
    return null;
  }

  const now = new Date();
  const updatedSession = await CallSession.findOneAndUpdate(
    {
      _id: session._id,
      status: { $in: CALL_ACTIVE_STATUSES },
    },
    {
      $set: terminalPatchForStatus({
        status: reason === CALL_ACTIVITY_RESULT.BLOCKED ? CALL_STATUS.BLOCKED : CALL_STATUS.ENDED,
        reason,
        now,
        session,
      }),
    },
    { new: true }
  );

  if (updatedSession) {
    await createCallActivityForSession(updatedSession);
  }

  return updatedSession;
};

export const assertCallCanSignal = (session, actorId) => {
  assertCallParticipant(session, actorId);

  if (isCallTerminal(session)) {
    throw new CallSessionError('stale_call', 'Call is already closed', 409);
  }

  return true;
};

export const createCallActivityForSession = async (session) => {
  if (!session || !ACTIVITY_STATUSES.has(session.status)) {
    return null;
  }

  const result = session.endedReason ?? session.status;

  if (!TERMINAL_ACTIVITY_RESULTS.has(result)) {
    return null;
  }

  const existingActivity = await Message.findOne({
    chatId: session.chatId,
    'callActivity.callId': session.callId,
  });

  if (existingActivity) {
    return existingActivity;
  }

  const shouldCreateMissed = result !== CALL_ACTIVITY_RESULT.MISSED
    || (session.deliveredTo ?? []).some((userId) => idsEqual(userId, session.calleeId));

  if (!shouldCreateMissed) {
    return null;
  }

  const activity = await Message.create({
    chatId: session.chatId,
    sender: session.callerId,
    text: '',
    messageType: CALL_ACTIVITY_TYPE,
    callActivity: {
      callId: session.callId,
      callerId: session.callerId,
      calleeId: session.calleeId,
      mode: session.mode,
      result,
      startedAt: session.startedAt,
      ringingAt: session.ringingAt,
      answeredAt: session.answeredAt,
      endedAt: session.endedAt,
      durationSeconds: session.durationSeconds,
    },
    status: 'delivered',
    deliveredAt: session.endedAt ?? new Date(),
  });

  return activity;
};

export const serializeCallActivityMessage = (message) => serializeMessage(message);
