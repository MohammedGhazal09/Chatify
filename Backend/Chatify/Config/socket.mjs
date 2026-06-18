import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import User from '../Models/userModel.mjs'
import Message from '../Models/messageModel.mjs'
import Chats from '../Models/chatModel.mjs'
import { readAccessTokenFromCookieHeader, verifyAccessToken } from '../Utils/authToken.mjs'
import { assertChatMember, assertMessageChatMember, normalizeObjectId } from '../Utils/chatAccess.mjs'
import { getCallIceConfig } from '../Utils/callIceConfig.mjs'
import { logger } from '../Utils/observabilityLogger.mjs'
import {
  CALL_SOCKET_EVENTS,
  buildCallSessionPayload,
  emitCallAck,
  emitCallError,
} from '../Utils/callSocketContract.mjs'
import {
  CALL_ACTIVITY_RESULT,
  CALL_STATUS,
  CallSessionError,
  acceptCallSession,
  assertCallCanSignal,
  createCallActivityForSession,
  endActiveCallForChat,
  endCallSession,
  findActiveCallForUser,
  findActiveCallForUserInChat,
  getCallPeerForParticipant,
  getCallPeerId,
  getGroupCallRecipientIds,
  loadCallSessionForAction,
  normalizeCallMode,
  rejectCallSession,
  startCallSession,
  timeoutCallSession,
  toCallSocketError,
} from '../Utils/callSessionState.mjs'
import {
  assertConversationActivityAllowed,
  filterUnblockedContactIds,
  isConversationActivityAllowed,
  toSocketAccessError,
} from '../Utils/conversationControls.mjs'
import {
  buildStatusPatch,
  MESSAGE_STATUS,
  serializeMessage,
} from '../Utils/messageState.mjs'

let io
const isProductionRuntime = () => process.env.NODE_ENV === 'production'

// Track online users: Map<socketId, userId>
const socketToUser = new Map()
// Track user to sockets: Map<userId, Set<socketId>>
const userToSockets = new Map()
// Single-process presence state. Use a Redis adapter/shared state before horizontal Socket.IO scaling.
const callTimeoutTimers = new Map()
const callDisconnectTimers = new Map()
const DEFAULT_CALL_DISCONNECT_GRACE_MS = 15_000
const MAX_SIGNAL_SDP_LENGTH = 128_000
const MAX_ICE_CANDIDATE_LENGTH = 8_000
const MAX_ICE_TOKEN_LENGTH = 256

const debugLog = (event, metadata = {}) => {
  if (!isProductionRuntime()) {
    logger.debug(event, metadata)
  }
}

const getCorsOrigin = () => {
  if (isProductionRuntime()) {
    return process.env.FRONTEND_ORIGIN
  } else {
    return process.env.FRONTEND_ORIGIN_DEV || 'http://localhost:5173'
  }
}

const createSocketAuthError = (code, message) => {
  const error = new Error(message)
  error.data = { code }
  return error
}

const socketErrorMessages = {
  invalid_payload: 'Invalid socket payload',
  forbidden_or_not_found: 'Forbidden or not found',
  conversation_blocked: 'Conversation activity is not available',
  deprecated_socket_message_send: 'Send messages through the HTTP message API',
  rate_limited: 'Too many socket events',
  server_error: 'Socket event failed',
}

const socketEventLimits = {
  'chat:join': { max: 20, windowMs: 10_000 },
  'chat:leave': { max: 30, windowMs: 10_000 },
  'message:delivered': { max: 40, windowMs: 10_000 },
  'typing:start': { max: 30, windowMs: 10_000 },
  'typing:stop': { max: 30, windowMs: 10_000 },
  'call:start': { max: 8, windowMs: 60_000 },
  'call:accept': { max: 20, windowMs: 60_000 },
  'call:reject': { max: 20, windowMs: 60_000 },
  'call:end': { max: 30, windowMs: 60_000 },
  'call:offer': { max: 60, windowMs: 60_000 },
  'call:answer': { max: 60, windowMs: 60_000 },
  'call:ice-candidate': { max: 240, windowMs: 60_000 },
  'call:sync': { max: 30, windowMs: 60_000 },
}

const socketEventWindows = new Map()

const logDeliveryLifecycle = (stage, metadata = {}) => {
  if (process.env.CHATIFY_DELIVERY_DIAGNOSTICS !== '1') {
    return
  }

  logger.info('socket.delivery.lifecycle', { stage, ...metadata })
}

const getAllowedSocketOrigins = () => {
  const origins = [getCorsOrigin()]
    .filter(Boolean)
    .map(origin => origin.trim())
    .filter(Boolean)

  return new Set(origins)
}

const getHeaderValues = (headerValue) => {
  if (!headerValue) {
    return []
  }

  const values = Array.isArray(headerValue) ? headerValue : [headerValue]

  return values
    .flatMap(value => value.split(','))
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)
}

