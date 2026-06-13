import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeAttachment, makeChat, makeMessage } from '../../../test/chatFixtures';
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

  it('renders file attachments with protected open and download actions', () => {
    render(
      <MessageBubble
        message={makeMessage({
          text: '',
          attachments: [makeAttachment({ attachmentId: 'attachment-file', displayName: 'message-states-spec.pdf' })],
        })}
        isOwnMessage
        isGroupChat={false}
        members={makeChat().members}
      />
    );

    expect(screen.getByText('message-states-spec.pdf')).toBeInTheDocument();
    expect(screen.getByText('PDF - 280 KB')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open message-states-spec.pdf' })).toHaveAttribute(
      'href',
      expect.stringContaining('/api/message/attachments/attachment-file/preview')
    );
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
