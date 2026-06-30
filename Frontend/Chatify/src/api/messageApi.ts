import axiosInstance from './axios';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { resolveApiBaseUrl } from './apiOrigin';
import type {
  CursorPaginationInfo,
  Message,
  MessageSearchFilters,
  MessageReceiptPatch,
  MessageUploadAttachment,
  NewMessagePayload,
  PaginationInfo,
  PinnedMessage,
  Reaction,
  SavedMessage,
  SharedAsset,
  SharedAssetKind,
} from '../types/chat';

interface MessageResponse {
  status: string;
  data: {
    message: Message;
  };
}

interface MessagesResponse {
  status: string;
  data: {
    messages: Message[];
    pagination?: PaginationInfo;
    cursor?: CursorPaginationInfo;
    nextCursor?: string | null;
    hasMore?: boolean;
  };
}

interface MessageSearchResponse {
  status: string;
  data: {
    messages: Message[];
    query: string;
    limit: number;
    filters?: MessageSearchFilters & { query?: string };
  };
}

interface UnreadCountResponse {
  status: string;
  data: {
    chatId: string;
    unreadCount: number;
  };
}

interface BatchUnreadCountsResponse {
  status: string;
  data: {
    counts: Record<string, number>;
  };
}

interface MarkReadResponse {
  status: string;
  data: {
    updatedCount?: number;
    messages?: Message[];
    message?: Message;
    receipts?: MessageReceiptPatch[];
    receipt?: MessageReceiptPatch;
    unreadCount: number;
  };
}

interface DeleteResponse {
  status: string;
  message: string;
  data: {
    messageId: string;
    message: Message;
  };
}

interface ReactionResponse {
  status: string;
  data: {
    messageId: string;
    message: Message;
    reactions: Reaction[];
    action: 'added' | 'removed';
  };
}

interface SharedAssetsResponse {
  status: string;
  data: {
    assets: SharedAsset[];
    sharedAssets?: SharedAsset[];
    kind: SharedAssetKind | null;
    cursor: CursorPaginationInfo;
    nextCursor?: string | null;
    hasMore?: boolean;
  };
}

interface PinnedMessagesResponse {
  status: string;
  data: {
    pinnedMessages: PinnedMessage[];
    messages?: Message[];
    limit: number;
  };
}

interface PinMessageResponse {
  status: string;
  data: {
    message: Message;
    pinnedMessage: PinnedMessage;
  };
}

interface SavedMessagesResponse {
  status: string;
  data: {
    savedMessages: SavedMessage[];
    messages?: Message[];
    limit: number;
  };
}

interface SavedMessageResponse {
  status: string;
  data: {
    message: Message;
    savedMessage: SavedMessage | null;
    savedByRequester: boolean;
  };
}

interface MessageContextResponse {
  status: string;
  data: {
    targetMessageId: string;
    messages: Message[];
    cursor: CursorPaginationInfo;
    context: {
      hasMoreBefore: boolean;
      hasMoreAfter: boolean;
      limit: number;
    };
  };
}

type GetMessagesOptions = {
  before?: string | null;
  limit?: number;
};

type SearchMessagesOptions = {
  q: string;
  limit?: number;
} & MessageSearchFilters;

type GetMessageContextOptions = {
  limit?: number;
};

type SharedAssetsOptions = {
  kind?: SharedAssetKind;
  cursor?: string | null;
  limit?: number;
};

type CreateMessageOptions = Pick<AxiosRequestConfig, 'signal' | 'onUploadProgress'>;

const hasAttachments = (payload: NewMessagePayload) => Boolean(payload.attachments?.length);

const isComposerDraft = (attachment: MessageUploadAttachment): attachment is Exclude<MessageUploadAttachment, File> => {
  return !(typeof File !== 'undefined' && attachment instanceof File);
};

const getAttachmentFile = (attachment: MessageUploadAttachment) => (
  isComposerDraft(attachment) ? attachment.file : attachment
);

const buildCreateMessageBody = (payload: NewMessagePayload) => {
  if (!hasAttachments(payload)) {
    return payload;
  }

  const formData = new FormData();
  formData.append('chatId', payload.chatId);
  formData.append('text', payload.text);
  formData.append('clientMessageId', payload.clientMessageId);
  if (payload.replyToMessageId) {
    formData.append('replyToMessageId', payload.replyToMessageId);
  }
  if (payload.mentionUserIds?.length) {
    formData.append('mentionUserIds', JSON.stringify(payload.mentionUserIds));
  }
  const attachmentMetadata = payload.attachments?.map((attachment) => {
    if (!isComposerDraft(attachment)) {
      return {};
    }

    return {
      kind: attachment.kind,
      durationSeconds: attachment.durationSeconds ?? null,
    };
  }) ?? [];

  payload.attachments?.forEach((attachment) => {
    formData.append('attachments', getAttachmentFile(attachment));
  });

  if (attachmentMetadata.some((metadata) => Object.keys(metadata).length > 0)) {
    formData.append('attachmentMetadata', JSON.stringify(attachmentMetadata));
  }

  return formData;
};

