import UserBlock from '../Models/userBlockModel.mjs';
import { ChatAccessError, normalizeObjectId } from './chatAccess.mjs';
import { toIdString } from './messageState.mjs';

export const CONVERSATION_DISABLED_REASONS = Object.freeze({
  BLOCKED_BY_ME: 'blocked_by_me',
  BLOCKED_ME: 'blocked_me',
});

const DIRECT_CHAT_BLOCK_ERROR = 'Blocking is only available for direct chats';

const idsEqual = (left, right) => {
  const leftId = toIdString(left);
  const rightId = toIdString(right);
  return Boolean(leftId && rightId && leftId === rightId);
};

const normalizeParticipantId = (value) => normalizeObjectId(value?._id ?? value);

export class ConversationControlError extends Error {
  constructor(code, message, statusCode = 403) {
    super(message);
    this.name = 'ConversationControlError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const isDirectChat = (chat) => (
  Boolean(chat)
  && chat.isGroupChat !== true
  && Array.isArray(chat.members)
  && chat.members.length === 2
);

export const getDirectChatPeerId = (chat, requesterId) => {
  if (!isDirectChat(chat)) {
    throw new ConversationControlError('not_direct_chat', DIRECT_CHAT_BLOCK_ERROR, 400);
  }

  const requesterObjectId = normalizeParticipantId(requesterId);
  const peerId = chat.members.find((memberId) => !idsEqual(memberId, requesterObjectId));

  if (!peerId) {
    throw new ConversationControlError('invalid_direct_chat_peer', 'Direct chat peer not found', 400);
  }

  if (idsEqual(peerId, requesterObjectId)) {
    throw new ConversationControlError('self_block_not_allowed', 'You cannot block yourself', 400);
  }

  return normalizeParticipantId(peerId);
};

export const getBlockStateForDirectChat = async ({ chat, userId }) => {
  if (!isDirectChat(chat)) {
    return {
      isDirectChat: false,
      peerId: null,
      blockedByMe: false,
      blockedMe: false,
      blockByMe: null,
      blockByPeer: null,
    };
  }

  const userObjectId = normalizeParticipantId(userId);
  const peerId = getDirectChatPeerId(chat, userObjectId);
  const blocks = await UserBlock.find({
    $or: [
      { blocker: userObjectId, blockedUser: peerId },
      { blocker: peerId, blockedUser: userObjectId },
    ],
  }).lean();
  const blockByMe = blocks.find((block) => idsEqual(block.blocker, userObjectId)) ?? null;
  const blockByPeer = blocks.find((block) => idsEqual(block.blocker, peerId)) ?? null;

  return {
    isDirectChat: true,
    peerId,
    blockedByMe: Boolean(blockByMe),
    blockedMe: Boolean(blockByPeer),
    blockByMe,
    blockByPeer,
  };
};

export const buildConversationControls = async ({ chat, userId }) => {
  const blockState = await getBlockStateForDirectChat({ chat, userId });
  const messagingDisabledReason = blockState.blockedByMe
    ? CONVERSATION_DISABLED_REASONS.BLOCKED_BY_ME
    : blockState.blockedMe
      ? CONVERSATION_DISABLED_REASONS.BLOCKED_ME
      : null;

  return {
    isDirectChat: blockState.isDirectChat,
    peerId: blockState.peerId?.toString?.() ?? null,
    canSendMessage: !messagingDisabledReason,
    canBlockUser: blockState.isDirectChat && !blockState.blockedByMe,
    canUnblockUser: blockState.isDirectChat && blockState.blockedByMe,
    blockedByMe: blockState.blockedByMe,
    blockedMe: blockState.blockedMe,
    messagingDisabledReason,
  };
};

export const assertDirectChatBlockTarget = ({ chat, userId }) => {
  const userObjectId = normalizeParticipantId(userId);

  if (!chat?.members?.some((memberId) => idsEqual(memberId, userObjectId))) {
    throw new ConversationControlError('forbidden_or_not_found', 'Forbidden or not found', 404);
  }

  return getDirectChatPeerId(chat, userObjectId);
};

export const blockDirectChatPeer = async ({ chat, userId }) => {
  const blocker = normalizeParticipantId(userId);
  const blockedUser = assertDirectChatBlockTarget({ chat, userId: blocker });

  await UserBlock.updateOne(
    { blocker, blockedUser },
    {
      $setOnInsert: {
        blocker,
        blockedUser,
        sourceChatId: chat._id,
      },
    },
    { upsert: true }
  );

  return getBlockStateForDirectChat({ chat, userId: blocker });
};

export const unblockDirectChatPeer = async ({ chat, userId }) => {
  const blocker = normalizeParticipantId(userId);
  const blockedUser = assertDirectChatBlockTarget({ chat, userId: blocker });

  await UserBlock.deleteOne({ blocker, blockedUser });

  return getBlockStateForDirectChat({ chat, userId: blocker });
};

export const getConversationActivityBlock = async ({ chat, actorId }) => {
  const controls = await buildConversationControls({ chat, userId: actorId });

  if (controls.canSendMessage) {
    return { allowed: true, controls };
  }

  return {
    allowed: false,
    controls,
    code: 'conversation_blocked',
    statusCode: 403,
    message: controls.messagingDisabledReason === CONVERSATION_DISABLED_REASONS.BLOCKED_BY_ME
      ? 'You blocked this user. Unblock them before sending new activity.'
      : 'This user is not available for new conversation activity.',
  };
};

export const assertConversationActivityAllowed = async ({ chat, actorId }) => {
  const result = await getConversationActivityBlock({ chat, actorId });

  if (!result.allowed) {
    throw new ConversationControlError(result.code, result.message, result.statusCode);
  }

  return result.controls;
};

export const isConversationActivityAllowed = async ({ chat, actorId }) => {
  const result = await getConversationActivityBlock({ chat, actorId });
  return result.allowed;
};

export const toSocketAccessError = (error) => {
  if (error instanceof ConversationControlError) {
    return new ChatAccessError(error.code, error.message);
  }

  return error;
};

export const filterUnblockedContactIds = async ({ userId, contactIds }) => {
  const userObjectId = normalizeParticipantId(userId);
  const uniqueContactIds = Array.from(new Set(
    (contactIds ?? [])
      .map((contactId) => normalizeParticipantId(contactId).toString())
      .filter(Boolean)
  ));

  if (uniqueContactIds.length === 0) {
    return [];
  }

  const contactObjectIds = uniqueContactIds.map((contactId) => normalizeParticipantId(contactId));
  const blocks = await UserBlock.find({
    $or: [
      { blocker: userObjectId, blockedUser: { $in: contactObjectIds } },
      { blocker: { $in: contactObjectIds }, blockedUser: userObjectId },
    ],
  }).select('blocker blockedUser').lean();
  const blockedPairs = new Set();

  blocks.forEach((block) => {
    blockedPairs.add(block.blocker.toString());
    blockedPairs.add(block.blockedUser.toString());
  });

  return uniqueContactIds.filter((contactId) => !blockedPairs.has(contactId));
};
