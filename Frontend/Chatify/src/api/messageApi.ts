import axiosInstance from './axios';
import type { AxiosResponse } from 'axios';
import { resolveApiBaseUrl } from './apiOrigin';
import type {
  CursorPaginationInfo,
  Message,
  MessageReceiptPatch,
  NewMessagePayload,
  PaginationInfo,
  PinnedMessage,
  Reaction,
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

type GetMessagesOptions = {
  before?: string | null;
  limit?: number;
};

type SearchMessagesOptions = {
  q: string;
  limit?: number;
};

type SharedAssetsOptions = {
  kind?: SharedAssetKind;
  cursor?: string | null;
  limit?: number;
};

const hasAttachments = (payload: NewMessagePayload) => Boolean(payload.attachments?.length);

const buildCreateMessageBody = (payload: NewMessagePayload) => {
  if (!hasAttachments(payload)) {
    return payload;
  }

  const formData = new FormData();
  formData.append('chatId', payload.chatId);
  formData.append('text', payload.text);
  formData.append('clientMessageId', payload.clientMessageId);
  payload.attachments?.forEach((file) => {
    formData.append('attachments', file);
  });

  return formData;
};

const buildProtectedAssetUrl = (attachmentId: string, action: 'preview' | 'download') => {
  return `${resolveApiBaseUrl()}/api/message/attachments/${encodeURIComponent(attachmentId)}/${action}`;
};

export const messageApi = {
  createMessage: (payload: NewMessagePayload): Promise<AxiosResponse<MessageResponse>> =>
    axiosInstance.post('/api/message/new-message', buildCreateMessageBody(payload)),

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

    return axiosInstance.get(`/api/message/search/${chatId}?${params.toString()}`);
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

  pinMessage: (messageId: string): Promise<AxiosResponse<PinMessageResponse>> =>
    axiosInstance.post(`/api/message/${messageId}/pin`),

  unpinMessage: (messageId: string): Promise<AxiosResponse<PinMessageResponse>> =>
    axiosInstance.delete(`/api/message/${messageId}/pin`),

  getAttachmentPreviewUrl: (attachmentId: string) => buildProtectedAssetUrl(attachmentId, 'preview'),

  getAttachmentDownloadUrl: (attachmentId: string) => buildProtectedAssetUrl(attachmentId, 'download'),
};
