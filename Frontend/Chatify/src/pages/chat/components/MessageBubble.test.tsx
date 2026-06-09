import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeChat, makeMessage } from '../../../test/chatFixtures';
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
});
