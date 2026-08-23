import { createServer } from 'node:http';
import { once } from 'node:events';
import { getTestApp } from '../setup/app.mjs';
import { closeSocketServer, initSocket } from '../../Config/socket.mjs';
import {
  installSocketPresencePrivacy,
  resetSocketPresencePrivacyForTests,
} from '../../Services/socketPresencePrivacyService.mjs';
import {
  installSocketSessionLifecycle,
  resetSocketSessionLifecycleForTests,
} from '../../Services/socketSessionLifecycleService.mjs';

export const startSocketTestServer = async () => {
  const app = await getTestApp();
  const httpServer = createServer(app);
  const io = initSocket(httpServer);
  installSocketPresencePrivacy(io);
  installSocketSessionLifecycle(io);

  httpServer.listen(0, '127.0.0.1');
  await once(httpServer, 'listening');

  const address = httpServer.address();
  const url = `http://127.0.0.1:${address.port}`;

  const close = async () => {
    await closeSocketServer();
    resetSocketPresencePrivacyForTests();
    resetSocketSessionLifecycleForTests();

    if (httpServer.listening) {
      httpServer.close();
      await once(httpServer, 'close');
    }
  };

  return { httpServer, io, url, close };
};
