import { Server } from 'socket.io'
import User from '../Models/userModel.mjs'
import Message from '../Models/messageModel.mjs'
import Chats from '../Models/chatModel.mjs'

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

  io.on('connection', async (socket) => {
    debugLog(`🔌 Socket connected: ${socket.id}`)

    // Handle user authentication/identification
    socket.on('user:connect', async (userId) => {
      if (!userId) {
        debugLog('⚠️ No userId provided for socket connection')
        return
      }

      debugLog(`👤 User connected via socket ${socket.id}`)
      
      // Track socket-user mapping
      socketToUser.set(socket.id, userId)
      
      if (!userToSockets.has(userId)) {
        userToSockets.set(userId, new Set())
      }
      userToSockets.get(userId).add(socket.id)

      // Auto-join all user's chat rooms for real-time message reception
      const userChats = await getUserChatRooms(userId)
      userChats.forEach(chat => {
        socket.join(chat._id.toString())
        debugLog(`📥 Auto-joined socket ${socket.id} to chat: ${chat._id}`)
      })

      // Set user online
      await setUserOnline(userId, true)
      await broadcastUserStatus(userId, true)

      // Emit confirmation with joined chats count
      socket.emit('user:connected', { userId, socketId: socket.id, joinedChats: userChats.length })
    })

    socket.on('chat:join', (chatId) => {
      if (!chatId) {
        return
      }

      debugLog(`📥 Socket ${socket.id} joining chat: ${chatId}`)
      socket.join(chatId.toString())

      // Mark messages as delivered when user joins chat
      const userId = socketToUser.get(socket.id)
      if (userId) {
        markMessagesAsDelivered(chatId, userId)
      }
    })

    socket.on('chat:leave', (chatId) => {
      if (!chatId) {
        return
      }

      debugLog(`📤 Socket ${socket.id} leaving chat: ${chatId}`)
      socket.leave(chatId.toString())
    })

    socket.on('message:send', ({ chatId, message }) => {
      if (!chatId || !message) {
        return
      }

      socket.to(chatId.toString()).emit('message:new', message)
    })

    // Handle message delivered event
    socket.on('message:delivered', async ({ messageId, chatId }) => {
      const userId = socketToUser.get(socket.id)
      if (!userId || !messageId) return

      try {
        const message = await Message.findById(messageId)
        if (!message || message.sender.toString() === userId) return

        if (message.status === 'sent') {
          message.status = 'delivered'
          message.deliveredAt = new Date()
          await message.save()

          // Notify sender
          io.to(chatId.toString()).emit('message:status-update', {
            messageId: message._id,
            status: 'delivered',
            deliveredAt: message.deliveredAt,
          })
        }
      } catch (err) {
        console.error('📛 Error marking message delivered:', err)
      }
    })

    // Handle typing events
    socket.on('typing:start', async ({ chatId }) => {
      const userId = socketToUser.get(socket.id)
      if (!userId || !chatId) return

      try {
        const user = await User.findById(userId).select('firstName lastName')
        if (!user) return

        // Broadcast to other users in the chat
        socket.to(chatId.toString()).emit('user:typing', {
          chatId,
          userId,
          userName: `${user.firstName} ${user.lastName || ''}`.trim(),
          isTyping: true,
        })
      } catch (err) {
        console.error('📛 Error handling typing:start:', err)
      }
    })

    socket.on('typing:stop', async ({ chatId }) => {
      const userId = socketToUser.get(socket.id)
      if (!userId || !chatId) return

      try {
        const user = await User.findById(userId).select('firstName lastName')
        if (!user) return

        socket.to(chatId.toString()).emit('user:typing', {
          chatId,
          userId,
          userName: `${user.firstName} ${user.lastName || ''}`.trim(),
          isTyping: false,
        })
      } catch (err) {
        console.error('📛 Error handling typing:stop:', err)
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
  return userToSockets.get(userId) || new Set()
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
