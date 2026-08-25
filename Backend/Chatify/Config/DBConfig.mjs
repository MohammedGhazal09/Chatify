import mongoose from 'mongoose';
import {
  DatabaseConfigurationError,
  buildMongoConnectionOptions,
  configureMongooseSecurity,
  validateMongoTransportSecurity,
} from '../Utils/databaseSecurity.mjs';
import { verifyCriticalDatabaseIndexes } from '../Utils/databaseIndexPolicy.mjs';
import { setDatabaseIndexState } from '../Utils/databaseIndexState.mjs';
import { logger } from '../Utils/observabilityLogger.mjs';

configureMongooseSecurity();
validateMongoTransportSecurity(process.env);

const connectionOptions = buildMongoConnectionOptions(process.env);
const db = mongoose.connection;
const createMissingIndexes = process.env.MONGODB_CREATE_MISSING_INDEXES === '1'
  || process.env.NODE_ENV !== 'production';

setDatabaseIndexState({ status: 'checking' });

const verifyIndexesAfterConnect = async () => {
  const report = await verifyCriticalDatabaseIndexes({
    createMissing: createMissingIndexes,
  });

  if (report.ok) {
    logger.info('database.critical_indexes_verified', {
      checked: report.checkedCount,
      createdMissing: report.createdMissing,
      convertedTtl: report.repairs.convertedTtl,
    });
    return report;
  }

  logger.error('database.critical_indexes_missing', {
    checked: report.checkedCount,
    missing: report.missing,
    mismatched: report.mismatched.map((item) => item.id),
  });

  if (process.env.NODE_ENV === 'production') {
    throw new DatabaseConfigurationError([
      `critical indexes missing: ${report.missing.join(', ') || 'none'}`,
      `critical indexes mismatched: ${report.mismatched.map((item) => item.id).join(', ') || 'none'}`,
    ]);
  }

  return report;
};

const connectionPromise = mongoose
  .connect(process.env.MONGODB_URL, connectionOptions)
  .then(async (connection) => {
    logger.info('database.connected', {
      readyState: db.readyState,
      autoIndex: connectionOptions.autoIndex,
      maxPoolSize: connectionOptions.maxPoolSize,
      minPoolSize: connectionOptions.minPoolSize,
    });

    await verifyIndexesAfterConnect();
    return connection;
  })
  .catch((error) => {
    setDatabaseIndexState({
      status: 'blocked',
      checkedAt: new Date().toISOString(),
      missing: ['database-startup-verification-failed'],
    });
    logger.error('database.initial_connection_failed', {
      error,
    });
    throw error;
  });

db.on('error', (error) => {
  logger.error('database.connection_error', {
    readyState: db.readyState,
    error,
  });
});

db.on('disconnected', () => {
  logger.warn('database.disconnected', {
    readyState: db.readyState,
  });
});

export { connectionOptions, connectionPromise };
export default db;