const getOriginHost = (origin) => {
  try {
    return new URL(origin).host.toLowerCase()
  } catch {
    return null
  }
}

const getAllowedSocketOriginHosts = () => new Set(
  [...getAllowedSocketOrigins()]
    .map(getOriginHost)
    .filter(Boolean)
)

const isTrustedSameOriginProxyRequest = (request) => {
  const allowedHosts = getAllowedSocketOriginHosts()

  if (allowedHosts.size === 0) {
    return false
  }

  const forwardedHosts = [
    ...getHeaderValues(request.headers['x-forwarded-host']),
    ...getHeaderValues(request.headers.host),
  ]
  const forwardedProtos = getHeaderValues(request.headers['x-forwarded-proto'])
  const hasAllowedHost = forwardedHosts.some(host => allowedHosts.has(host))
  const hasAllowedProto = forwardedProtos.length === 0 || forwardedProtos.includes('https')

  return hasAllowedHost && hasAllowedProto
}

const isAllowedSocketRequest = (request) => {
  const origin = request.headers.origin

  if (!origin) {
    return !isProductionRuntime() || isTrustedSameOriginProxyRequest(request)
  }

  return getAllowedSocketOrigins().has(origin)
}

const allowSocketRequest = (request, callback) => {
  if (isAllowedSocketRequest(request)) {
    callback(null, true)
    return
  }

  callback('Socket origin not allowed', false)
}

const getSocketEventWindowKey = (socket, event) => `${socket.id}:${event}`

const clearSocketEventWindows = (socket) => {
  const prefix = `${socket.id}:`

  for (const key of socketEventWindows.keys()) {
    if (key.startsWith(prefix)) {
      socketEventWindows.delete(key)
    }
  }
}

const guardSocketEventRateLimit = (socket, event, ack) => {
  const limit = socketEventLimits[event]

  if (!limit) {
    return true
  }

  const now = Date.now()
  const key = getSocketEventWindowKey(socket, event)
  const currentWindow = socketEventWindows.get(key)

  if (!currentWindow || now >= currentWindow.resetAt) {
    socketEventWindows.set(key, {
      count: 1,
      resetAt: now + limit.windowMs,
    })
    return true
  }

  if (currentWindow.count >= limit.max) {
    respondSocketError(socket, event, { code: 'rate_limited' }, ack)
    return false
  }

  currentWindow.count += 1
  return true
}

const clearCallTimeout = (callId) => {
  const timeout = callTimeoutTimers.get(callId)

  if (timeout) {
    clearTimeout(timeout)
    callTimeoutTimers.delete(callId)
  }
}

const getCallDisconnectGraceMs = () => {
  const parsed = Number.parseInt(process.env.CHATIFY_CALL_DISCONNECT_GRACE_MS ?? '', 10)

  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_CALL_DISCONNECT_GRACE_MS
}

const clearCallDisconnectTimer = (userId) => {
  const normalizedUserId = userId.toString()
  const timeout = callDisconnectTimers.get(normalizedUserId)

  if (timeout) {
    clearTimeout(timeout)
    callDisconnectTimers.delete(normalizedUserId)
  }
}

const emitCallActivity = async (session) => {
  const activity = await createCallActivityForSession(session)

  if (!activity) {
    return null
  }

  io?.in(session.chatId.toString()).emit('message:new', serializeMessage(activity))
  return activity
}

const emitCallSyncToParticipants = (session, extra = {}) => {
  const payload = buildCallSessionPayload(session, extra)
  const participantIds = new Set([
    session.callerId?.toString(),
    session.calleeId?.toString(),
    session.acceptedBy?.toString(),
    ...(session.participantIds ?? []).map((userId) => userId.toString()),
    ...(session.deliveredTo ?? []).map((userId) => userId.toString()),
  ].filter(Boolean))

  participantIds.forEach((participantId) => {
    emitToUserSockets(participantId, CALL_SOCKET_EVENTS.SYNC, payload)
  })
  return payload
}

const scheduleCallTimeout = (session) => {
  clearCallTimeout(session.callId)

  const timeout = setTimeout(async () => {
    callTimeoutTimers.delete(session.callId)

    try {
      const timedOutSession = await timeoutCallSession({ callId: session.callId })

      if (timedOutSession) {
        emitCallSyncToParticipants(timedOutSession)
        await emitCallActivity(timedOutSession)
      }
    } catch (error) {
      logger.error('call.timeout_failed', { callId: session.callId, error })
    }
  }, 30_000)

  callTimeoutTimers.set(session.callId, timeout)
}

