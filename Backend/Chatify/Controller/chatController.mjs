import mongoose from "mongoose";
import Chats from "../Models/chatModel.mjs";
import ContactRequest, { CONTACT_REQUEST_STATUSES } from "../Models/contactRequestModel.mjs";
import Message from "../Models/messageModel.mjs";
import User from "../Models/userModel.mjs";
import asyncErrHandler from "../Utils/asyncErrHandler.mjs";
import { CustomError } from "../Utils/customError.mjs";
import { validateUsername } from "../Utils/usernameValidation.mjs";
import {
  emitToUserSockets,
  endActiveCallForChatDueToBlock,
  joinUserToChat,
  removeUserFromChat,
} from "../Config/socket.mjs";
import {
  blockDirectChatPeer,
  buildConversationControls,
  filterUnblockedContactIds,
  unblockDirectChatPeer,
} from "../Utils/conversationControls.mjs";
import {
  buildDirectChatKey,
  normalizeChatEncryptionMode,
} from "../Utils/encryptionMode.mjs";
import {
  buildConversationOrganizationState,
  getConversationOrganizationMap,
  normalizeConversationOrganizationPatch,
  sortSerializedChatsForRequester,
  updateConversationOrganization,
} from "../Utils/conversationOrganization.mjs";
import {
  buildVisibleMessageFilter,
  MESSAGE_CURSOR_SORT_DESC,
  serializeMessage,
} from "../Utils/messageState.mjs";
import { serializeNotificationPreferences } from "../Utils/notificationPreferences.mjs";
import { logger } from "../Utils/observabilityLogger.mjs";

const projectLatestVisibleMessage = async (chatId, requesterId) => {
  const latestVisibleMessage = await Message.findOne(
    buildVisibleMessageFilter({ chatId, userId: requesterId })
  ).sort(MESSAGE_CURSOR_SORT_DESC);

  return latestVisibleMessage ? serializeMessage(latestVisibleMessage) : null;
};

const DIRECT_CHAT_START_ERROR = "We could not start or continue that chat. Check the username and try again.";
const CONTACT_REQUEST_ERROR = "We could not update that request. Try again.";
const GROUP_CHAT_START_ERROR = "We could not create that group. Check the usernames and try again.";
const GROUP_NAME_REQUIRED_ERROR = "Enter a group name.";
const GROUP_MEMBER_MIN = 3;
const GROUP_MEMBER_MAX = 10;
const GROUP_SELECTED_MIN = GROUP_MEMBER_MIN - 1;
const GROUP_SELECTED_MAX = GROUP_MEMBER_MAX - 1;
const PUBLIC_CHAT_MEMBER_SELECT = "username firstName lastName profilePic profileBio identityMark identityMarkUpdatedAt";

const buildContactPairKey = (leftUserId, rightUserId) => [
  leftUserId?.toString?.() ?? leftUserId,
  rightUserId?.toString?.() ?? rightUserId,
].sort().join(":");

const serializePublicMember = (user) => {
  const userObject = user?.toObject?.() ?? user;

  if (!userObject) {
    return null;
  }

  return {
    _id: userObject._id?.toString?.() ?? userObject._id,
    username: userObject.username ?? "",
    firstName: userObject.firstName,
    lastName: userObject.lastName,
    profilePic: userObject.profilePic ?? "",
    profileBio: userObject.profileBio ?? "",
    identityMark: userObject.identityMark,
    identityMarkUpdatedAt: userObject.identityMarkUpdatedAt ?? null,
  };
};

const serializeContactRequest = (request, requesterId) => {
  const requestObject = request?.toObject?.() ?? request;
  const requesterIdString = requesterId?.toString?.() ?? requesterId;
  const requestRequesterId = requestObject.requester?._id?.toString?.() ?? requestObject.requester?.toString?.();
  const requestRecipientId = requestObject.recipient?._id?.toString?.() ?? requestObject.recipient?.toString?.();

  return {
    _id: requestObject._id?.toString?.() ?? requestObject._id,
    requester: serializePublicMember(requestObject.requester),
    recipient: serializePublicMember(requestObject.recipient),
    status: requestObject.status,
    direction: requesterIdString === requestRequesterId
      ? "outgoing"
      : requesterIdString === requestRecipientId
        ? "incoming"
        : null,
    chat: requestObject.chat?.toString?.() ?? requestObject.chat ?? null,
    createdAt: requestObject.createdAt,
    updatedAt: requestObject.updatedAt,
    respondedAt: requestObject.respondedAt ?? null,
  };
};

