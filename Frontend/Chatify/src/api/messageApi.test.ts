import { beforeEach, describe, expect, it, vi } from 'vitest';

const axiosMock = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

const apiOriginMock = vi.hoisted(() => ({
  resolveApiBaseUrl: vi.fn(() => 'https://chatify-ten-rho.vercel.app'),
}));

vi.mock('./axios', () => ({
  default: axiosMock,
}));

vi.mock('./apiOrigin', () => apiOriginMock);

import { messageApi } from './messageApi';

describe('messageApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiOriginMock.resolveApiBaseUrl.mockReturnValue('https://chatify-ten-rho.vercel.app');
  });

  it('keeps text-only sends as JSON payloads', () => {
    const payload = {
      chatId: 'chat-1',
      text: 'Hello',
      clientMessageId: 'client-1',
    };

    messageApi.createMessage(payload);

    expect(axiosMock.post).toHaveBeenCalledWith('/api/message/new-message', payload);
  });

  it('sends attachment payloads as multipart FormData', () => {
    const file = new File(['hello'], 'message-states-spec.pdf', { type: 'application/pdf' });

    messageApi.createMessage({
      chatId: 'chat-1',
      text: '',
      clientMessageId: 'client-attachment',
      attachments: [file],
    });

    expect(axiosMock.post).toHaveBeenCalledTimes(1);
    const [, body] = axiosMock.post.mock.calls[0];

    expect(body).toBeInstanceOf(FormData);
    expect(body.get('chatId')).toBe('chat-1');
    expect(body.get('text')).toBe('');
    expect(body.get('clientMessageId')).toBe('client-attachment');
    expect(body.getAll('attachments')).toEqual([file]);
  });

  it('builds shared asset, pin, and protected attachment routes', () => {
    messageApi.getSharedAssets('chat-1', { kind: 'media', cursor: 'cursor-1', limit: 6 });
    messageApi.getPinnedMessages('chat-1');
    messageApi.pinMessage('message-1');
    messageApi.unpinMessage('message-1');

    expect(axiosMock.get).toHaveBeenNthCalledWith(1, '/api/message/chat-1/shared-assets?limit=6&kind=media&cursor=cursor-1');
    expect(axiosMock.get).toHaveBeenNthCalledWith(2, '/api/message/chat-1/pinned');
    expect(axiosMock.post).toHaveBeenCalledWith('/api/message/message-1/pin');
    expect(axiosMock.delete).toHaveBeenCalledWith('/api/message/message-1/pin');
    expect(messageApi.getAttachmentPreviewUrl('attachment 1')).toContain('/api/message/attachments/attachment%201/preview');
    expect(messageApi.getAttachmentDownloadUrl('attachment 1')).toContain('/api/message/attachments/attachment%201/download');
  });

  it('builds protected attachment URLs from the resolved API origin', () => {
    expect(messageApi.getAttachmentPreviewUrl('6a2db3cb8e9e167fc0f5d875')).toBe(
      'https://chatify-ten-rho.vercel.app/api/message/attachments/6a2db3cb8e9e167fc0f5d875/preview'
    );
    expect(messageApi.getAttachmentDownloadUrl('attachment 1')).toBe(
      'https://chatify-ten-rho.vercel.app/api/message/attachments/attachment%201/download'
    );
    expect(apiOriginMock.resolveApiBaseUrl).toHaveBeenCalled();
  });
});