const scheduleCallDisconnectCleanup = (userId) => {
  const normalizedUserId = userId.toString()
  clearCallDisconnectTimer(normalizedUserId)

  const timeout = setTimeout(async () => {
    callDisconnectTimers.delete(normalizedUserId)

    if (getUserSockets(normalizedUserId).size > 0) {
      return
    }

    try {
      const activeSession = await findActiveCallForUser(normalizedUserId)

      if (!activeSession) {
        return
      }

      const failedSession = await endCallSession({
        callId: activeSession.callId,
        chatId: activeSession.chatId,
        actorId: normalizedUserId,
        reason: CALL_ACTIVITY_RESULT.FAILED,
      })

      clearCallTimeout(failedSession.callId)
      emitCallSyncToParticipants(failedSession)
      await emitCallActivity(failedSession)
    } catch (error) {
      logger.error('call.disconnect_cleanup_failed', {
        userId: normalizedUserId,
        error,
      })
    }
  }, getCallDisconnectGraceMs())

  callDisconnectTimers.set(normalizedUserId, timeout)
}

const isPlainObject = (value) => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const assertBoundedString = ({ value, maxLength, allowEmpty = false }) => {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0) || value.length > maxLength) {
    throw new CallSessionError('invalid_call_signal', 'Invalid call signal', 400)
  }

  return value
}

const validateSessionDescriptionSignal = ({ event, signal }) => {
  if (!isPlainObject(signal)) {
    throw new CallSessionError('invalid_call_signal', 'Invalid call signal', 400)
  }

  const expectedType = event === CALL_SOCKET_EVENTS.OFFER ? 'offer' : 'answer'

  if (signal.type !== expectedType) {
    throw new CallSessionError('invalid_call_signal', 'Invalid call signal', 400)
  }

  return {
    type: expectedType,
    sdp: assertBoundedString({ value: signal.sdp, maxLength: MAX_SIGNAL_SDP_LENGTH }),
  }
}

const validateIceCandidateSignal = (signal) => {
  if (!isPlainObject(signal)) {
    throw new CallSessionError('invalid_call_signal', 'Invalid call signal', 400)
  }

  const candidate = assertBoundedString({
    value: signal.candidate,
    maxLength: MAX_ICE_CANDIDATE_LENGTH,
    allowEmpty: true,
  })
  const normalizedSignal = { candidate }

  if (signal.sdpMid !== undefined && signal.sdpMid !== null) {
    normalizedSignal.sdpMid = assertBoundedString({
      value: signal.sdpMid,
      maxLength: MAX_ICE_TOKEN_LENGTH,
      allowEmpty: true,
    })
  }

  if (signal.sdpMLineIndex !== undefined && signal.sdpMLineIndex !== null) {
    if (!Number.isInteger(signal.sdpMLineIndex) || signal.sdpMLineIndex < 0 || signal.sdpMLineIndex > 1024) {
      throw new CallSessionError('invalid_call_signal', 'Invalid call signal', 400)
    }

    normalizedSignal.sdpMLineIndex = signal.sdpMLineIndex
  }

  if (signal.usernameFragment !== undefined && signal.usernameFragment !== null) {
    normalizedSignal.usernameFragment = assertBoundedString({
      value: signal.usernameFragment,
      maxLength: MAX_ICE_TOKEN_LENGTH,
      allowEmpty: true,
    })
  }

  return normalizedSignal
}

const validateCallSignal = ({ event, signal }) => {
  if (event === CALL_SOCKET_EVENTS.OFFER || event === CALL_SOCKET_EVENTS.ANSWER) {
    return validateSessionDescriptionSignal({ event, signal })
  }

  if (event === CALL_SOCKET_EVENTS.ICE_CANDIDATE) {
    return validateIceCandidateSignal(signal)
  }

  throw new CallSessionError('invalid_call_signal', 'Invalid call signal', 400)
}

const loadAuthorizedCall = async ({ callId, chatId, actorId }) => {
  const session = await loadCallSessionForAction({ callId, chatId, actorId })
  const chat = await assertChatMember({ chatId: session.chatId, userId: actorId })

  await assertConversationActivityAllowed({ chat, actorId })
  assertCallCanSignal(session, actorId)

  return { session, chat }
}

const forwardCallSignalToPeer = async ({ socket, event, payload = {}, ack }) => {
  if (!guardSocketEventRateLimit(socket, event, ack)) return

  try {
    const safePayload = isPlainObject(payload) ? payload : {}
    const { callId, chatId } = safePayload
    const signal = validateCallSignal({ event, signal: safePayload.signal })
    const { session } = await loadAuthorizedCall({
      callId,
      chatId,
      actorId: socket.data.userId,
    })
    const peerId = getCallPeerForParticipant(session, socket.data.userId)
    const forwardedPayload = {
      callId: session.callId,
      chatId: session.chatId.toString(),
      fromUserId: socket.data.userId,
      signal,
    }

    emitToUserSockets(peerId, event, forwardedPayload)
    emitCallAck(ack, event, {
      callId: session.callId,
      chatId: session.chatId.toString(),
      status: session.status,
    })
  } catch (err) {
    emitCallError(socket, event, toCallSocketError(err), ack)
  }
}