const populateContactRequest = (query) => query
  .populate("requester", PUBLIC_CHAT_MEMBER_SELECT)
  .populate("recipient", PUBLIC_CHAT_MEMBER_SELECT);

const isDuplicateKeyError = (error) => error?.code === 11000;

const buildDirectEncryptionModeFilter = (encryptionMode) => {
  const normalizedEncryptionMode = normalizeChatEncryptionMode(encryptionMode);

  if (normalizedEncryptionMode === "standard") {
    return {
      $or: [
        { encryptionMode: "standard" },
        { encryptionMode: { $exists: false } },
      ],
    };
  }

  return { encryptionMode: normalizedEncryptionMode };
};

const findDirectChat = (directKey, memberIds = [], encryptionMode) => Chats.findOne({
  isGroupChat: false,
  $and: [
    buildDirectEncryptionModeFilter(encryptionMode),
    {
      $or: [
        { directKey },
        { members: { $all: memberIds } },
      ],
    },
  ],
})
  .populate("members", PUBLIC_CHAT_MEMBER_SELECT)
  .populate("groupAdmin", PUBLIC_CHAT_MEMBER_SELECT)
  .populate("latestMessage");

const ensureDirectChat = async ({ members, encryptionMode, chatName }) => {
  const directKey = buildDirectChatKey(members, encryptionMode);
  const existingChat = await findDirectChat(directKey, members, encryptionMode);

  if (existingChat) {
    return { chat: existingChat, created: false };
  }

  const payload = {
    members,
    directKey,
    encryptionMode,
    isGroupChat: false,
  };

  if (chatName && typeof chatName === "string" && chatName.trim().length) {
    payload.chatName = chatName.trim();
  }

  try {
    const newChat = await Chats.create(payload);
    await populateChatPublicFields(newChat);

    return { chat: newChat, created: true };
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const duplicateChat = await findDirectChat(directKey, members, encryptionMode);

    if (!duplicateChat) {
      throw error;
    }

    return { chat: duplicateChat, created: false };
  }
};

const notifyNewDirectChat = async ({ chat, requesterId, targetUserId }) => {
  try {
    joinUserToChat(requesterId, chat._id);
    joinUserToChat(targetUserId, chat._id);

    emitToUserSockets(
      targetUserId,
      'chat:new',
      await serializeChatForRequester(chat, targetUserId)
    );
  } catch (err) {
    logger.error('chat.new_notification_failed', {
      chatId: chat._id.toString(),
      requesterId,
      targetUserId,
      error: err,
    });
  }
};

const findAcceptedContactRequest = (leftUserId, rightUserId) => ContactRequest.exists({
  pairKey: buildContactPairKey(leftUserId, rightUserId),
  status: CONTACT_REQUEST_STATUSES.ACCEPTED,
});

const findPendingContactRequest = (leftUserId, rightUserId) => populateContactRequest(ContactRequest.findOne({
  pairKey: buildContactPairKey(leftUserId, rightUserId),
  status: CONTACT_REQUEST_STATUSES.PENDING,
}));

const createOrReuseContactRequest = async ({ requesterId, recipientId }) => {
  const existingPending = await findPendingContactRequest(requesterId, recipientId);

  if (existingPending) {
    return { request: existingPending, created: false };
  }

  try {
    const request = await ContactRequest.create({
      requester: requesterId,
      recipient: recipientId,
      status: CONTACT_REQUEST_STATUSES.PENDING,
    });
    const populatedRequest = await populateContactRequest(ContactRequest.findById(request._id));

    return { request: populatedRequest, created: true };
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const pendingRequest = await findPendingContactRequest(requesterId, recipientId);

    if (!pendingRequest) {
      throw error;
    }

    return {
      request: pendingRequest,
      created: false,
    };
  }
};

const emitContactRequestToUser = (userId, event, request) => {
  emitToUserSockets(userId, event, serializeContactRequest(request, userId));
};

const respondWithPendingContactRequest = (res, request, requesterId) => res.status(202).json({
  status: "contact request pending",
  data: {
    contactRequest: serializeContactRequest(request, requesterId),
  },
});

