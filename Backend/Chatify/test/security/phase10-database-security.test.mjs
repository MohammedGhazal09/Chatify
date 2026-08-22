import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';

import Chats from '../../Models/chatModel.mjs';
import InviteLink from '../../Models/inviteLinkModel.mjs';
import PrivacyRequest, {
  PRIVACY_REQUEST_ACTIONS,
  PRIVACY_REQUEST_STATUSES,
  PRIVACY_REQUEST_TYPES,
} from '../../Models/privacyRequestModel.mjs';
import Session from '../../Models/sessionModel.mjs';
import User from '../../Models/userModel.mjs';
import { processPrivacyOperations } from '../../Services/privacyOperationsService.mjs';
import {
  DatabaseConfigurationError,
  DatabaseInputValidationError,
  assertSafeMongoInput,
  buildMongoConnectionOptions,
  normalizeDatabaseLimit,
  validateMongoTransportSecurity,
  withDatabaseTransaction,
} from '../../Utils/databaseSecurity.mjs';
import {
  buildCriticalIndexDefinitionReport,
  verifyCriticalDatabaseIndexes,
} from '../../Utils/databaseIndexPolicy.mjs';
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

  it('rejects oversized query arrays before they can amplify database work', () => {
    expect(() => assertSafeMongoInput({ ids: Array.from({ length: 101 }, (_, index) => index) }))
      .toThrow(DatabaseInputValidationError);
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

  it('fails closed on insecure production MongoDB transport settings', () => {
    expect(() => validateMongoTransportSecurity({
      NODE_ENV: 'production',
      MONGODB_URL: 'mongodb://database.example.test/chatify',
    })).toThrow(DatabaseConfigurationError);

    expect(() => validateMongoTransportSecurity({
      NODE_ENV: 'production',
      MONGODB_URL: 'mongodb+srv://database.example.test/chatify?tls=false',
    })).toThrow(DatabaseConfigurationError);

    expect(() => validateMongoTransportSecurity({
      NODE_ENV: 'production',
      MONGODB_URL: 'mongodb://database.example.test/chatify?tls=true&tlsAllowInvalidCertificates=true',
    })).toThrow(DatabaseConfigurationError);

    expect(validateMongoTransportSecurity({
      NODE_ENV: 'production',
      MONGODB_URL: 'mongodb+srv://database.example.test/chatify',
    })).toEqual({ required: true, secure: true });
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

  it('processes a due privacy deletion exactly once when workers race', async () => {
    const now = new Date('2026-08-22T10:00:00.000Z');
    const owner = await signupWithAgent({
      firstName: 'Concurrent',
      lastName: 'Deletion',
    });
    const request = await PrivacyRequest.create({
      user: owner.user._id,
      type: PRIVACY_REQUEST_TYPES.ACCOUNT_DELETION,
      status: PRIVACY_REQUEST_STATUSES.PENDING,
      requestedAt: new Date('2026-08-01T10:00:00.000Z'),
      scheduledFor: new Date('2026-08-21T10:00:00.000Z'),
      events: [{
        action: PRIVACY_REQUEST_ACTIONS.DELETION_REQUESTED,
        actor: owner.user._id,
        metadata: {},
      }],
    });

    expect(await Session.countDocuments({ userId: owner.user._id })).toBeGreaterThan(0);

    const results = await Promise.all([
      processPrivacyOperations({ now, recordRun: false }),
      processPrivacyOperations({ now, recordRun: false }),
    ]);
    const processedCount = results.reduce(
      (total, result) => total + result.counts.deletionRequestsProcessed,
      0
    );
    const storedRequest = await PrivacyRequest.findById(request._id).lean();
    const storedUser = await User.findById(owner.user._id).lean();

    expect(processedCount).toBe(1);
    expect(storedRequest.status).toBe(PRIVACY_REQUEST_STATUSES.COMPLETED);
    expect(storedRequest.events.filter(
      (event) => event.action === PRIVACY_REQUEST_ACTIONS.DELETION_PROCESSED
    )).toHaveLength(1);
    expect(storedUser.email).toBe(`deleted-${owner.user._id}@chatify.invalid`);
    expect(await Session.countDocuments({ userId: owner.user._id })).toBe(0);
  });

  it('declares and creates every critical unique, pagination, and TTL index', async () => {
    const definitionReport = buildCriticalIndexDefinitionReport();

    expect(definitionReport.ok).toBe(true);
    expect(definitionReport.missing).toEqual([]);
    expect(definitionReport.mismatched).toEqual([]);

    const expiresAtIndex = InviteLink.schema.indexes().find(([keys]) => keys.expiresAt === 1);
    expect(expiresAtIndex?.[1]).toEqual(expect.objectContaining({ expireAfterSeconds: 0 }));

    const liveReport = await verifyCriticalDatabaseIndexes({ createMissing: true });
    expect(liveReport.ok).toBe(true);
    expect(liveReport.missing).toEqual([]);
    expect(liveReport.mismatched).toEqual([]);
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
