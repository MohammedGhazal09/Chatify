import 'dotenv/config' 
import app from './app.mjs'
import DBConfig from './Config/DBConfig.mjs'
import {createServer} from 'http'
import { initSocket } from './Config/socket.mjs'
import { startNotificationOutboxWorker } from './Services/notificationService.mjs'
import { startPrivacyOperationsWorker } from './Services/privacyOperationsService.mjs'

const PORT = process.env.PORT || process.env.PORT_NUMBER || 5000;
  const httpServer = createServer(app)
  const io = initSocket(httpServer)

  httpServer.listen(PORT, () => {
    console.log(`Socket.io server running on port ${PORT}`);
  })
  startNotificationOutboxWorker()
  startPrivacyOperationsWorker()

  export {io, httpServer as server}