const resolveDirectChatTarget = async ({ targetUsername, requesterId, next }) => {
  const usernameValidation = validateUsername(targetUsername);

  if (!usernameValidation.ok) {
    next(new CustomError(usernameValidation.message, 400));
    return null;
  }

  const targetUser = await User.findOne({ username: usernameValidation.value })
    .select(PUBLIC_CHAT_MEMBER_SELECT);

  if (!targetUser) {
    next(new CustomError(DIRECT_CHAT_START_ERROR, 404));
    return null;
  }

  if (targetUser._id.toString() === requesterId) {
    next(new CustomError(DIRECT_CHAT_START_ERROR, 400));
    return null;
  }

  const unblockedIds = await filterUnblockedContactIds({
    userId: requesterId,
    contactIds: [targetUser._id],
  });

  if (unblockedIds.length !== 1) {
    next(new CustomError(DIRECT_CHAT_START_ERROR, 404));
    return null;
  }

  return targetUser;
};

const loadPendingContactRequestForRole = async ({ requestId, requesterId, role, next }) => {
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    next(new CustomError(CONTACT_REQUEST_ERROR, 404));
    return null;
  }

  const request = await populateContactRequest(ContactRequest.findOne({
    _id: requestId,
    status: CONTACT_REQUEST_STATUSES.PENDING,
    [role]: requesterId,
  }));

  if (!request) {
    next(new CustomError(CONTACT_REQUEST_ERROR, 404));
    return null;
  }

  return request;
};

const populateChatPublicFields = async (chat) => {
  await chat.populate("members", PUBLIC_CHAT_MEMBER_SELECT);
  await chat.populate("groupAdmin", PUBLIC_CHAT_MEMBER_SELECT);
  await chat.populate("latestMessage");

  return chat;
};

const loadOrganizationContextForRequester = async (requesterId, chatIds) => {
  const [requester, organizationByChatId] = await Promise.all([
    User.findById(requesterId).select('notificationPreferences.mutedChatIds').lean(),
    getConversationOrganizationMap({ userId: requesterId, chatIds }),
  ]);

  return {
    mutedChatIds: serializeNotificationPreferences(requester).mutedChatIds,
    organizationByChatId,
  };
};

const serializeChatForRequester = async (
  chat,
  requesterId,
  latestMessage = undefined,
  organizationContext = null
) => {
  const chatObject = chat.toObject?.() ?? chat;
  const projectedLatestMessage = latestMessage === undefined
    ? await projectLatestVisibleMessage(chatObject._id, requesterId)
    : latestMessage;
  const resolvedOrganizationContext = organizationContext
    ?? await loadOrganizationContextForRequester(requesterId, [chatObject._id]);
  const chatId = chatObject._id?.toString?.() ?? chatObject._id;

  return {
    ...chatObject,
    encryptionMode: normalizeChatEncryptionMode(chatObject.encryptionMode),
    latestMessage: projectedLatestMessage,
    conversationControls: await buildConversationControls({ chat, userId: requesterId }),
    organizationState: buildConversationOrganizationState({
      chatId,
      organization: resolvedOrganizationContext.organizationByChatId.get(chatId),
      mutedChatIds: resolvedOrganizationContext.mutedChatIds,
    }),
  };
};

const respondWithExistingDirectChat = async (res, chat, requesterId) => {
  const projectedLatestMessage = await projectLatestVisibleMessage(chat._id, requesterId);

  return res.status(200).json({
    status: "success",
    data: {
      chat: await serializeChatForRequester(chat, requesterId, projectedLatestMessage),
    },
  });
};

const emitConversationControlsUpdated = async (chat) => {
  await Promise.all((chat.members ?? []).map(async (memberId) => {
    const normalizedMemberId = memberId?._id ?? memberId;

    emitToUserSockets(normalizedMemberId, 'conversation:controls-updated', {
      chatId: chat._id.toString(),
      conversationControls: await buildConversationControls({ chat, userId: normalizedMemberId }),
    });
  }));
};

const loadChatForRequester = async ({ chatId, requesterId, next }) => {
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    next(new CustomError("Chat not found", 404));
    return null;
  }

  const chat = await Chats.findById(chatId)
    .populate("members", PUBLIC_CHAT_MEMBER_SELECT)
    .populate("groupAdmin", PUBLIC_CHAT_MEMBER_SELECT)
    .populate("latestMessage");

  if (!chat) {
    next(new CustomError("Chat not found", 404));
    return null;
  }

  const isMember = chat.members.some(
    (member) => member._id?.toString?.() === requesterId || member.toString() === requesterId
  );

  if (!isMember) {
    next(new CustomError("Chat not found", 404));
    return null;
  }

  return chat;
};

