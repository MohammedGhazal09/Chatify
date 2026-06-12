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
        onSelectLoadedResult={vi.fn()}
      />
    );

    expect(screen.getByText('Type at least 2 characters to search.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('lets loaded results jump while keeping unloaded results read-only', async () => {
    const user = userEvent.setup();
    const onSelectLoadedResult = vi.fn();
    const loadedMessage = makeMessage({ _id: 'message-loaded', sender: 'user-2', text: 'Launch result already loaded' });

    render(
      <MessageSearchResults
        query="launch"
        selectedChat={makeChat()}
        currentUserId="user-1"
        messages={[
          loadedMessage,
          makeMessage({ _id: 'message-older', sender: 'user-2', text: 'Older launch result' }),
        ]}
        loadedMessageIds={new Set(['message-loaded'])}
        isLoading={false}
        isError={false}
        isBelowMinimum={false}
        onClear={vi.fn()}
        onSelectLoadedResult={onSelectLoadedResult}
      />
    );

    expect(screen.getByText('2 results')).toBeInTheDocument();
    expect(screen.getByText('In view')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Jump to message from Grace Hopper .*Launch result already loaded/ }));

    expect(onSelectLoadedResult).toHaveBeenCalledWith(loadedMessage);
    expect(screen.queryByRole('button', { name: /Older launch result/ })).not.toBeInTheDocument();
    expect(screen.getByText('Load older history to jump to this message.')).toBeInTheDocument();
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
      onSelectLoadedResult: vi.fn(),
    };

    const { rerender } = render(<MessageSearchResults {...baseProps} isLoading isError={false} />);
    expect(screen.getAllByText('Searching messages...')).toHaveLength(2);

    rerender(<MessageSearchResults {...baseProps} isLoading={false} isError />);
    expect(screen.getAllByText('We could not search messages. Try again.')).toHaveLength(2);

    rerender(<MessageSearchResults {...baseProps} isLoading={false} isError={false} />);
    expect(screen.getByText('No message matches')).toBeInTheDocument();
  });
});
