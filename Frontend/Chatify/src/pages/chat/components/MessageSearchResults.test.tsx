import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeChat, makeMessage } from '../../../test/chatFixtures';
import MessageSearchResults from './MessageSearchResults';

describe('MessageSearchResults', () => {
  it('announces below-minimum guidance and exposes a clear action', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();

    render(
      <MessageSearchResults
        query="a"
        selectedChat={makeChat()}
        currentUserId="user-1"
        messages={[]}
        loadedMessageIds={new Set()}
        isLoading={false}
        isError={false}
        isBelowMinimum
        onClear={onClear}
        onSelectResult={vi.fn()}
      />
    );

    expect(screen.getByText('Search needs 2 characters')).toBeInTheDocument();
    expect(screen.getByText('Type at least 2 characters to search this conversation.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('lets loaded and unloaded results jump', async () => {
    const user = userEvent.setup();
    const onSelectResult = vi.fn();
    const loadedMessage = makeMessage({ _id: 'message-loaded', sender: 'user-2', text: 'Launch result already loaded' });
    const unloadedMessage = makeMessage({
      _id: 'message-older',
      sender: 'user-2',
      text: 'Older launch result',
      searchMatch: {
        kind: 'file',
        label: 'File attachment',
        attachmentName: 'launch-plan.pdf',
        attachmentKind: 'file',
      },
    });

    render(
      <MessageSearchResults
        query="launch"
        selectedChat={makeChat()}
        currentUserId="user-1"
        messages={[
          loadedMessage,
          unloadedMessage,
        ]}
        loadedMessageIds={new Set(['message-loaded'])}
        jumpingMessageId="message-older"
        isLoading={false}
        isError={false}
        isBelowMinimum={false}
        onClear={vi.fn()}
        onSelectResult={onSelectResult}
      />
    );

    expect(screen.getByText('2 results')).toBeInTheDocument();
    expect(screen.getByText('In view')).toBeInTheDocument();
    expect(screen.getByText('launch-plan.pdf')).toBeInTheDocument();
    expect(screen.getByText('Loading message context...')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Jump to message from Grace Hopper .*Launch result already loaded/ }));

    expect(onSelectResult).toHaveBeenCalledWith(loadedMessage);
    expect(screen.getByRole('button', { name: /Older launch result/ })).toBeDisabled();
  });

  it('renders loading, error, and empty states', () => {
    const baseProps = {
      query: 'state',
      selectedChat: makeChat(),
      currentUserId: 'user-1',
      messages: [],
      loadedMessageIds: new Set<string>(),
      isBelowMinimum: false,
      onClear: vi.fn(),
      onSelectResult: vi.fn(),
    };

    const { rerender } = render(<MessageSearchResults {...baseProps} isLoading isError={false} />);
    expect(screen.getAllByText('Searching messages...')).toHaveLength(2);

    rerender(<MessageSearchResults {...baseProps} isLoading={false} isError />);
    expect(screen.getAllByText('Search unavailable')).toHaveLength(2);
    expect(screen.getByRole('alert')).toHaveTextContent('We could not search messages. Check the connection or clear search to return to the conversation.');

    rerender(<MessageSearchResults {...baseProps} isLoading={false} isError={false} />);
    expect(screen.getByText('No message matches')).toBeInTheDocument();
  });

  it('shows encrypted-conversation search limitation without rendering ciphertext matches', () => {
    render(
      <MessageSearchResults
        query="secret"
        selectedChat={makeChat({ encryptionMode: 'e2ee_v1' })}
        currentUserId="user-1"
        messages={[makeMessage({ text: 'PRIVATE_CIPHERTEXT_MARKER' })]}
        loadedMessageIds={new Set()}
        isLoading={false}
        isError={false}
        isBelowMinimum={false}
        onClear={vi.fn()}
        onSelectResult={vi.fn()}
      />
    );

    expect(screen.getByText('Search unavailable for encrypted conversations')).toBeInTheDocument();
    expect(screen.getByText('Server-side search cannot read encrypted message text on this conversation.')).toBeInTheDocument();
    expect(screen.queryByText('PRIVATE_CIPHERTEXT_MARKER')).not.toBeInTheDocument();
  });
});
