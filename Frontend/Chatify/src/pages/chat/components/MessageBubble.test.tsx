import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeAttachment, makeChat, makeMessage, makeUser } from '../../../test/chatFixtures';
import MessageBubble from './MessageBubble';

describe('MessageBubble', () => {
  it('renders failed sends with retry and dismiss callbacks preserving clientMessageId', async () => {
    const user = userEvent.setup();
    const onRetryFailed = vi.fn();
    const onDismissFailed = vi.fn();
    const failedMessage = makeMessage({
      _id: 'optimistic-client-1',
      clientMessageId: 'client-1',
      optimisticState: 'failed',
      errorMessage: 'Network failed',
      text: 'Please retry me',
    });

    render(
      <MessageBubble
        message={failedMessage}
        isOwnMessage
        isGroupChat={false}
        members={makeChat().members}
        onRetryFailed={onRetryFailed}
        onDismissFailed={onDismissFailed}
      />
    );

    expect(screen.getByText('Please retry me')).toBeInTheDocument();
    expect(screen.getByText('Message failed to send. Retry or dismiss it.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(onRetryFailed).toHaveBeenCalledWith(expect.objectContaining({ clientMessageId: 'client-1' }));
    expect(onDismissFailed).toHaveBeenCalledWith(expect.objectContaining({ clientMessageId: 'client-1' }));
  });

  it('hides deleted-for-everyone text behind a tombstone', () => {
    render(
      <MessageBubble
        message={makeMessage({
          text: 'Sensitive deleted content',
          deletedForEveryone: true,
        })}
        isOwnMessage
        isGroupChat={false}
        members={makeChat().members}
      />
    );

    expect(screen.getByText('This message was deleted')).toBeInTheDocument();
    expect(screen.queryByText('Sensitive deleted content')).not.toBeInTheDocument();
  });

  it('renders sending, edited, and read status states for own messages', () => {
    render(
      <MessageBubble
        message={makeMessage({
          text: 'Polished state',
          status: 'read',
          optimisticState: 'sending',
          isEdited: true,
        })}
        isOwnMessage
        isGroupChat={false}
        members={makeChat().members}
      />
    );

    expect(screen.getByText('Polished state')).toBeInTheDocument();
    expect(screen.getByText('sending')).toBeInTheDocument();
    expect(screen.getByText('edited')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Message read' })).toBeInTheDocument();
  });

  it('shows the sender name above group messages', () => {
    const groupChat = makeChat({
      isGroupChat: true,
      members: [
        makeUser({ _id: 'user-1', firstName: 'Ada', lastName: 'Lovelace' }),
        makeUser({ _id: 'user-2', firstName: 'Grace', lastName: 'Hopper' }),
        makeUser({ _id: 'user-3', firstName: 'Linus', lastName: 'Torvalds' }),
      ],
    });

    render(
      <MessageBubble
        message={makeMessage({
          sender: 'user-2',
          text: 'Group context matters',
        })}
        isOwnMessage={false}
        isGroupChat
        members={groupChat.members}
      />
    );

    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.getByText('Group context matters')).toBeInTheDocument();
  });

  it('renders persisted mention tokens with current-user emphasis', () => {
    const groupChat = makeChat({
      isGroupChat: true,
      members: [
        makeUser({ _id: 'user-1', username: 'ada.lovelace', firstName: 'Ada', lastName: 'Lovelace' }),
        makeUser({ _id: 'user-2', username: 'grace.hopper', firstName: 'Grace', lastName: 'Hopper' }),
      ],
    });

    render(
      <MessageBubble
        message={makeMessage({
          sender: 'user-1',
          text: 'Can @grace.hopper review this?',
          mentions: [
            {
              userId: 'user-2',
              username: 'grace.hopper',
              displayName: 'Grace Hopper',
            },
          ],
        })}
        isOwnMessage={false}
        isGroupChat
        members={groupChat.members}
        currentUserId="user-2"
      />
    );

    const mention = screen.getByText('@grace.hopper');

    expect(mention).toHaveAttribute('data-mentioned-user', 'user-2');
    expect(mention).toHaveClass('ring-1');
    expect(screen.getByText(/Can/)).toHaveAttribute('dir', 'auto');
  });

  it('renders quoted context and jumps to the source message', async () => {
    const user = userEvent.setup();
    const onJumpToMessage = vi.fn();

    render(
      <MessageBubble
        message={makeMessage({
          _id: 'message-reply',
          sender: 'user-1',
          text: 'Reply body',
          replyTo: {
            messageId: 'message-source',
            sender: 'user-2',
            messageType: 'text',
            textPreview: 'Original source text',
            attachmentCount: 0,
            isDeleted: false,
            isEncrypted: false,
            createdAt: '2026-06-08T09:59:00.000Z',
          },
        })}
        isOwnMessage
        isGroupChat={false}
        members={makeChat().members}
        onJumpToMessage={onJumpToMessage}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Jump to quoted message from Grace Hopper: Original source text' }));

    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.getByText('Original source text')).toHaveAttribute('dir', 'auto');
    expect(onJumpToMessage).toHaveBeenCalledWith('message-source');
  });

  it('uses safe quoted preview fallbacks for unavailable sources', () => {
    render(
      <MessageBubble
        message={makeMessage({
          _id: 'message-reply',
          text: 'Reply body',
          replyTo: {
            messageId: 'message-source',
            sender: 'user-2',
            messageType: 'text',
            textPreview: 'Sensitive source',
            attachmentCount: 0,
            isDeleted: true,
            isEncrypted: false,
            createdAt: '2026-06-08T09:59:00.000Z',
          },
        })}
        isOwnMessage={false}
        isGroupChat={false}
        members={makeChat().members}
        onJumpToMessage={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Quoted message from Grace Hopper: Original message unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Jump to quoted message/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Sensitive source')).not.toBeInTheDocument();
  });

  it('summarizes quoted attachment and encrypted sources without exposing private content', () => {
    const { rerender } = render(
      <MessageBubble
        message={makeMessage({
          text: 'Reply body',
          replyTo: {
            messageId: 'message-source',
            sender: 'user-2',
            messageType: 'text',
            textPreview: '',
            attachmentCount: 2,
            isDeleted: false,
            isEncrypted: false,
            createdAt: '2026-06-08T09:59:00.000Z',
          },
        })}
        isOwnMessage={false}
        isGroupChat={false}
        members={makeChat().members}
        onJumpToMessage={vi.fn()}
      />
    );

    expect(screen.getByText('2 attachments')).toBeInTheDocument();

    rerender(
      <MessageBubble
        message={makeMessage({
          text: 'Reply body',
          replyTo: {
            messageId: 'message-source',
            sender: 'user-2',
            messageType: 'encrypted',
            textPreview: 'ciphertext should not render',
            attachmentCount: 0,
            isDeleted: false,
            isEncrypted: true,
            createdAt: '2026-06-08T09:59:00.000Z',
          },
        })}
        isOwnMessage={false}
        isGroupChat={false}
        members={makeChat().members}
        onJumpToMessage={vi.fn()}
      />
    );

    expect(screen.getByText('Encrypted message')).toBeInTheDocument();
    expect(screen.queryByText('ciphertext should not render')).not.toBeInTheDocument();
  });

  it('marks a loaded search result with the temporary highlight class', () => {
    const highlightedMessage = makeMessage({ _id: 'message-highlighted', text: 'Search target' });
    const { container } = render(
      <MessageBubble
        message={highlightedMessage}
        isOwnMessage
        isGroupChat={false}
        members={makeChat().members}
        isHighlighted
      />
    );

    expect(container.querySelector('[data-message-id="message-highlighted"]')).toHaveClass('message-search-highlight');
  });

  it('renders file-like text as ordinary text until real attachments exist', () => {
    render(
      <MessageBubble
        message={makeMessage({ text: 'message-states-spec.pdf' })}
        isOwnMessage={false}
        isGroupChat={false}
        members={makeChat().members}
      />
    );

    expect(screen.getByText('message-states-spec.pdf')).toBeInTheDocument();
    expect(screen.queryByText('PDF - 280 KB')).not.toBeInTheDocument();
  });

  it('marks Arabic and mixed-direction message text with automatic direction', () => {
    render(
      <MessageBubble
        message={makeMessage({ text: 'مرحبا من Chatify' })}
        isOwnMessage={false}
        isGroupChat={false}
        members={makeChat().members}
      />
    );

    expect(screen.getByText('مرحبا من Chatify')).toHaveAttribute('dir', 'auto');
  });

  it('renders file attachments with in-app open and protected download actions', async () => {
    const user = userEvent.setup();
    const onOpenAttachmentPreview = vi.fn();
    const attachment = makeAttachment({ attachmentId: 'attachment-file', displayName: 'message-states-spec.pdf' });

    render(
      <MessageBubble
        message={makeMessage({
          text: '',
          attachments: [attachment],
        })}
        isOwnMessage
        isGroupChat={false}
        members={makeChat().members}
        onOpenAttachmentPreview={onOpenAttachmentPreview}
      />
    );

    expect(screen.getByText('message-states-spec.pdf')).toBeInTheDocument();
    expect(screen.getByText('PDF - 280 KB')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open message-states-spec.pdf' }));
    expect(onOpenAttachmentPreview).toHaveBeenCalledWith(attachment);
    expect(screen.getByRole('link', { name: 'Download message-states-spec.pdf' })).toHaveAttribute(
      'href',
      expect.stringContaining('/api/message/attachments/attachment-file/download')
    );
  });

  it('renders media attachments from message data', () => {
    render(
      <MessageBubble
        message={makeMessage({
          attachments: [
            makeAttachment({
              attachmentId: 'attachment-media',
              displayName: 'diagram.png',
              mimeType: 'image/png',
              kind: 'media',
              size: 1024,
            }),
          ],
        })}
        isOwnMessage={false}
        isGroupChat={false}
        members={makeChat().members}
      />
    );

    expect(screen.getByRole('img', { name: 'diagram.png' })).toHaveAttribute(
      'src',
      expect.stringContaining('/api/message/attachments/attachment-media/preview')
    );
    expect(screen.getByRole('img', { name: 'diagram.png' })).toHaveAttribute('crossorigin', 'use-credentials');
  });

  it('renders voice attachments with protected playback controls', () => {
    render(
      <MessageBubble
        message={makeMessage({
          text: '',
          attachments: [
            makeAttachment({
              attachmentId: 'attachment-voice',
              displayName: 'voice-message.webm',
              mimeType: 'audio/webm',
              kind: 'voice',
              size: 5,
              durationSeconds: 4,
            }),
          ],
        })}
        isOwnMessage={false}
        isGroupChat={false}
        members={makeChat().members}
      />
    );

    expect(screen.getByText('voice-message.webm')).toBeInTheDocument();
    expect(screen.getByText('0:04')).toBeInTheDocument();
    expect(screen.getByText('5 B')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play voice-message.webm' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Download voice-message.webm' })).toHaveAttribute(
      'href',
      expect.stringContaining('/api/message/attachments/attachment-voice/download')
    );
  });

  it('keeps local sender-side media previews as same-document blob images', () => {
    render(
      <MessageBubble
        message={makeMessage({
          attachments: [
            makeAttachment({
              attachmentId: 'attachment-local-media',
              displayName: 'local-diagram.png',
              mimeType: 'image/png',
              kind: 'media',
              size: 1024,
              localPreviewUrl: 'blob:chatify-local-preview',
            }),
          ],
        })}
        isOwnMessage
        isGroupChat={false}
        members={makeChat().members}
      />
    );

    const image = screen.getByRole('img', { name: 'local-diagram.png' });

    expect(image).toHaveAttribute('src', 'blob:chatify-local-preview');
    expect(image).not.toHaveAttribute('crossorigin');
  });

  it('renders call activity as a centered system row without message actions', () => {
    render(
      <MessageBubble
        message={makeMessage({
          _id: 'call-activity-1',
          sender: 'user-2',
          text: '',
          messageType: 'call',
          callActivity: {
            callId: 'call-1',
            callerId: 'user-2',
            calleeId: 'user-1',
            mode: 'video',
            result: 'ended',
            startedAt: '2026-06-13T10:00:00.000Z',
            ringingAt: '2026-06-13T10:00:01.000Z',
            answeredAt: '2026-06-13T10:00:05.000Z',
            endedAt: '2026-06-13T10:02:10.000Z',
            durationSeconds: 125,
          },
          createdAt: '2026-06-13T10:02:10.000Z',
          updatedAt: '2026-06-13T10:02:10.000Z',
        })}
        isOwnMessage={false}
        isGroupChat={false}
        members={makeChat().members}
      />
    );

    expect(screen.getByRole('note', { name: /Video call ended after 2m 05s/ })).toBeInTheDocument();
    expect(screen.getByText('Video call ended after 2m 05s')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open message actions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Message/ })).not.toBeInTheDocument();
  });

  it('renders locally decrypted encrypted messages without exposing ciphertext', () => {
    render(
      <MessageBubble
        message={makeMessage({
          text: '',
          messageType: 'encrypted',
          encryptionMode: 'e2ee_v1',
          decryptedText: 'Readable local secret text',
          encryptedPayload: {
            ciphertext: 'PRIVATE_CIPHERTEXT_MARKER',
            iv: 'iv',
            algorithm: 'AES-GCM',
            keyVersion: 1,
            senderDeviceId: 'device-1',
            encryptedAt: '2026-06-20T00:00:00.000Z',
          },
        })}
        isOwnMessage={false}
        isGroupChat={false}
        members={makeChat().members}
      />
    );

    expect(screen.getByText('Readable local secret text')).toBeInTheDocument();
    expect(screen.getByText('Encrypted')).toBeInTheDocument();
    expect(screen.queryByText('PRIVATE_CIPHERTEXT_MARKER')).not.toBeInTheDocument();
  });

  it('shows a missing-secret state for encrypted messages this device cannot decrypt', async () => {
    window.localStorage.clear();

    render(
      <MessageBubble
        message={makeMessage({
          text: '',
          messageType: 'encrypted',
          encryptionMode: 'e2ee_v1',
          encryptedPayload: {
            ciphertext: 'ciphertext',
            iv: 'iv',
            algorithm: 'AES-GCM',
            keyVersion: 1,
            senderDeviceId: 'device-1',
            encryptedAt: '2026-06-20T00:00:00.000Z',
          },
        })}
        isOwnMessage={false}
        isGroupChat={false}
        members={makeChat().members}
      />
    );

    expect(await screen.findByText('This device needs the conversation secret to read encrypted messages.')).toBeInTheDocument();
    expect(screen.queryByText('ciphertext')).not.toBeInTheDocument();
  });

  it('does not render attachment previews on deleted-for-everyone tombstones', () => {
    render(
      <MessageBubble
        message={makeMessage({
          text: 'Sensitive',
          deletedForEveryone: true,
          attachments: [makeAttachment({ displayName: 'hidden.pdf' })],
        })}
        isOwnMessage
        isGroupChat={false}
        members={makeChat().members}
      />
    );

    expect(screen.getByText('This message was deleted')).toBeInTheDocument();
    expect(screen.queryByText('hidden.pdf')).not.toBeInTheDocument();
  });
});
