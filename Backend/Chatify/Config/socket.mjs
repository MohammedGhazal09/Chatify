import { Server } from 'socket.io'

let io

const getCorsOrigin = () => {
  if (process.env.FRONTEND_ORIGIN) {
    return process.env.FRONTEND_ORIGIN
  }

  return '*'
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

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`)

    socket.on('chat:join', (chatId) => {
      if (!chatId) {
        return
      }

      console.log(`Socket ${socket.id} joining chat: ${chatId}`)
      socket.join(chatId.toString())
    })

    socket.on('chat:leave', (chatId) => {
      if (!chatId) {
        return
      }

      console.log(`Socket ${socket.id} leaving chat: ${chatId}`)
      socket.leave(chatId.toString())
    })

    socket.on('message:send', ({ chatId, message }) => {
      if (!chatId || !message) {
        return
      }

      socket.to(chatId.toString()).emit('message:new', message)
    })

    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected (${socket.id}): ${reason}`)
    })
  })

  return io
}

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet')
  }

  return io
}
