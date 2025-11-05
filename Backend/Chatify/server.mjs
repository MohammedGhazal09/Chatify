import 'dotenv/config' 
import app from './app.mjs'
import DBConfig from './config/DBConfig.mjs'
import {createServer} from 'http'
import { initSocket } from './Config/socket.mjs'

const PORT = process.env.PORT_NUMBER || 5000;
  const httpServer = createServer(app)
  const io = initSocket(httpServer)

  httpServer.listen(PORT, () => {
    console.log(`Socket.io server running on port ${PORT}`);
  })

  export {io, httpServer as server}