const normalizeGroupName = (value) => (
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""
);

const validateGroupName = (value) => {
  const chatName = normalizeGroupName(value);

  if (!chatName || chatName.length < 2) {
    return {
      ok: false,
      message: GROUP_NAME_REQUIRED_ERROR,
    };
  }

  if (chatName.length > 60) {
    return {
      ok: false,
      message: "Group name must be 60 characters or fewer.",
    };
  }

  return {
    ok: true,
    value: chatName,
  };
};

const validateGroupUsernames = (memberUsernames) => {
  if (!Array.isArray(memberUsernames)) {
    return {
      ok: false,
      message: "Add at least two other members.",
    };
  }

  if (memberUsernames.length < GROUP_SELECTED_MIN) {
    return {
      ok: false,
      message: "Add at least two other members.",
    };
  }

  if (memberUsernames.length > GROUP_SELECTED_MAX) {
    return {
      ok: false,
      message: "Groups can have up to 10 members.",
    };
  }

  const normalizedUsernames = [];

  for (const username of memberUsernames) {
    const validation = validateUsername(username);

    if (!validation.ok) {
      return {
        ok: false,
        message: "Use valid member usernames.",
      };
    }

    normalizedUsernames.push(validation.value);
  }

  if (new Set(normalizedUsernames).size !== normalizedUsernames.length) {
    return {
      ok: false,
      message: "Each member username must be unique.",
    };
  }

  return {
    ok: true,
    value: normalizedUsernames,
  };
};

const resolveGroupMembers = async ({ memberUsernames, requesterId }) => {
  const usernameValidation = validateGroupUsernames(memberUsernames);

  if (!usernameValidation.ok) {
    return usernameValidation;
  }

  const users = await User.find({ username: { $in: usernameValidation.value } })
    .select(PUBLIC_CHAT_MEMBER_SELECT);
  const usersByUsername = new Map(users.map((user) => [user.username, user]));
  const orderedUsers = usernameValidation.value.map((username) => usersByUsername.get(username));

  if (orderedUsers.some((user) => !user)) {
    return {
      ok: false,
      message: GROUP_CHAT_START_ERROR,
    };
  }

  const requesterIdString = requesterId.toString();
  const targetMemberIds = orderedUsers.map((user) => user._id.toString());

  if (targetMemberIds.includes(requesterIdString)) {
    return {
      ok: false,
      message: "Each member username must be unique.",
    };
  }

  const unblockedIds = await filterUnblockedContactIds({
    userId: requesterId,
    contactIds: targetMemberIds,
  });

  if (unblockedIds.length !== targetMemberIds.length) {
    return {
      ok: false,
      message: GROUP_CHAT_START_ERROR,
    };
  }

  return {
    ok: true,
    users: orderedUsers,
    memberIds: [requesterIdString, ...targetMemberIds],
  };
};


export const createChat = asyncErrHandler(async (req, res, next) => {
  const { targetUsername, chatName } = req.body ?? {};
  const encryptionMode = normalizeChatEncryptionMode(req.body?.encryptionMode);
  const requesterId = req.userId?.toString();

  if (!requesterId) {
    return next(new CustomError("Not authorized to access this route", 401));
  }

  const targetUser = await resolveDirectChatTarget({
    targetUsername,
    requesterId,
    next,
  });

  if (!targetUser) {
    return;
  }

  const members = [requesterId, targetUser._id];
  const directKey = buildDirectChatKey(members, encryptionMode);
  const existingChat = await findDirectChat(directKey, members, encryptionMode);

  if (existingChat) {
    return respondWithExistingDirectChat(res, existingChat, requesterId);
  }

  if (encryptionMode === "standard") {
    const acceptedRequest = await findAcceptedContactRequest(requesterId, targetUser._id);

    if (!acceptedRequest) {
      const { request, created } = await createOrReuseContactRequest({
        requesterId,
        recipientId: targetUser._id,
      });

      if (created) {
        emitContactRequestToUser(targetUser._id, 'contact-request:created', request);
      }

      return respondWithPendingContactRequest(res, request, requesterId);
    }
  }

  const { chat, created } = await ensureDirectChat({
    members,
    encryptionMode,
    chatName,
  });

  if (created) {
    await notifyNewDirectChat({
      chat,
      requesterId,
      targetUserId: targetUser._id.toString(),
    });
  }

  res.status(created ? 201 : 200).json({
    status: created ? "chat created successfully" : "success",
    data: {
      chat: await serializeChatForRequester(chat, requesterId),
    },
  });
});

