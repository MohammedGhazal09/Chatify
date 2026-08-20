import mongoose from 'mongoose';
import ConversationOrganization from '../Models/conversationOrganizationModel.mjs';

const ORGANIZATION_FIELDS = Object.freeze(['archived', 'pinned', 'favorite']);
const PATCH_FIELDS = Object.freeze(['muted', ...ORGANIZATION_FIELDS]);

const isPlainObject = (value) => (
  Boolean(value) &&
  typeof value === 'object' &&
  !Array.isArray(value)
);

const toIdString = (value) => value?._id?.toString?.() ?? value?.toString?.() ?? '';

const toDateValue = (value) => {
  const time = Date.parse(value ?? '');
  return Number.isFinite(time) ? time : 0;
};

export const getDefaultConversationOrganizationState = () => ({
  muted: false,
  archived: false,
  pinned: false,
  favorite: false,
});

export const normalizeConversationOrganizationPatch = (payload) => {
  if (!isPlainObject(payload)) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Conversation organization payload is invalid',
    };
  }

  const unknownField = Object.keys(payload).find((field) => !PATCH_FIELDS.includes(field));

  if (unknownField) {
    return {
      ok: false,
      statusCode: 400,
      message: `Unsupported conversation organization field: ${unknownField}`,
    };
  }

  const set = {};
  let muted;

  for (const field of PATCH_FIELDS) {
    if (!(field in payload)) {
      continue;
    }

    if (typeof payload[field] !== 'boolean') {
      return {
        ok: false,
        statusCode: 400,
        message: `${field} must be a boolean`,
      };
    }

    if (field === 'muted') {
      muted = payload[field];
    } else {
      set[field] = payload[field];
    }
  }

  if (Object.keys(set).length === 0 && muted === undefined) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Conversation organization payload must include at least one setting',
    };
  }

  return {
    ok: true,
    muted,
    set,
  };
};

export const getConversationOrganizationMap = async ({ userId, chatIds }) => {
  const normalizedChatIds = Array.from(new Set(
    (chatIds ?? [])
      .map((chatId) => toIdString(chatId))
      .filter((chatId) => mongoose.Types.ObjectId.isValid(chatId))
  ));

  if (!userId || normalizedChatIds.length === 0) {
    return new Map();
  }

  const organizationRows = await ConversationOrganization.find({
    user: userId,
    chat: { $in: normalizedChatIds },
  }).lean();

  return new Map(organizationRows.map((row) => [row.chat.toString(), row]));
};

export const buildConversationOrganizationState = ({
  chatId,
  organization,
  mutedChatIds = [],
}) => {
  const chatIdString = toIdString(chatId);
  const mutedSet = mutedChatIds instanceof Set
    ? mutedChatIds
    : new Set((mutedChatIds ?? []).map((mutedChatId) => toIdString(mutedChatId)).filter(Boolean));

  return {
    ...getDefaultConversationOrganizationState(),
    muted: Boolean(chatIdString && mutedSet.has(chatIdString)),
    archived: Boolean(organization?.archived),
    pinned: Boolean(organization?.pinned),
    favorite: Boolean(organization?.favorite),
  };
};

export const updateConversationOrganization = async ({ userId, chatId, set }) => {
  if (!set || Object.keys(set).length === 0) {
    return null;
  }

  return ConversationOrganization.findOneAndUpdate(
    {
      user: userId,
      chat: chatId,
    },
    {
      $set: set,
      $setOnInsert: {
        user: userId,
        chat: chatId,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  ).lean();
};

export const sortSerializedChatsForRequester = (chats) => [...chats].sort((left, right) => {
  const pinnedDelta = Number(right.organizationState?.pinned === true) - Number(left.organizationState?.pinned === true);

  if (pinnedDelta !== 0) {
    return pinnedDelta;
  }

  const leftTime = toDateValue(left.updatedAt);
  const rightTime = toDateValue(right.updatedAt);

  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return toIdString(left._id).localeCompare(toIdString(right._id));
});
