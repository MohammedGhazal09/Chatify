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
  server_error: 'Socket event failed',
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

// Helper to broadcast user status to their contacts
const broadcastUserStatus = async (userId, isOnline, lastSeen = null) => {
  try {
    const chats = await getUserChatRooms(userId)
    const user = await User.findById(userId).select('firstName lastName showOnlineStatus')
    
    if (!user || !user.showOnlineStatus) {
      return // User has privacy enabled, don't broadcast
    }

    const statusPayload = {
      userId,
      userName: `${user.firstName} ${user.lastName || ''}`.trim(),
      isOnline,
    }

    if (!isOnline && lastSeen) {
      statusPayload.lastSeen = lastSeen
    }

    // Broadcast to all chat rooms the user is in
    chats.forEach(chat => {
      io.to(chat._id.toString()).emit('user:status-change', statusPayload)
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
  } catch (err) {
    console.error('📛 Error updating user online status:', err)
  }
}

export const initSocket = (server) => {
  if (io) {
    return io
  }

  io = new Server(server, {
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
    await broadcastUserStatus(userId, true)

    const readyPayload = { userId, socketId: socket.id, joinedChats: userChats.length }
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
      
      const userId = socketToUser.get(socket.id)
      if (userId) {
        // Remove this socket from user's sockets
        const userSockets = userToSockets.get(userId)
        if (userSockets) {
          userSockets.delete(socket.id)
          
          // If user has no more sockets, they're offline
          if (userSockets.size === 0) {
            userToSockets.delete(userId)
            const lastSeen = new Date()
            await setUserOnline(userId, false)
            await broadcastUserStatus(userId, false, lastSeen)
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
    socketToUser.clear()
    userToSockets.clear()
    return
  }

  const currentIO = io
  io = undefined
  socketToUser.clear()
  userToSockets.clear()

  await new Promise((resolve) => {
    currentIO.close(() => resolve())
  })
}