export const respondSocketError = (socket, event, error, ack) => {
  const code = error?.code ?? 'server_error'
  const payload = {
    ok: false,
    code,
    event,
    message: socketErrorMessages[code] ?? socketErrorMessages.server_error,
  }

  if (typeof ack === 'function') {
    ack(payload)
    return payload
  }

  socket.emit('socket:error', payload)
  return payload
}

const respondSocketSuccess = (event, data = {}) => ({
  ok: true,
  event,
  ...data,
})

const authenticateSocket = (socket, next) => {
  const token = readAccessTokenFromCookieHeader(socket.handshake.headers.cookie)

  if (!token) {
    return next(createSocketAuthError('socket_auth_required', 'Socket authentication required'))
  }

  try {
    const { userId } = verifyAccessToken(token)
    socket.data.userId = userId
    next()
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(createSocketAuthError('socket_auth_expired', 'Socket authentication expired'))
      return
    }

    next(createSocketAuthError('socket_auth_invalid', 'Socket authentication invalid'))
  }
}

// Helper to get user's chat rooms
const getUserChatRooms = async (userId) => {
  try {
    const chats = await Chats.find({ members: userId }).select('_id members')
    return chats
  } catch (err) {
    logger.error('socket.user_chats_load_failed', {
      userId,
      error: err,
    })
    return []
  }
}

const formatUserStatus = (user, isOnline, lastSeen = null) => {
  const isVisibleOnline = user.showOnlineStatus !== false && isOnline === true
  const isCallReachable = isVisibleOnline && getUserSockets(user._id).size > 0
  const payload = {
    userId: user._id.toString(),
    username: user.username ?? '',
    userName: `${user.firstName} ${user.lastName || ''}`.trim(),
    isOnline: isVisibleOnline,
    isCallReachable,
  }

  if (!isVisibleOnline && user.showLastSeen !== false && lastSeen) {
    payload.lastSeen = lastSeen instanceof Date ? lastSeen.toISOString() : lastSeen
  }

  return payload
}

const getAuthorizedContactIds = async (userId) => {
  const chats = await getUserChatRooms(userId)
  const contactIds = new Set()
  const normalizedUserId = userId.toString()

  chats.forEach(chat => {
    chat.members.forEach(memberId => {
      const contactId = memberId.toString()
      if (contactId !== normalizedUserId) {
        contactIds.add(contactId)
      }
    })
  })

  return filterUnblockedContactIds({
    userId,
    contactIds: Array.from(contactIds),
  })
}

const getAuthorizedPresenceSnapshot = async (userId) => {
  const contactIds = await getAuthorizedContactIds(userId)

  if (contactIds.length === 0) {
    return []
  }

  const contacts = await User.find({
    _id: { $in: contactIds },
  }).select('username firstName lastName isOnline lastSeen showOnlineStatus showLastSeen')

  return contacts.map(contact => formatUserStatus(
    contact,
    contact.showOnlineStatus !== false && contact.isOnline === true,
    contact.showLastSeen !== false && contact.isOnline !== true ? contact.lastSeen : null
  ))
}

// Helper to broadcast user status to authorized contacts only.
const broadcastUserStatus = async (userId, isOnline, lastSeen = null) => {
  try {
    const user = await User.findById(userId).select('username firstName lastName showOnlineStatus')
    
    if (!user || !user.showOnlineStatus) {
      return // User has privacy enabled, don't broadcast
    }

    const statusPayload = formatUserStatus(user, isOnline, lastSeen)
    const contactIds = await getAuthorizedContactIds(userId)

    contactIds.forEach(contactId => {
      emitToUserSockets(contactId, 'user:status-change', statusPayload)
    })

    debugLog('socket.presence_broadcasted', {
      userId: user._id.toString(),
      isOnline,
      contactCount: contactIds.length,
    })
  } catch (err) {
    logger.error('socket.presence_broadcast_failed', {
      userId,
      isOnline,
      error: err,
    })
  }
}

// Set user online status in database
const setUserOnline = async (userId, isOnline) => {
  try {
    const updateData = { isOnline }
    if (!isOnline) {
      updateData.lastSeen = new Date()
    }
    await User.findByIdAndUpdate(userId, updateData)
    return updateData.lastSeen ?? null
  } catch (err) {
    logger.error('socket.user_online_update_failed', {
      userId,
      isOnline,
      error: err,
    })
    return null
  }
}

const transitionUserOffline = async (userId) => {
  const normalizedUserId = userId.toString()

  if (getUserSockets(normalizedUserId).size > 0) {
    return
  }

  const lastSeen = await setUserOnline(normalizedUserId, false)
  await broadcastUserStatus(normalizedUserId, false, lastSeen)
}

