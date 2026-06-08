import { Server } from 'socket.io'
import User from '../Models/userModel.mjs'
import Message from '../Models/messageModel.mjs'
import Chats from '../Models/chatModel.mjs'
import { readAccessTokenFromCookieHeader, verifyAccessToken } from '../Utils/authToken.mjs'
import { assertChatMember, assertMessageChatMember, normalizeObjectId } from '../Utils/chatAccess.mjs'

let io
const isProd = process.env.NODE_ENV === 'production'

// Track online users: Map<socketId, userId>
const socketToUser = new Map()
// Track user to sockets: Map<userId, Set<socketId>>
const userToSockets = new Map()
// Single-process presence state. Use a Redis adapter/shared state before horizontal Socket.IO scaling.
const offlineTimers = new Map()
const OFFLINE_DEBOUNCE_MS = 4000

// Debug logging helper - only logs in development
const debugLog = (...args) => {
  if (!isProd) {
    console.log(...args)
  }
}

const getCorsOrigin = () => {
  if (isProd) {
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
}

const socketEventWindows = new Map()

const getAllowedSocketOrigins = () => {
  const origins = [getCorsOrigin()]
    .filter(Boolean)
    .map(origin => origin.trim())
    .filter(Boolean)

  return new Set(origins)
}

const isAllowedSocketRequest = (request) => {
  const origin = request.headers.origin

  if (!origin) {
    return !isProd
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
  } catch {
    next(createSocketAuthError('socket_auth_invalid', 'Socket authentication invalid'))
  }
}

// Helper to get user's chat rooms
const getUserChatRooms = async (userId) => {
  try {
    const chats = await Chats.find({ members: userId }).select('_id members')
    return chats
  } catch (err) {
    console.error('📛 Error getting user chats:', err)
    return []
  }
}

const formatUserStatus = (user, isOnline, lastSeen = null) => {
  const payload = {
    userId: user._id.toString(),
    userName: `${user.firstName} ${user.lastName || ''}`.trim(),
    isOnline,
  }

  if (!isOnline && lastSeen) {
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

  return Array.from(contactIds)
}

const getAuthorizedPresenceSnapshot = async (userId) => {
  const contactIds = await getAuthorizedContactIds(userId)

  if (contactIds.length === 0) {
    return []
  }

  const contacts = await User.find({
    _id: { $in: contactIds },
    isOnline: true,
    showOnlineStatus: true,
  }).select('firstName lastName isOnline lastSeen showOnlineStatus')

  return contacts.map(contact => formatUserStatus(contact, true, contact.lastSeen))
}

const clearOfflineTimer = (userId) => {
  const normalizedUserId = userId.toString()
  const timer = offlineTimers.get(normalizedUserId)

  if (timer) {
    clearTimeout(timer)
    offlineTimers.delete(normalizedUserId)
  }
}

// Helper to broadcast user status to authorized contacts only.
const broadcastUserStatus = async (userId, isOnline, lastSeen = null) => {
  try {
    const user = await User.findById(userId).select('firstName lastName showOnlineStatus')
    
    if (!user || !user.showOnlineStatus) {
      return // User has privacy enabled, don't broadcast
    }

    const statusPayload = formatUserStatus(user, isOnline, lastSeen)
    const contactIds = await getAuthorizedContactIds(userId)

    contactIds.forEach(contactId => {
      emitToUserSockets(contactId, 'user:status-change', statusPayload)
    })

    debugLog(`📡 Broadcasted status for ${user.firstName}: ${isOnline ? 'online' : 'offline'}`)
  } catch (err) {
    console.error('📛 Error broadcasting user status:', err)
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
    console.error('📛 Error updating user online status:', err)
    return null
  }
}

const scheduleOfflineTransition = (userId) => {
  const normalizedUserId = userId.toString()
  clearOfflineTimer(normalizedUserId)

  const timer = setTimeout(async () => {
    offlineTimers.delete(normalizedUserId)

    if (getUserSockets(normalizedUserId).size > 0) {
      return
    }

    const lastSeen = await setUserOnline(normalizedUserId, false)
    await broadcastUserStatus(normalizedUserId, false, lastSeen)
  }, OFFLINE_DEBOUNCE_MS)

  offlineTimers.set(normalizedUserId, timer)
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
    debugLog(`🔌 Socket connected: ${socket.id}`)

    const userId = socket.data.userId
    const userHadSockets = getUserSockets(userId).size > 0
    const reconnectingDuringDebounce = offlineTimers.has(userId)
    clearOfflineTimer(userId)

    socketToUser.set(socket.id, userId)

    if (!userToSockets.has(userId)) {
      userToSockets.set(userId, new Set())
    }
    userToSockets.get(userId).add(socket.id)

    const userChats = await getUserChatRooms(userId)
    userChats.forEach(chat => {
      socket.join(chat._id.toString())
      debugLog(`📥 Auto-joined socket ${socket.id} to chat: ${chat._id}`)
    })

    await setUserOnline(userId, true)
    if (!userHadSockets && !reconnectingDuringDebounce) {
      await broadcastUserStatus(userId, true)
    }

    const readyPayload = {
      userId,
      socketId: socket.id,
      joinedChats: userChats.length,
      presence: await getAuthorizedPresenceSnapshot(userId),
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
        debugLog(`📥 Socket ${socket.id} joining chat: ${roomId}`)
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
          debugLog(`📤 Socket ${socket.id} leaving chat: ${roomId}`)
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

    // Handle message delivered event
    socket.on('message:delivered', async ({ messageId } = {}, ack) => {
      if (!guardSocketEventRateLimit(socket, 'message:delivered', ack)) return

      try {
        const { message, chat } = await assertMessageChatMember({
          messageId,
          userId: socket.data.userId,
        })

        if (message.sender.toString() === socket.data.userId) {
          if (typeof ack === 'function') {
            ack(respondSocketSuccess('message:delivered', { messageId: message._id.toString() }))
          }
          return
        }

        if (message.status === 'sent') {
          message.status = 'delivered'
          message.deliveredAt = new Date()
          await message.save()

          io.to(chat._id.toString()).emit('message:status-update', {
            messageId: message._id,
            status: 'delivered',
            deliveredAt: message.deliveredAt,
          })
        }

        if (typeof ack === 'function') {
          ack(respondSocketSuccess('message:delivered', { messageId: message._id.toString() }))
        }
      } catch (err) {
        respondSocketError(socket, 'message:delivered', err, ack)
      }
    })

    // Handle typing events
    socket.on('typing:start', async ({ chatId } = {}, ack) => {
      if (!guardSocketEventRateLimit(socket, 'typing:start', ack)) return

      try {
        const chat = await assertChatMember({ chatId, userId: socket.data.userId })
        const user = await User.findById(socket.data.userId).select('firstName lastName')
        if (!user) return

        socket.to(chat._id.toString()).emit('user:typing', {
          chatId: chat._id.toString(),
          userId: socket.data.userId,
          userName: `${user.firstName} ${user.lastName || ''}`.trim(),
          isTyping: true,
        })

        if (typeof ack === 'function') {
          ack(respondSocketSuccess('typing:start', { chatId: chat._id.toString() }))
        }
      } catch (err) {
        respondSocketError(socket, 'typing:start', err, ack)
      }
    })

    socket.on('typing:stop', async ({ chatId } = {}, ack) => {
      if (!guardSocketEventRateLimit(socket, 'typing:stop', ack)) return

      try {
        const chat = await assertChatMember({ chatId, userId: socket.data.userId })
        const user = await User.findById(socket.data.userId).select('firstName lastName')
        if (!user) return

        socket.to(chat._id.toString()).emit('user:typing', {
          chatId: chat._id.toString(),
          userId: socket.data.userId,
          userName: `${user.firstName} ${user.lastName || ''}`.trim(),
          isTyping: false,
        })

        if (typeof ack === 'function') {
          ack(respondSocketSuccess('typing:stop', { chatId: chat._id.toString() }))
        }
      } catch (err) {
        respondSocketError(socket, 'typing:stop', err, ack)
      }
    })

    socket.on('disconnect', async (reason) => {
      debugLog(`🔌 Socket disconnected (${socket.id}): ${reason}`)
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
            scheduleOfflineTransition(userId)
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
    // Use updateMany for better performance instead of iterating
    const result = await Message.updateMany(
      {
        chatId,
        sender: { $ne: userId },
        status: 'sent',
      },
      {
        $set: {
          status: 'delivered',
          deliveredAt: new Date(),
        },
      }
    )

    if (result.modifiedCount > 0) {
      // Fetch updated messages to emit events
      const updatedMessages = await Message.find({
        chatId,
        sender: { $ne: userId },
        status: 'delivered',
        deliveredAt: { $gte: new Date(Date.now() - 1000) }, // Messages updated in last second
      }).select('_id deliveredAt')

      updatedMessages.forEach(message => {
        io.to(chatId.toString()).emit('message:status-update', {
          messageId: message._id,
          status: 'delivered',
          deliveredAt: message.deliveredAt,
        })
      })
    }
  } catch (err) {
    console.error('📛 Error marking messages as delivered:', err)
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
  return userToSockets.has(userId) && userToSockets.get(userId).size > 0
}

export const getOnlineUsers = () => {
  return Array.from(userToSockets.keys())
}

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

// Join a user to a specific chat room (used when new chat is created)
export const joinUserToChat = (userId, chatId) => {
  const userSockets = userToSockets.get(userId.toString())
  if (userSockets && userSockets.size > 0) {
    userSockets.forEach(socketId => {
      const socket = io.sockets.sockets.get(socketId)
      if (socket) {
        socket.join(chatId.toString())
        debugLog(`📥 Joined user ${userId} (socket ${socketId}) to new chat: ${chatId}`)
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
        debugLog(`📤 Removed user ${userId} (socket ${socketId}) from chat: ${chatId}`)
      }
    })
    return true
  }
  return false
}

export const closeSocketServer = async () => {
  if (!io) {
    offlineTimers.forEach(timer => clearTimeout(timer))
    offlineTimers.clear()
    socketToUser.clear()
    userToSockets.clear()
    socketEventWindows.clear()
    return
  }

  const currentIO = io
  io = undefined
  offlineTimers.forEach(timer => clearTimeout(timer))
  offlineTimers.clear()
  socketToUser.clear()
  userToSockets.clear()
  socketEventWindows.clear()

  await new Promise((resolve) => {
    currentIO.close(() => resolve())
  })
}
