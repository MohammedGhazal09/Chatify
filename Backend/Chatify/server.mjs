import 'dotenv/config';
import { createServer } from 'node:http';
import { configureMongooseSecurity } from './Utils/databaseSecurity.mjs';
import { validateSecretConfiguration } from './Utils/secretConfiguration.mjs';

validateSecretConfiguration(process.env);
configureMongooseSecurity();

const { default: app } = await import('./app.mjs');
const { connectionPromise } = await import('./Config/DBConfig.mjs');
await connectionPromise;
const { initSocket } = await import('./Config/socket.mjs');
const { startNotificationOutboxWorker } = await import('./Services/notificationService.mjs');
const { startPrivacyOperationsWorker } = await import('./Services/privacyOperationsService.mjs');

const PORT = process.env.PORT || process.env.PORT_NUMBER || 5000;
const httpServer = createServer(app);
const io = initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`);
});

startNotificationOutboxWorker();
startPrivacyOperationsWorker();

export { io, httpServer as server };