export const initSocket = (server) => {
  if (io) {
    return io
  }

  io = new Server(server, {
    allowRequest: allowSocketRequest,
    cors: {
      origin: getCorsOrigin(),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    },
  })

  io.use(authenticateSocket)

  io.on('connection', async (socket) => {
    debugLog('socket.connected', { socketId: socket.id })

    const userId = socket.data.userId
    const userHadSockets = getUserSockets(userId).size > 0
    clearCallDisconnectTimer(userId)

    socketToUser.set(socket.id, userId)

    if (!userToSockets.has(userId)) {
      userToSockets.set(userId, new Set())
    }
    userToSockets.get(userId).add(socket.id)

    const userChats = await getUserChatRooms(userId)
    userChats.forEach(chat => {
      socket.join(chat._id.toString())
      debugLog('socket.auto_joined_chat', {
        socketId: socket.id,
        chatId: chat._id.toString(),
      })
    })

    await setUserOnline(userId, true)
    if (!userHadSockets) {
      await broadcastUserStatus(userId, true)
    }

    const readyPayload = {
      userId,
      socketId: socket.id,
      joinedChats: userChats.length,
      presence: await getAuthorizedPresenceSnapshot(userId),
      callConfig: getCallIceConfig(),
    }
    socket.emit('socket:ready', readyPayload)
    socket.emit('user:connected', readyPayload)

    // Compatibility no-op. Identity is already verified during the Socket.IO handshake.
    socket.on('user:connect', (_claimedUserId, ack) => {
      const payload = {
        ok: false,
        code: 'identity_already_verified',
        message: 'Socket identity is verified during handshake',
      }

      if (typeof ack === 'function') {
        ack(payload)
        return
      }

      socket.emit('socket:error', { ...payload, event: 'user:connect' })
    })

    socket.on('chat:join', async (chatId, ack) => {
      if (!guardSocketEventRateLimit(socket, 'chat:join', ack)) return

      try {
        const chat = await assertChatMember({ chatId, userId: socket.data.userId })
        const roomId = chat._id.toString()
        debugLog('socket.joining_chat', {
          socketId: socket.id,
          chatId: roomId,
        })
        socket.join(roomId)

        await markMessagesAsDelivered(roomId, socket.data.userId)

        if (typeof ack === 'function') {
          ack(respondSocketSuccess('chat:join', { chatId: roomId }))
        }
      } catch (err) {
        respondSocketError(socket, 'chat:join', err, ack)
      }
    })

    socket.on('chat:leave', (chatId, ack) => {
      if (!guardSocketEventRateLimit(socket, 'chat:leave', ack)) return

      try {
        const roomId = normalizeObjectId(chatId).toString()

        if (socket.rooms.has(roomId)) {
          debugLog('socket.leaving_chat', {
            socketId: socket.id,
            chatId: roomId,
          })
          socket.leave(roomId)
        }

        if (typeof ack === 'function') {
          ack(respondSocketSuccess('chat:leave', { chatId: roomId }))
        }
      } catch (err) {
        respondSocketError(socket, 'chat:leave', err, ack)
      }
    })

    socket.on('message:send', (_payload, ack) => {
      respondSocketError(
        socket,
        'message:send',
        { code: 'deprecated_socket_message_send' },
        ack
      )
    })

    socket.on(CALL_SOCKET_EVENTS.START, async ({ chatId, mode } = {}, ack) => {
      const event = CALL_SOCKET_EVENTS.START
      if (!guardSocketEventRateLimit(socket, event, ack)) return

      try {
        const chat = await assertChatMember({ chatId, userId: socket.data.userId })
        const normalizedMode = normalizeCallMode(mode)
        const recipientIds = chat.isGroupChat
          ? getGroupCallRecipientIds({ chat, userId: socket.data.userId })
          : [getCallPeerId({ chat, userId: socket.data.userId })]
        const reachableRecipientIds = recipientIds.filter((recipientId) => (
          getUserSockets(recipientId).size > 0
        ))

        if (reachableRecipientIds.length === 0) {
          emitCallError(socket, event, { code: 'callee_unavailable' }, ack)
          return
        }

        const session = await startCallSession({
          chat,
          callerId: socket.data.userId,
          mode: normalizedMode,
          recipientIds: reachableRecipientIds,
          deliveredTo: reachableRecipientIds,
        })
        const incomingPayload = buildCallSessionPayload(session, {
          fromUserId: socket.data.userId,
          callConfig: getCallIceConfig(),
        })
        const emittedCount = reachableRecipientIds.reduce((count, recipientId) => (
          count + emitToUserSockets(recipientId, CALL_SOCKET_EVENTS.INCOMING, incomingPayload)
        ), 0)

        if (emittedCount === 0) {
          const failedSession = await endCallSession({
            callId: session.callId,
            chatId: chat._id,
            actorId: socket.data.userId,
            reason: CALL_ACTIVITY_RESULT.FAILED,
          })

          clearCallTimeout(session.callId)
          emitCallSyncToParticipants(failedSession)
          emitCallError(socket, event, { code: 'callee_unavailable' }, ack)
          return
        }

        scheduleCallTimeout(session)
        emitCallSyncToParticipants(session)
        emitCallAck(ack, event, {
          ...buildCallSessionPayload(session),
          callConfig: getCallIceConfig(),
        })
      } catch (err) {
        emitCallError(socket, event, toCallSocketError(err), ack)
      }
    })

    socket.on(CALL_SOCKET_EVENTS.ACCEPT, async ({ callId, chatId } = {}, ack) => {
      const event = CALL_SOCKET_EVENTS.ACCEPT
      if (!guardSocketEventRateLimit(socket, event, ack)) return

      try {
        const existingSession = await loadCallSessionForAction({
          callId,
          chatId,
          actorId: socket.data.userId,
        })
        const chat = await assertChatMember({ chatId: existingSession.chatId, userId: socket.data.userId })
        await assertConversationActivityAllowed({ chat, actorId: socket.data.userId })
        const session = await acceptCallSession({
          callId,
          chatId: existingSession.chatId,
          actorId: socket.data.userId,
        })

        clearCallTimeout(session.callId)
        emitCallSyncToParticipants(session)
        emitToUserSockets(session.callerId, CALL_SOCKET_EVENTS.ACCEPT, buildCallSessionPayload(session, {
          fromUserId: socket.data.userId,
        }))
        emitCallAck(ack, event, buildCallSessionPayload(session))
      } catch (err) {
        emitCallError(socket, event, toCallSocketError(err), ack)
      }
    })

    socket.on(CALL_SOCKET_EVENTS.REJECT, async ({ callId, chatId } = {}, ack) => {
      const event = CALL_SOCKET_EVENTS.REJECT
      if (!guardSocketEventRateLimit(socket, event, ack)) return

      try {
        const existingSession = await loadCallSessionForAction({
          callId,
          chatId,
          actorId: socket.data.userId,
        })
        const chat = await assertChatMember({ chatId: existingSession.chatId, userId: socket.data.userId })
        await assertConversationActivityAllowed({ chat, actorId: socket.data.userId })
        const session = await rejectCallSession({
          callId,
          chatId: existingSession.chatId,
          actorId: socket.data.userId,
        })

        clearCallTimeout(session.callId)
        emitCallSyncToParticipants(session)
        await emitCallActivity(session)
        emitCallAck(ack, event, buildCallSessionPayload(session))
      } catch (err) {
        emitCallError(socket, event, toCallSocketError(err), ack)
      }
    })

    socket.on(CALL_SOCKET_EVENTS.END, async ({ callId, chatId, reason } = {}, ack) => {
      const event = CALL_SOCKET_EVENTS.END
      if (!guardSocketEventRateLimit(socket, event, ack)) return

      try {
        const existingSession = await loadCallSessionForAction({
          callId,
          chatId,
          actorId: socket.data.userId,
        })
        const session = await endCallSession({
          callId,
          chatId: existingSession.chatId,
          actorId: socket.data.userId,
          reason: reason === CALL_ACTIVITY_RESULT.FAILED
            ? CALL_ACTIVITY_RESULT.FAILED
            : CALL_ACTIVITY_RESULT.ENDED,
        })

        clearCallTimeout(session.callId)
        emitCallSyncToParticipants(session)
        await emitCallActivity(session)
        emitCallAck(ack, event, buildCallSessionPayload(session))
      } catch (err) {
        emitCallError(socket, event, toCallSocketError(err), ack)
      }
    })

    socket.on(CALL_SOCKET_EVENTS.SYNC, async ({ chatId } = {}, ack) => {
      const event = CALL_SOCKET_EVENTS.SYNC
      if (!guardSocketEventRateLimit(socket, event, ack)) return

      try {
        const chat = await assertChatMember({ chatId, userId: socket.data.userId })
        const session = await findActiveCallForUserInChat(socket.data.userId, chat._id)

        emitCallAck(ack, event, {
          chatId: chat._id.toString(),
          call: session ? buildCallSessionPayload(session) : null,
          callConfig: getCallIceConfig(),
        })
      } catch (err) {
        emitCallError(socket, event, toCallSocketError(err), ack)
      }
    })

    socket.on(CALL_SOCKET_EVENTS.OFFER, (payload, ack) => {
      forwardCallSignalToPeer({ socket, event: CALL_SOCKET_EVENTS.OFFER, payload, ack })
    })

    socket.on(CALL_SOCKET_EVENTS.ANSWER, (payload, ack) => {
      forwardCallSignalToPeer({ socket, event: CALL_SOCKET_EVENTS.ANSWER, payload, ack })
    })

    socket.on(CALL_SOCKET_EVENTS.ICE_CANDIDATE, (payload, ack) => {
      forwardCallSignalToPeer({ socket, event: CALL_SOCKET_EVENTS.ICE_CANDIDATE, payload, ack })
    })

    // Handle message delivered event
    socket.on('message:delivered', async ({ messageId } = {}, ack) => {
      if (!guardSocketEventRateLimit(socket, 'message:delivered', ack)) return

      try {
        const { message, chat } = await assertMessageChatMember({
          messageId,
          userId: socket.data.userId,
        })

        if (message.sender.toString() === socket.data.userId) {
          logDeliveryLifecycle('delivery.self_noop', {
            chatId: chat._id.toString(),
            messageId: message._id.toString(),
            actorRole: 'sender',
            socketId: socket.id,
            status: message.status,
          })

          if (typeof ack === 'function') {
            ack(respondSocketSuccess('message:delivered', { messageId: message._id.toString() }))
          }
          return
        }

        await assertConversationActivityAllowed({
          chat,
          actorId: socket.data.userId,
        })

        logDeliveryLifecycle('delivery.ack_received', {
          chatId: chat._id.toString(),
          messageId: message._id.toString(),
          actorRole: 'recipient',
          socketId: socket.id,
          status: message.status,
        })

        const deliveredMessage = await Message.findOneAndUpdate(
          {
            _id: message._id,
            sender: { $ne: socket.data.userId },
            status: MESSAGE_STATUS.SENT,
            deletedFor: { $ne: socket.data.userId },
            deletedForEveryone: { $ne: true },
          },
          {
            $set: {
              status: MESSAGE_STATUS.DELIVERED,
              deliveredAt: new Date(),
            },
          },
          { new: true }
        )

        if (deliveredMessage) {
          logDeliveryLifecycle('delivery.status_update', {
            chatId: chat._id.toString(),
            messageId: deliveredMessage._id.toString(),
            actorRole: 'recipient',
            socketId: socket.id,
            status: deliveredMessage.status,
          })
          io.to(chat._id.toString()).emit('message:status-update', buildStatusPatch(deliveredMessage))
        }

        if (typeof ack === 'function') {
          ack(respondSocketSuccess('message:delivered', { messageId: message._id.toString() }))
        }
      } catch (err) {
        respondSocketError(socket, 'message:delivered', toSocketAccessError(err), ack)
      }
    })

    // Handle typing events
    socket.on('typing:start', async ({ chatId } = {}, ack) => {
      if (!guardSocketEventRateLimit(socket, 'typing:start', ack)) return

      try {
        const chat = await assertChatMember({ chatId, userId: socket.data.userId })
        await assertConversationActivityAllowed({
          chat,
          actorId: socket.data.userId,
        })
        const user = await User.findById(socket.data.userId).select('username firstName lastName')
        if (!user) return

        socket.to(chat._id.toString()).emit('user:typing', {
          chatId: chat._id.toString(),
          userId: socket.data.userId,
          username: user.username ?? '',
          userName: `${user.firstName} ${user.lastName || ''}`.trim(),
          isTyping: true,
        })

        if (typeof ack === 'function') {
          ack(respondSocketSuccess('typing:start', { chatId: chat._id.toString() }))
        }
      } catch (err) {
        respondSocketError(socket, 'typing:start', toSocketAccessError(err), ack)
      }
    })

    socket.on('typing:stop', async ({ chatId } = {}, ack) => {
      if (!guardSocketEventRateLimit(socket, 'typing:stop', ack)) return

      try {
        const chat = await assertChatMember({ chatId, userId: socket.data.userId })
        await assertConversationActivityAllowed({
          chat,
          actorId: socket.data.userId,
        })
        const user = await User.findById(socket.data.userId).select('username firstName lastName')
        if (!user) return

        socket.to(chat._id.toString()).emit('user:typing', {
          chatId: chat._id.toString(),
          userId: socket.data.userId,
          username: user.username ?? '',
          userName: `${user.firstName} ${user.lastName || ''}`.trim(),
          isTyping: false,
        })

        if (typeof ack === 'function') {
          ack(respondSocketSuccess('typing:stop', { chatId: chat._id.toString() }))
        }
      } catch (err) {
        respondSocketError(socket, 'typing:stop', toSocketAccessError(err), ack)
      }
    })

    socket.on('disconnect', async (reason) => {
      debugLog('socket.disconnected', {
        socketId: socket.id,
        reason,
      })
      clearSocketEventWindows(socket)
      
      const userId = socketToUser.get(socket.id)
      if (userId) {
        // Remove this socket from user's sockets
        const userSockets = userToSockets.get(userId)
        if (userSockets) {
          userSockets.delete(socket.id)
          
          // If user has no more sockets, they're offline
          if (userSockets.size === 0) {
            userToSockets.delete(userId)
            await transitionUserOffline(userId)
            scheduleCallDisconnectCleanup(userId)
          }
        }
        
        socketToUser.delete(socket.id)
      }
    })
  })

  return io
}