export const getContactRequests = asyncErrHandler(async (req, res, next) => {
  const requesterId = req.userId?.toString();

  if (!requesterId) {
    return next(new CustomError("Not authorized to access this route", 401));
  }

  const [incoming, outgoing] = await Promise.all([
    populateContactRequest(ContactRequest.find({
      recipient: requesterId,
      status: CONTACT_REQUEST_STATUSES.PENDING,
    }).sort({ updatedAt: -1 })),
    populateContactRequest(ContactRequest.find({
      requester: requesterId,
      status: CONTACT_REQUEST_STATUSES.PENDING,
    }).sort({ updatedAt: -1 })),
  ]);

  res.status(200).json({
    status: "success",
    data: {
      incoming: incoming.map((request) => serializeContactRequest(request, requesterId)),
      outgoing: outgoing.map((request) => serializeContactRequest(request, requesterId)),
    },
  });
});

export const createContactRequest = asyncErrHandler(async (req, res, next) => {
  const requesterId = req.userId?.toString();

  if (!requesterId) {
    return next(new CustomError("Not authorized to access this route", 401));
  }

  const targetUser = await resolveDirectChatTarget({
    targetUsername: req.body?.targetUsername,
    requesterId,
    next,
  });

  if (!targetUser) {
    return;
  }

  const members = [requesterId, targetUser._id];
  const directKey = buildDirectChatKey(members);
  const existingChat = await findDirectChat(directKey, members, "standard");

  if (existingChat) {
    return respondWithExistingDirectChat(res, existingChat, requesterId);
  }

  const acceptedRequest = await findAcceptedContactRequest(requesterId, targetUser._id);

  if (acceptedRequest) {
    const { chat, created } = await ensureDirectChat({
      members,
      encryptionMode: "standard",
    });

    if (created) {
      await notifyNewDirectChat({
        chat,
        requesterId,
        targetUserId: targetUser._id.toString(),
      });
    }

    return res.status(created ? 201 : 200).json({
      status: created ? "chat created successfully" : "success",
      data: {
        chat: await serializeChatForRequester(chat, requesterId),
      },
    });
  }

  const { request, created } = await createOrReuseContactRequest({
    requesterId,
    recipientId: targetUser._id,
  });

  if (created) {
    emitContactRequestToUser(targetUser._id, 'contact-request:created', request);
  }

  res.status(created ? 201 : 200).json({
    status: "success",
    data: {
      contactRequest: serializeContactRequest(request, requesterId),
    },
  });
});

export const acceptContactRequest = asyncErrHandler(async (req, res, next) => {
  const requesterId = req.userId?.toString();

  if (!requesterId) {
    return next(new CustomError("Not authorized to access this route", 401));
  }

  const request = await loadPendingContactRequestForRole({
    requestId: req.params.requestId,
    requesterId,
    role: "recipient",
    next,
  });

  if (!request) {
    return;
  }

  const chatRequesterId = request.requester._id.toString();
  const chatRecipientId = request.recipient._id.toString();
  const { chat, created } = await ensureDirectChat({
    members: [chatRequesterId, chatRecipientId],
    encryptionMode: "standard",
  });

  request.status = CONTACT_REQUEST_STATUSES.ACCEPTED;
  request.chat = chat._id;
  request.respondedAt = new Date();
  await request.save();

  if (created) {
    await notifyNewDirectChat({
      chat,
      requesterId: chatRecipientId,
      targetUserId: chatRequesterId,
    });
  }

  emitContactRequestToUser(chatRequesterId, 'contact-request:updated', request);
  emitContactRequestToUser(chatRecipientId, 'contact-request:updated', request);

  res.status(200).json({
    status: "success",
    data: {
      contactRequest: serializeContactRequest(request, requesterId),
      chat: await serializeChatForRequester(chat, requesterId),
    },
  });
});

