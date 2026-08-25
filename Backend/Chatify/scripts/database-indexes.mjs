import 'dotenv/config';
import mongoose from 'mongoose';

import {
  buildMongoConnectionOptions,
  configureMongooseSecurity,
  validateMongoTransportSecurity,
} from '../Utils/databaseSecurity.mjs';

const apply = process.argv.includes('--apply');

const serializeReport = (report) => ({
  ok: report.ok,
  mode: apply ? 'apply-safe-repairs' : 'check-only',
  checkedCount: report.checkedCount,
  missing: report.missing,
  mismatched: report.mismatched,
  repairs: report.repairs,
});

try {
  configureMongooseSecurity();
  validateMongoTransportSecurity(process.env);

  if (!process.env.MONGODB_URL) {
    throw new Error('MONGODB_URL is required');
  }

  await mongoose.connect(
    process.env.MONGODB_URL,
    buildMongoConnectionOptions(process.env)
  );

  const { verifyCriticalDatabaseIndexes } = await import('../Utils/databaseIndexPolicy.mjs');
  const report = await verifyCriticalDatabaseIndexes({ createMissing: apply });

  console.log(JSON.stringify(serializeReport(report), null, 2));
  process.exitCode = report.ok ? 0 : 1;
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    mode: apply ? 'apply-safe-repairs' : 'check-only',
    code: error?.code ?? 'DATABASE_INDEX_COMMAND_FAILED',
    message: error?.message ?? 'Database index command failed',
  }, null, 2));
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
