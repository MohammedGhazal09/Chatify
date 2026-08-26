import CallSession from '../Models/callSessionModel.mjs';
import Chats from '../Models/chatModel.mjs';
import InviteLink from '../Models/inviteLinkModel.mjs';
import Message from '../Models/messageModel.mjs';
import NotificationOutbox from '../Models/notificationOutboxModel.mjs';
import OAuthHandoff from '../Models/oauthHandoffModel.mjs';
import PasswordReset from '../Models/passwordResetModel.mjs';
import Session from '../Models/sessionModel.mjs';
import SessionFamily from '../Models/sessionFamilyModel.mjs';
import TwoFactorChallenge from '../Models/twoFactorChallengeModel.mjs';
import UploadBudget from '../Models/uploadBudgetModel.mjs';
import User from '../Models/userModel.mjs';
import { setDatabaseIndexState } from './databaseIndexState.mjs';

const requirement = (id, model, keys, options = {}) => ({
  id,
  model,
  modelName: model.modelName,
  collectionName: model.collection.name,
  keys,
  options,
});

export const CRITICAL_DATABASE_INDEX_REQUIREMENTS = Object.freeze([
  requirement('users.email.unique', User, { email: 1 }, { unique: true }),
  requirement('users.username.unique-partial', User, { username: 1 }, {
    unique: true,
    partialFilterExpression: {
      username: { $type: 'string' },
    },
  }),
  requirement('chats.direct-key.unique-partial', Chats, { directKey: 1 }, {
    unique: true,
    partialFilterExpression: {
      isGroupChat: false,
      directKey: { $type: 'string' },
    },
  }),
  requirement('messages.chat-pagination', Message, { chatId: 1, createdAt: -1, _id: -1 }),
  requirement('messages.client-id.unique-partial', Message, {
    chatId: 1,
    sender: 1,
    clientMessageId: 1,
  }, {
    unique: true,
    partialFilterExpression: {
      clientMessageId: { $exists: true, $type: 'string' },
    },
  }),
  requirement('call-sessions.active-participant.unique-partial', CallSession, { participantIds: 1 }, {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['ringing', 'connected'] },
    },
  }),
  requirement('sessions.refresh-token.unique', Session, { refreshTokenHash: 1 }, { unique: true }),
  requirement('sessions.expiry.ttl', Session, { expiresAt: 1 }, { expireAfterSeconds: 0 }),
  requirement('session-families.family-id.unique', SessionFamily, { familyId: 1 }, { unique: true }),
  requirement('session-families.expiry.ttl', SessionFamily, { expiresAt: 1 }, { expireAfterSeconds: 0 }),
  requirement('password-reset.expiry.ttl', PasswordReset, { expiresAt: 1 }, { expireAfterSeconds: 0 }),
  requirement('oauth-handoff.expiry.ttl', OAuthHandoff, { expiresAt: 1 }, { expireAfterSeconds: 0 }),
  requirement('two-factor-challenge.expiry.ttl', TwoFactorChallenge, { expiresAt: 1 }, { expireAfterSeconds: 0 }),
  requirement('invite-link.token.unique', InviteLink, { tokenHash: 1 }, { unique: true }),
  requirement('invite-link.expiry.ttl', InviteLink, { expiresAt: 1 }, { expireAfterSeconds: 0 }),
  requirement('notification-outbox.dedupe.unique', NotificationOutbox, { dedupeKey: 1 }, { unique: true }),
  requirement('notification-outbox.delivery-queue', NotificationOutbox, {
    status: 1,
    nextAttemptAt: 1,
    leaseExpiresAt: 1,
    createdAt: 1,
  }),
  requirement('upload-budget.daily.unique', UploadBudget, {
    userId: 1,
    purpose: 1,
    periodStart: 1,
  }, { unique: true }),
  requirement('upload-budget.expiry.ttl', UploadBudget, { expiresAt: 1 }, { expireAfterSeconds: 0 }),
]);

const orderedEntries = (value = {}) => Object.entries(value);

const keysEqual = (left, right) => {
  const leftEntries = orderedEntries(left);
  const rightEntries = orderedEntries(right);

  return leftEntries.length === rightEntries.length
    && leftEntries.every(([key, value], index) => (
      rightEntries[index]?.[0] === key && rightEntries[index]?.[1] === value
    ));
};

const canonicalizeDefinition = (value) => {
  if (Array.isArray(value)) {
    return value.map(canonicalizeDefinition);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalizeDefinition(value[key])])
  );
};

const definitionsEqual = (left, right) => (
  JSON.stringify(canonicalizeDefinition(left))
  === JSON.stringify(canonicalizeDefinition(right))
);

const optionMismatches = (actual = {}, expected = {}) => {
  const mismatches = [];

  if (expected.unique !== undefined && Boolean(actual.unique) !== expected.unique) {
    mismatches.push(`unique=${Boolean(actual.unique)} expected ${expected.unique}`);
  }

  if (
    expected.expireAfterSeconds !== undefined
    && Number(actual.expireAfterSeconds) !== expected.expireAfterSeconds
  ) {
    mismatches.push(
      `expireAfterSeconds=${String(actual.expireAfterSeconds)} expected ${expected.expireAfterSeconds}`
    );
  }

  if (
    expected.partialFilterExpression !== undefined
    && !definitionsEqual(
      actual.partialFilterExpression,
      expected.partialFilterExpression
    )
  ) {
    mismatches.push(
      `partialFilterExpression=${JSON.stringify(actual.partialFilterExpression ?? null)} expected ${JSON.stringify(expected.partialFilterExpression)}`
    );
  }

  return mismatches;
};