export const declineContactRequest = asyncErrHandler(async (req, res, next) => {
  const requesterId = req.userId?.toString();

  if (!requesterId) {
    return next(new CustomError("Not authorized to access this route", 401));
  }

  const request = await loadPendingContactRequestForRole({
    requestId: req.params.requestId,
    requesterId,
    role: "recipient",
    next,
  });

  if (!request) {
    return;
  }

  request.status = CONTACT_REQUEST_STATUSES.DECLINED;
  request.respondedAt = new Date();
  await request.save();

  const chatRequesterId = request.requester._id.toString();
  const chatRecipientId = request.recipient._id.toString();
  emitContactRequestToUser(chatRequesterId, 'contact-request:updated', request);
  emitContactRequestToUser(chatRecipientId, 'contact-request:updated', request);

  res.status(200).json({
    status: "success",
    data: {
      contactRequest: serializeContactRequest(request, requesterId),
    },
  });
});

export const cancelContactRequest = asyncErrHandler(async (req, res, next) => {
  const requesterId = req.userId?.toString();

  if (!requesterId) {
    return next(new CustomError("Not authorized to access this route", 401));
  }

  const request = await loadPendingContactRequestForRole({
    requestId: req.params.requestId,
    requesterId,
    role: "requester",
    next,
  });

  if (!request) {
    return;
  }

  request.status = CONTACT_REQUEST_STATUSES.CANCELED;
  request.respondedAt = new Date();
  await request.save();

  const chatRequesterId = request.requester._id.toString();
  const chatRecipientId = request.recipient._id.toString();
  emitContactRequestToUser(chatRequesterId, 'contact-request:updated', request);
  emitContactRequestToUser(chatRecipientId, 'contact-request:updated', request);

  res.status(200).json({
    status: "success",
    data: {
      contactRequest: serializeContactRequest(request, requesterId),
    },
  });
});

export const createGroupChat = asyncErrHandler(async (req, res, next) => {
  const requesterId = req.userId?.toString();
  const encryptionMode = normalizeChatEncryptionMode(req.body?.encryptionMode);

  if (!requesterId) {
    return next(new CustomError("Not authorized to access this route", 401));
  }

  const groupNameValidation = validateGroupName(req.body?.chatName);

  if (!groupNameValidation.ok) {
    return next(new CustomError(groupNameValidation.message, 400));
  }

  const memberResolution = await resolveGroupMembers({
    memberUsernames: req.body?.memberUsernames,
    requesterId,
  });

  if (!memberResolution.ok) {
    return next(new CustomError(memberResolution.message, 400));
  }

  const newChat = await Chats.create({
    chatName: groupNameValidation.value,
    members: memberResolution.memberIds,
    isGroupChat: true,
    encryptionMode,
    groupAdmin: requesterId,
  });

  await populateChatPublicFields(newChat);

  const requesterChat = await serializeChatForRequester(newChat, requesterId);

  try {
    await Promise.all(memberResolution.memberIds.map(async (memberId) => {
      joinUserToChat(memberId, newChat._id);

      if (memberId === requesterId) {
        return;
      }

      emitToUserSockets(
        memberId,
        'chat:new',
        await serializeChatForRequester(newChat, memberId)
      );
    }));
  } catch (err) {
    logger.error('chat.group_new_notification_failed', {
      chatId: newChat._id.toString(),
      requesterId,
      memberCount: memberResolution.memberIds.length,
      error: err,
    });
  }

  res.status(201).json({
    status: "group chat created successfully",
    data: {
      chat: requesterChat,
    },
  });
});

export const getAllChats = asyncErrHandler(async (req, res, next) => {
  const chats = await Chats.find({
    members: { $in: [req.userId] },
    isSpaceChannel: { $ne: true },
  })
    .populate("members", PUBLIC_CHAT_MEMBER_SELECT)
    .populate("groupAdmin", PUBLIC_CHAT_MEMBER_SELECT)
    .sort({ updatedAt: -1 });
  const organizationContext = await loadOrganizationContextForRequester(
    req.userId,
    chats.map((chat) => chat._id)
  );
  const projectedChats = await Promise.all(chats.map(async (chat) => {
    return serializeChatForRequester(chat, req.userId, undefined, organizationContext);
  }));

  res.status(200).json({
    status: "success",
    data: {
      chats: sortSerializedChatsForRequester(projectedChats),
    },
  });
});