const buildProtectedAssetUrl = (attachmentId: string, action: 'preview' | 'download') => {
  return `${resolveApiBaseUrl()}/api/message/attachments/${encodeURIComponent(attachmentId)}/${action}`;
};

export const messageApi = {
  createMessage: (payload: NewMessagePayload, options?: CreateMessageOptions): Promise<AxiosResponse<MessageResponse>> => {
    const config = options && Object.keys(options).length > 0 ? options : undefined;
    return config
      ? axiosInstance.post('/api/message/new-message', buildCreateMessageBody(payload), config)
      : axiosInstance.post('/api/message/new-message', buildCreateMessageBody(payload));
  },

  getAllMessages: (chatId: string, options: GetMessagesOptions = {}): Promise<AxiosResponse<MessagesResponse>> => {
    const params = new URLSearchParams();
    params.set('limit', String(options.limit ?? 50));

    if (options.before) {
      params.set('before', options.before);
    }

    return axiosInstance.get(`/api/message/get-all-messages/${chatId}?${params.toString()}`);
  },

  searchMessages: (chatId: string, options: SearchMessagesOptions): Promise<AxiosResponse<MessageSearchResponse>> => {
    const params = new URLSearchParams();
    params.set('q', options.q);
    params.set('limit', String(options.limit ?? 25));

    if (options.senderId) {
      params.set('senderId', options.senderId);
    }

    if (options.type && options.type !== 'all') {
      params.set('type', options.type);
    }

    if (options.from) {
      params.set('from', options.from);
    }

    if (options.to) {
      params.set('to', options.to);
    }

    return axiosInstance.get(`/api/message/search/${chatId}?${params.toString()}`);
  },

  getMessageContext: (
    chatId: string,
    messageId: string,
    options: GetMessageContextOptions = {}
  ): Promise<AxiosResponse<MessageContextResponse>> => {
    const params = new URLSearchParams();
    params.set('limit', String(options.limit ?? 25));

    return axiosInstance.get(`/api/message/context/${chatId}/${messageId}?${params.toString()}`);
  },

  markMessageAsRead: (messageId: string): Promise<AxiosResponse<MarkReadResponse>> =>
    axiosInstance.patch(`/api/message/${messageId}/read`),

  markMessagesAsRead: (chatId: string, messageIds: string[]): Promise<AxiosResponse<MarkReadResponse>> =>
    axiosInstance.patch(`/api/message/${chatId}/mark-read`, { messageIds }),

  getUnreadCount: (chatId: string): Promise<AxiosResponse<UnreadCountResponse>> =>
    axiosInstance.get(`/api/message/${chatId}/unread-count`),

  getBatchUnreadCounts: (chatIds: string[]): Promise<AxiosResponse<BatchUnreadCountsResponse>> =>
    axiosInstance.post('/api/message/batch/unread-counts', { chatIds }),

  deleteMessage: (messageId: string, deleteForEveryone = false): Promise<AxiosResponse<DeleteResponse>> =>
    axiosInstance.delete(`/api/message/${messageId}`, { data: { deleteForEveryone } }),

  editMessage: (messageId: string, text: string): Promise<AxiosResponse<MessageResponse>> =>
    axiosInstance.patch(`/api/message/${messageId}/edit`, { text }),

  toggleReaction: (messageId: string, emoji: string): Promise<AxiosResponse<ReactionResponse>> =>
    axiosInstance.post(`/api/message/${messageId}/reaction`, { emoji }),

  getSharedAssets: (chatId: string, options: SharedAssetsOptions = {}): Promise<AxiosResponse<SharedAssetsResponse>> => {
    const params = new URLSearchParams();
    params.set('limit', String(options.limit ?? 12));

    if (options.kind) {
      params.set('kind', options.kind);
    }

    if (options.cursor) {
      params.set('cursor', options.cursor);
    }

    return axiosInstance.get(`/api/message/${chatId}/shared-assets?${params.toString()}`);
  },

  getPinnedMessages: (chatId: string): Promise<AxiosResponse<PinnedMessagesResponse>> =>
    axiosInstance.get(`/api/message/${chatId}/pinned`),

  listSavedMessages: (): Promise<AxiosResponse<SavedMessagesResponse>> =>
    axiosInstance.get('/api/message/saved'),

  pinMessage: (messageId: string): Promise<AxiosResponse<PinMessageResponse>> =>
    axiosInstance.post(`/api/message/${messageId}/pin`),

  unpinMessage: (messageId: string): Promise<AxiosResponse<PinMessageResponse>> =>
    axiosInstance.delete(`/api/message/${messageId}/pin`),

  saveMessage: (messageId: string): Promise<AxiosResponse<SavedMessageResponse>> =>
    axiosInstance.post(`/api/message/${messageId}/save`),

  unsaveMessage: (messageId: string): Promise<AxiosResponse<SavedMessageResponse>> =>
    axiosInstance.delete(`/api/message/${messageId}/save`),

  getAttachmentPreviewUrl: (attachmentId: string) => buildProtectedAssetUrl(attachmentId, 'preview'),

  getAttachmentDownloadUrl: (attachmentId: string) => buildProtectedAssetUrl(attachmentId, 'download'),
};
