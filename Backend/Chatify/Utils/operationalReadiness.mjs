import mongoose from 'mongoose';
import { dbQueue, emailQueue, messageQueue, socketQueue } from './requestQueue.mjs';
import { getCallIceConfig } from './callIceConfig.mjs';
import { getSocketOperationalStatus } from '../Config/socket.mjs';

const READY_STATE_LABELS = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

const baseRequiredEnv = [
  'MONGODB_URL',
  'SECRET_JWT_KEY',
  'PASSWORD_RESET_SECRET',
  'EMAIL_USER_SENDER',
  'BREVO_API_KEY',
];

const productionRequiredEnv = [
  'FRONTEND_ORIGIN',
  'CALL_TURN_URLS',
  'CALL_TURN_USERNAME',
  'CALL_TURN_CREDENTIAL',
];

const developmentRequiredEnv = [
  'FRONTEND_ORIGIN_DEV',
];

const getRuntime = (env) => env.NODE_ENV || 'development';

const isProductionRuntime = (env) => getRuntime(env) === 'production';

const getRequiredEnvKeys = (env) => [
  ...baseRequiredEnv,
  ...(isProductionRuntime(env) ? productionRequiredEnv : developmentRequiredEnv),
];

const getMissingEnvKeys = (env) => getRequiredEnvKeys(env)
  .filter((key) => !env[key] || String(env[key]).trim().length === 0);

const componentStatus = (blocked, degraded = false) => (
  blocked ? 'blocked' : degraded ? 'degraded' : 'ok'
);

const getOverallStatus = (components) => {
  const statuses = Object.values(components).map((component) => component.status);

  if (statuses.includes('blocked')) {
    return 'blocked';
  }

  if (statuses.includes('degraded')) {
    return 'degraded';
  }

  return 'ok';
};

export const buildHealthPayload = ({ now = new Date() } = {}) => ({
  status: 'ok',
  service: 'chatify-backend',
  timestamp: now.toISOString(),
});

export const buildReadinessPayload = ({
  env = process.env,
  now = new Date(),
  databaseReadyState = mongoose.connection.readyState,
  socketStatus = getSocketOperationalStatus(),
} = {}) => {
  const runtime = getRuntime(env);
  const isProduction = isProductionRuntime(env);
  const missingEnv = getMissingEnvKeys(env);
  const databaseReady = databaseReadyState === 1;
  const callConfig = getCallIceConfig(env);
  const socketInitialized = socketStatus.initialized === true;
  const frontendOrigin = isProduction
    ? env.FRONTEND_ORIGIN
    : env.FRONTEND_ORIGIN_DEV || 'http://localhost:5173';
  const socketBlocked = isProduction && !socketInitialized;
  const socketDegraded = !socketInitialized;
  const callsBlocked = isProduction && !callConfig.turnReady;
  const callsDegraded = !isProduction && !callConfig.turnReady;

  const components = {
    database: {
      status: componentStatus(!databaseReady),
      readyState: READY_STATE_LABELS[databaseReadyState] ?? 'unknown',
    },
    environment: {
      status: componentStatus(missingEnv.length > 0),
      required: getRequiredEnvKeys(env),
      missing: missingEnv,
    },
    storage: {
      status: componentStatus(!databaseReady),
      provider: 'mongodb-gridfs',
      databaseReady,
    },
    socket: {
      status: componentStatus(socketBlocked, socketDegraded),
      initialized: socketInitialized,
      connectedUsers: socketStatus.connectedUsers,
      connectedSockets: socketStatus.connectedSockets,
      pendingCallTimeouts: socketStatus.pendingCallTimeouts,
      pendingCallDisconnectCleanups: socketStatus.pendingCallDisconnectCleanups,
    },
    cors: {
      status: componentStatus(!frontendOrigin),
      originConfigured: Boolean(frontendOrigin),
      production: isProduction,
    },
    cookies: {
      status: componentStatus(isProduction && !env.FRONTEND_ORIGIN),
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
    },
    queues: {
      status: 'ok',
      database: dbQueue.getStatus(),
      email: emailQueue.getStatus(),
      socket: socketQueue.getStatus(),
      messages: messageQueue.getStatus(),
    },
    calls: {
      status: componentStatus(callsBlocked, callsDegraded),
      turnReady: callConfig.turnReady,
      productionReady: callConfig.productionReady,
      iceServerCount: callConfig.iceServers.length,
      warnings: callConfig.warnings,
    },
  };
  const status = getOverallStatus(components);

  return {
    status,
    ready: status !== 'blocked',
    service: 'chatify-backend',
    runtime,
    timestamp: now.toISOString(),
    components,
  };
};

export const getReadinessHttpStatus = (payload) => (
  payload.status === 'blocked' ? 503 : 200
);