export const updateChatOrganization = asyncErrHandler(async (req, res, next) => {
  const { chatId } = req.params;
  const requesterId = req.userId?.toString();

  if (!requesterId) {
    return next(new CustomError("Not authorized to access this route", 401));
  }

  const chat = await loadChatForRequester({ chatId, requesterId, next });

  if (!chat) {
    return;
  }

  const patch = normalizeConversationOrganizationPatch(req.body ?? {});

  if (!patch.ok) {
    return next(new CustomError(patch.message, patch.statusCode));
  }

  await Promise.all([
    updateConversationOrganization({
      userId: requesterId,
      chatId: chat._id,
      set: patch.set,
    }),
    patch.muted === undefined
      ? Promise.resolve()
      : User.updateOne(
        { _id: requesterId },
        patch.muted
          ? { $addToSet: { 'notificationPreferences.mutedChatIds': chat._id } }
          : { $pull: { 'notificationPreferences.mutedChatIds': chat._id } }
      ),
  ]);

  const organizationContext = await loadOrganizationContextForRequester(requesterId, [chat._id]);
  const serializedChat = await serializeChatForRequester(chat, requesterId, undefined, organizationContext);

  emitToUserSockets(requesterId, 'conversation:organization-updated', {
    chatId: chat._id.toString(),
    organizationState: serializedChat.organizationState,
    chat: serializedChat,
  });

  res.status(200).json({
    status: "success",
    data: {
      chat: serializedChat,
      organizationState: serializedChat.organizationState,
    },
  });
});

export const blockChatPeer = asyncErrHandler(async (req, res, next) => {
  const { chatId } = req.params;
  const requesterId = req.userId?.toString();

  if (!requesterId) {
    return next(new CustomError("Not authorized to access this route", 401));
  }

  const chat = await loadChatForRequester({ chatId, requesterId, next });

  if (!chat) {
    return;
  }

  try {
    await blockDirectChatPeer({ chat, userId: requesterId });
  } catch (error) {
    return next(new CustomError(error.message, error.statusCode ?? 400));
  }

  await endActiveCallForChatDueToBlock(chat._id);
  await emitConversationControlsUpdated(chat);

  res.status(200).json({
    status: "success",
    data: {
      chat: await serializeChatForRequester(chat, requesterId),
      conversationControls: await buildConversationControls({ chat, userId: requesterId }),
    },
  });
});

export const unblockChatPeer = asyncErrHandler(async (req, res, next) => {
  const { chatId } = req.params;
  const requesterId = req.userId?.toString();

  if (!requesterId) {
    return next(new CustomError("Not authorized to access this route", 401));
  }

  const chat = await loadChatForRequester({ chatId, requesterId, next });

  if (!chat) {
    return;
  }

  try {
    await unblockDirectChatPeer({ chat, userId: requesterId });
  } catch (error) {
    return next(new CustomError(error.message, error.statusCode ?? 400));
  }

  await emitConversationControlsUpdated(chat);

  res.status(200).json({
    status: "success",
    data: {
      chat: await serializeChatForRequester(chat, requesterId),
      conversationControls: await buildConversationControls({ chat, userId: requesterId }),
    },
  });
});

export const deleteChat = asyncErrHandler(async (req, res, next) => {
  const { chatId } = req.params;
  const requesterId = req.userId?.toString();

  if (!requesterId) {
    return next(new CustomError("Not authorized to access this route", 401));
  }

  if (!chatId) {
    return next(new CustomError("Chat ID is required", 400));
  }

  const chat = await Chats.findById(chatId);

  if (!chat) {
    return next(new CustomError("Chat not found", 404));
  }

  // Check if user is a member of the chat
  const isMember = chat.members.some(
    (member) => member.toString() === requesterId
  );

  if (!isMember) {
    return next(new CustomError("You are not a member of this chat", 403));
  }

  if (chat.isGroupChat && chat.groupAdmin?.toString() !== requesterId) {
    return next(new CustomError("Only the group admin can delete this chat", 403));
  }

  // Get member IDs before deletion for socket notification
  const memberIds = chat.members.map((m) => m.toString());

  // Delete the chat
  await Chats.findByIdAndDelete(chatId);

  // Notify all members about the deleted chat via socket
  try {
    // Remove all members from the chat room and notify them
    memberIds.forEach((memberId) => {
      removeUserFromChat(memberId, chatId);
      emitToUserSockets(memberId, "chat:deleted", { chatId });
    });
  } catch (err) {
    logger.error('chat.delete_notification_failed', {
      chatId,
      memberCount: memberIds.length,
      error: err,
    });
  }

  res.status(200).json({
    status: "success",
    message: "Chat deleted successfully",
  });
});