// Mark messages as delivered when user joins a chat
const markMessagesAsDelivered = async (chatId, userId) => {
  try {
    const chatObjectId = normalizeObjectId(chatId)
    const userObjectId = normalizeObjectId(userId)
    const chat = await Chats.findById(chatObjectId)

    if (!chat || !(await isConversationActivityAllowed({ chat, actorId: userObjectId }))) {
      return
    }

    const messages = await Message.find({
      chatId: chatObjectId,
      sender: { $ne: userObjectId },
      status: MESSAGE_STATUS.SENT,
      deletedFor: { $ne: userObjectId },
      deletedForEveryone: { $ne: true },
    })

    for (const message of messages) {
      const deliveredMessage = await Message.findOneAndUpdate(
        {
          _id: message._id,
          sender: { $ne: userObjectId },
          status: MESSAGE_STATUS.SENT,
          deletedFor: { $ne: userObjectId },
          deletedForEveryone: { $ne: true },
        },
        {
          $set: {
            status: MESSAGE_STATUS.DELIVERED,
            deliveredAt: new Date(),
          },
        },
        { new: true }
      )

      if (deliveredMessage) {
        logDeliveryLifecycle('delivery.join_sweep_update', {
          chatId: chatObjectId.toString(),
          messageId: deliveredMessage._id.toString(),
          actorRole: 'recipient',
          status: deliveredMessage.status,
        })
        io.to(chatObjectId.toString()).emit('message:status-update', buildStatusPatch(deliveredMessage))
      }
    }
  } catch (err) {
    logger.error('socket.mark_messages_delivered_failed', {
      chatId: chatId?.toString?.() ?? chatId,
      userId: userId?.toString?.() ?? userId,
      error: err,
    })
  }
}

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet')
  }

  return io
}

