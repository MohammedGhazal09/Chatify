import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import {
  buildMongoConnectionOptions,
  configureMongooseSecurity,
} from '../../Utils/databaseSecurity.mjs';

configureMongooseSecurity();

let mongoServer;

export const clearDatabase = async () => {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
};

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: 'wiredTiger',
    },
  });
  process.env.MONGODB_URL = mongoServer.getUri();
  await mongoose.connect(
    process.env.MONGODB_URL,
    buildMongoConnectionOptions(process.env)
  );
}, 60000);

beforeEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
}, 60000);
