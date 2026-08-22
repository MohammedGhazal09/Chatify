import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';

import Chats from '../../Models/chatModel.mjs';
import InviteLink from '../../Models/inviteLinkModel.mjs';
import User from '../../Models/userModel.mjs';
import {
  DatabaseInputValidationError,
  assertSafeMongoInput,
  buildMongoConnectionOptions,
  normalizeDatabaseLimit,
  withDatabaseTransaction,
} from '../../Utils/databaseSecurity.mjs';
import { buildCriticalIndexDefinitionReport } from '../../Utils/databaseIndexPolicy.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { createUser, uniqueEmail, uniqueUsername } from '../fixtures/users.mjs';
import { createAgent, getCsrfForAgent, signupWithAgent } from '../helpers/authAgent.mjs';

describe('Phase 10 MongoDB and Mongoose security controls', () => {
  it.each([
    [{ email: { $ne: null } }, '$ne'],
    [{ nested: { $where: 'return true' } }, '$where'],
    [{ 'profile.email': 'attacker@example.test' }, 'profile.email'],
    [JSON.parse('{"__proto__":{"polluted":true}}'), '__proto__'],
  ])('rejects dangerous request-shaped MongoDB input %#', (payload, expectedKey) => {
    expect(() => assertSafeMongoInput(payload)).toThrow(DatabaseInputValidationError);

    try {
      assertSafeMongoInput(payload);
    } catch (error) {
      expect(error.code).toBe('INVALID_DATABASE_INPUT');
      expect(error.path).toContain(expectedKey);
    }
  });

  it('rejects operator injection at the HTTP edge instead of mutating it into a broader query', async () => {
    const agent = await createAgent();
    const csrfToken = await getCsrfForAgent(agent);

    const response = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrfToken)
      .send({
        email: { $ne: null },
        password: 'Password123!',
      })
      .expect(400);

    expect(response.body).toEqual(expect.objectContaining({
      status: 'fail',
      code: 'INVALID_DATABASE_INPUT',
    }));
  });

  it('enforces strict schemas and update validators for atomic query updates', async () => {
    await expect(User.create({
      firstName: 'Strict',
      lastName: 'Create',
      email: uniqueEmail('strict-create'),
      username: uniqueUsername('strictcreate'),
      password: 'Password123!',
      authProvider: 'local',
      serverOwnedRole: 'admin',
    })).rejects.toMatchObject({ name: 'StrictModeError' });

    const user = await createUser({ firstName: 'Strict', lastName: 'Update' });

    await expect(User.updateOne(
      { _id: user._id },
      { $set: { profileBio: 'x'.repeat(161) } }
    )).rejects.toMatchObject({ name: 'ValidationError' });

    await expect(User.findOne({ unknownSecurityField: true }))
      .rejects.toMatchObject({ name: 'StrictModeError' });
  });

  it('uses bounded production connection and query defaults', () => {
    const options = buildMongoConnectionOptions({
      NODE_ENV: 'production',
      MONGODB_MAX_POOL_SIZE: '10000',
      MONGODB_MIN_POOL_SIZE: '-1',
      MONGODB_QUERY_MAX_TIME_MS: '999999',
      MONGODB_WAIT_QUEUE_TIMEOUT_MS: '999999',
    });

    expect(options.autoIndex).toBe(false);
    expect(options.maxPoolSize).toBeLessThanOrEqual(100);
    expect(options.minPoolSize).toBeGreaterThanOrEqual(0);
    expect(options.waitQueueTimeoutMS).toBeLessThanOrEqual(30_000);
    expect(options.serverSelectionTimeoutMS).toBeLessThanOrEqual(15_000);
    expect(options.tlsAllowInvalidCertificates).toBe(false);
    expect(options.tlsAllowInvalidHostnames).toBe(false);

    expect(normalizeDatabaseLimit(undefined, { defaultLimit: 25, maxLimit: 100 })).toBe(25);
    expect(normalizeDatabaseLimit('10000', { defaultLimit: 25, maxLimit: 100 })).toBe(100);
    expect(normalizeDatabaseLimit('-1', { defaultLimit: 25, maxLimit: 100 })).toBe(25);
  });

  it('rolls back multi-document writes when a transaction fails', async () => {
    const originalUser = await createUser({ firstName: 'Transaction', lastName: 'Original' });
    const rolledBackEmail = uniqueEmail('transaction-rollback');

    await expect(withDatabaseTransaction(async (session) => {
      await User.updateOne(
        { _id: originalUser._id },
        { $set: { firstName: 'Changed' } },
        { session }
      );
      await User.create([{
        firstName: 'Rolled',
        lastName: 'Back',
        email: rolledBackEmail,
        username: uniqueUsername('rollback'),
        password: 'Password123!',
        authProvider: 'local',
      }], { session });
      throw new Error('force rollback');
    })).rejects.toThrow('force rollback');

    expect((await User.findById(originalUser._id)).firstName).toBe('Transaction');
    expect(await User.findOne({ email: rolledBackEmail })).toBeNull();
  });

  it('declares every critical unique, pagination, and TTL index required by Phase 10', () => {
    const report = buildCriticalIndexDefinitionReport();

    expect(report.ok).toBe(true);
    expect(report.missing).toEqual([]);
    expect(report.mismatched).toEqual([]);

    const expiresAtIndex = InviteLink.schema.indexes().find(([keys]) => keys.expiresAt === 1);
    expect(expiresAtIndex?.[1]).toEqual(expect.objectContaining({ expireAfterSeconds: 0 }));
  });

  it('lets the database resolve concurrent direct-chat uniqueness races', async () => {
    const firstUser = await createUser({ firstName: 'Unique', lastName: 'One' });
    const secondUser = await createUser({ firstName: 'Unique', lastName: 'Two' });
    await Chats.init();

    const attempts = await Promise.allSettled([
      createDirectChat([firstUser, secondUser]),
      createDirectChat([secondUser, firstUser]),
    ]);
    const fulfilled = attempts.filter((attempt) => attempt.status === 'fulfilled');
    const rejected = attempts.filter((attempt) => attempt.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason?.code).toBe(11000);
    expect(await Chats.countDocuments({ members: { $all: [firstUser._id, secondUser._id] } })).toBe(1);
  });

  it('keeps protected message-history lookup constrained by current chat membership', async () => {
    const memberOne = await signupWithAgent({ firstName: 'Query', lastName: 'MemberOne' });
    const memberTwo = await signupWithAgent({ firstName: 'Query', lastName: 'MemberTwo' });
    const outsider = await signupWithAgent({ firstName: 'Query', lastName: 'Outsider' });
    const chat = await createDirectChat([memberOne.user, memberTwo.user]);

    const response = await outsider.agent
      .get(`/api/message/get-all-messages/${chat._id}`)
      .expect(403);

    expect(response.body.data).toBeUndefined();
    expect(response.body.message).toMatch(/not authorized|not found/i);
  });
});