// Export helper functions for use in controllers
export const isUserOnline = (userId) => {
  if (!userId) {
    return false
  }

  const normalizedUserId = userId.toString()
  return userToSockets.has(normalizedUserId) && userToSockets.get(normalizedUserId).size > 0
}

export const getOnlineUsers = () => {
  return Array.from(userToSockets.keys())
}

export const getSocketOperationalStatus = () => ({
  initialized: Boolean(io),
  connectedUsers: userToSockets.size,
  connectedSockets: socketToUser.size,
  pendingCallTimeouts: callTimeoutTimers.size,
  pendingCallDisconnectCleanups: callDisconnectTimers.size,
})

// Get all sockets for a specific user
export const getUserSockets = (userId) => {
  return userToSockets.get(userId.toString()) || new Set()
}

export const emitToUserSockets = (userId, eventName, payload) => {
  const userSockets = getUserSockets(userId)
  let emittedCount = 0

  userSockets.forEach(socketId => {
    const socket = io?.sockets.sockets.get(socketId)
    if (socket) {
      socket.emit(eventName, payload)
      emittedCount += 1
    }
  })

  return emittedCount
}

export const endActiveCallForChatDueToBlock = async (chatId) => {
  const session = await endActiveCallForChat({
    chatId,
    reason: CALL_ACTIVITY_RESULT.BLOCKED,
  })

  if (!session) {
    return null
  }

  clearCallTimeout(session.callId)
  emitCallSyncToParticipants(session)
  await emitCallActivity(session)

  return buildCallSessionPayload(session)
}