const serializeRequirement = (item) => ({
  id: item.id,
  modelName: item.modelName,
  collectionName: item.collectionName,
  keys: item.keys,
  options: item.options,
});

export const evaluateIndexDefinitions = ({ requirements, getIndexes }) => {
  const missing = [];
  const mismatched = [];
  const checked = [];

  for (const item of requirements) {
    const indexes = getIndexes(item) ?? [];
    const match = indexes.find((index) => keysEqual(index.keys, item.keys));

    if (!match) {
      missing.push(item.id);
      checked.push({ ...serializeRequirement(item), status: 'missing' });
      continue;
    }

    const differences = optionMismatches(match.options, item.options);
    if (differences.length > 0) {
      mismatched.push({
        id: item.id,
        differences,
        indexName: match.name ?? null,
      });
      checked.push({
        ...serializeRequirement(item),
        status: 'mismatched',
        differences,
        indexName: match.name ?? null,
      });
      continue;
    }

    checked.push({ ...serializeRequirement(item), status: 'ok', indexName: match.name ?? null });
  }

  return {
    ok: missing.length === 0 && mismatched.length === 0,
    checked,
    checkedCount: checked.length,
    missing,
    mismatched,
  };
};

export const buildCriticalIndexDefinitionReport = () => evaluateIndexDefinitions({
  requirements: CRITICAL_DATABASE_INDEX_REQUIREMENTS,
  getIndexes: (item) => item.model.schema.indexes().map(([keys, options]) => ({
    keys,
    options,
    name: options.name ?? null,
  })),
});

const normalizeLiveIndex = (index) => ({
  name: index.name ?? null,
  keys: index.key ?? {},
  options: {
    unique: index.unique,
    expireAfterSeconds: index.expireAfterSeconds,
    partialFilterExpression: index.partialFilterExpression,
  },
});

const isNamespaceMissing = (error) => error?.code === 26 || error?.codeName === 'NamespaceNotFound';

const readCollectionIndexes = async (model) => {
  try {
    return (await model.collection.indexes()).map(normalizeLiveIndex);
  } catch (error) {
    if (isNamespaceMissing(error)) return [];
    throw error;
  }
};

const collectLiveIndexes = async (models) => {
  const indexesByCollection = new Map();

  for (const model of models) {
    indexesByCollection.set(model.collection.name, await readCollectionIndexes(model));
  }

  return indexesByCollection;
};

const evaluateLiveIndexes = ({ requirements, indexesByCollection }) => evaluateIndexDefinitions({
  requirements,
  getIndexes: (item) => indexesByCollection.get(item.collectionName),
});

const canSafelyConvertToTtl = (item, checkedEntry) => (
  item.options.expireAfterSeconds !== undefined
  && checkedEntry?.indexName
  && checkedEntry.differences?.every((difference) => difference.startsWith('expireAfterSeconds='))
);

const applySafeIndexRepairs = async ({ requirements, report }) => {
  const requirementById = new Map(requirements.map((item) => [item.id, item]));
  const checkedById = new Map(report.checked.map((item) => [item.id, item]));
  const convertedTtl = [];

  for (const mismatch of report.mismatched) {
    const item = requirementById.get(mismatch.id);
    const checkedEntry = checkedById.get(mismatch.id);

    if (!item || !canSafelyConvertToTtl(item, checkedEntry)) continue;

    await item.model.db.db.command({
      collMod: item.collectionName,
      index: {
        name: checkedEntry.indexName,
        expireAfterSeconds: item.options.expireAfterSeconds,
      },
    });
    convertedTtl.push(item.id);
  }

  const modelsWithMissingIndexes = new Set(
    report.missing
      .map((id) => requirementById.get(id)?.model)
      .filter(Boolean)
  );

  for (const model of modelsWithMissingIndexes) {
    await model.createIndexes();
  }

  return { convertedTtl };
};

const persistIndexState = (report) => {
  const checkedAt = new Date().toISOString();

  setDatabaseIndexState({
    status: report.ok ? 'ok' : 'blocked',
    checkedAt,
    checked: report.checkedCount,
    missing: report.missing,
    mismatched: report.mismatched.map((item) => item.id),
  });

  return checkedAt;
};

export const verifyCriticalDatabaseIndexes = async ({
  createMissing = false,
  requirements = CRITICAL_DATABASE_INDEX_REQUIREMENTS,
} = {}) => {
  const models = [...new Set(requirements.map((item) => item.model))];
  let indexesByCollection = await collectLiveIndexes(models);
  let report = evaluateLiveIndexes({ requirements, indexesByCollection });
  let repairs = { convertedTtl: [] };

  if (createMissing && !report.ok) {
    repairs = await applySafeIndexRepairs({ requirements, report });
    indexesByCollection = await collectLiveIndexes(models);
    report = evaluateLiveIndexes({ requirements, indexesByCollection });
  }

  const checkedAt = persistIndexState(report);

  return {
    ...report,
    checkedAt,
    createdMissing: createMissing,
    repairs,
  };
};
