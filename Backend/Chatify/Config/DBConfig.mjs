import mongoose from "mongoose";
import { logger } from '../Utils/observabilityLogger.mjs';

mongoose.connect(process.env.MONGODB_URL).catch((err) => {
  logger.error('database.initial_connection_failed', {
    error: err,
  });
})

const db = mongoose.connection
db.on('connected', () => {
  logger.info('database.connected', {
    readyState: db.readyState,
  });
})
db.on('error', (error) => {
  logger.error('database.connection_error', {
    readyState: db.readyState,
    error,
  });
})
db.on('disconnected', () => {
  logger.warn('database.disconnected', {
    readyState: db.readyState,
  });
})
export default db;