// Join a user to a specific chat room (used when new chat is created)
export const joinUserToChat = (userId, chatId) => {
  const userSockets = userToSockets.get(userId.toString())
  if (userSockets && userSockets.size > 0) {
    userSockets.forEach(socketId => {
      const socket = io.sockets.sockets.get(socketId)
      if (socket) {
        socket.join(chatId.toString())
        debugLog('socket.join_user_to_chat', {
          userId: userId.toString(),
          socketId,
          chatId: chatId.toString(),
        })
      }
    })
    return true
  }
  return false
}

// Remove a user from a specific chat room (used when chat is deleted)
export const removeUserFromChat = (userId, chatId) => {
  const userSockets = userToSockets.get(userId.toString())
  if (userSockets && userSockets.size > 0) {
    userSockets.forEach(socketId => {
      const socket = io.sockets.sockets.get(socketId)
      if (socket) {
        socket.leave(chatId.toString())
        debugLog('socket.remove_user_from_chat', {
          userId: userId.toString(),
          socketId,
          chatId: chatId.toString(),
        })
      }
    })
    return true
  }
  return false
}

export const closeSocketServer = async () => {
  if (!io) {
    callTimeoutTimers.forEach(timer => clearTimeout(timer))
    callTimeoutTimers.clear()
    callDisconnectTimers.forEach(timer => clearTimeout(timer))
    callDisconnectTimers.clear()
    socketToUser.clear()
    userToSockets.clear()
    socketEventWindows.clear()
    return
  }

  const currentIO = io
  io = undefined
  callTimeoutTimers.forEach(timer => clearTimeout(timer))
  callTimeoutTimers.clear()
  callDisconnectTimers.forEach(timer => clearTimeout(timer))
  callDisconnectTimers.clear()
  socketToUser.clear()
  userToSockets.clear()
  socketEventWindows.clear()

  await new Promise((resolve) => {
    currentIO.close(() => resolve())
  })
}
