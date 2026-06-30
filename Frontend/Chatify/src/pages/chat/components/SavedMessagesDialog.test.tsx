import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeMessage, makeSavedMessage } from '../../../test/chatFixtures';
import type { SavedMessage } from '../../../types/chat';
import SavedMessagesDialog from './SavedMessagesDialog';

const savedMessagesQueryMock = vi.hoisted(() => ({
  current: {
    data: [] as SavedMessage[] | undefined,
    isLoading: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
  },
}));

const unsaveMutationMock = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
}));

vi.mock('../../../hooks/useChatQueries', () => ({
  useSavedMessages: vi.fn(() => savedMessagesQueryMock.current),
  useUnsaveMessage: vi.fn(() => unsaveMutationMock),
}));

const renderDialog = (overrides: Partial<ComponentProps<typeof SavedMessagesDialog>> = {}) => {
  const props = {
    isOpen: true,
    currentUserId: 'user-1',
    onClose: vi.fn(),
    onJumpToMessage: vi.fn(),
    ...overrides,
  };

  render(<SavedMessagesDialog {...props} />);
  return props;
};

describe('SavedMessagesDialog', () => {
  beforeEach(() => {
    savedMessagesQueryMock.current = {
      data: [],
      isLoading: false,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    };
    unsaveMutationMock.mutate.mockReset();
    unsaveMutationMock.isPending = false;
  });

  it('renders saved message previews without exposing encrypted plaintext and jumps to a saved message', async () => {
    const user = userEvent.setup();
    const savedText = makeSavedMessage({
      _id: 'saved-text',
      message: makeMessage({
        _id: 'message-text',
        sender: 'user-2',
        text: 'Launch plan checkpoint',
        savedByRequester: true,
      }),
    });
    const savedEncrypted = makeSavedMessage({
      _id: 'saved-encrypted',
      messageId: 'message-encrypted',
      message: makeMessage({
        _id: 'message-encrypted',
        text: 'private plaintext marker',
        messageType: 'encrypted',
        encryptionMode: 'e2ee_v1',
        savedByRequester: true,
      }),
    });
    savedMessagesQueryMock.current = {
      ...savedMessagesQueryMock.current,
      data: [savedText, savedEncrypted],
    };
    const props = renderDialog();

    expect(screen.getByRole('dialog', { name: 'Saved messages' })).toBeInTheDocument();
    expect(screen.getByText('Launch plan checkpoint')).toBeInTheDocument();
    expect(screen.getByText('Encrypted message')).toBeInTheDocument();
    expect(screen.queryByText('private plaintext marker')).not.toBeInTheDocument();
    expect(screen.getByText('2 saved')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Jump' })[0]);

    expect(props.onJumpToMessage).toHaveBeenCalledWith(savedText);
  });

  it('unsaves a message and shows a local action error when the mutation fails', async () => {
    const user = userEvent.setup();
    const savedMessage = makeSavedMessage({
      message: makeMessage({ _id: 'message-saved', chatId: 'chat-1', savedByRequester: true }),
    });
    savedMessagesQueryMock.current = {
      ...savedMessagesQueryMock.current,
      data: [savedMessage],
    };
    unsaveMutationMock.mutate.mockImplementation((_variables, callbacks) => {
      callbacks?.onError?.();
      callbacks?.onSettled?.();
    });

    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Unsave message' }));

    expect(unsaveMutationMock.mutate).toHaveBeenCalledWith(
      { messageId: 'message-saved', chatId: 'chat-1' },
      expect.objectContaining({
        onError: expect.any(Function),
        onSettled: expect.any(Function),
      })
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not unsave that message.');
  });

  it('covers loading, empty, retry, close, and closed states', async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <SavedMessagesDialog
        isOpen={false}
        currentUserId="user-1"
        onClose={vi.fn()}
        onJumpToMessage={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog', { name: 'Saved messages' })).not.toBeInTheDocument();

    savedMessagesQueryMock.current = {
      ...savedMessagesQueryMock.current,
      isLoading: true,
      isSuccess: false,
    };
    rerender(
      <SavedMessagesDialog
        isOpen
        currentUserId="user-1"
        onClose={vi.fn()}
        onJumpToMessage={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Loading saved messages')).toBeInTheDocument();

    const refetch = vi.fn();
    savedMessagesQueryMock.current = {
      data: undefined,
      isLoading: false,
      isError: true,
      isSuccess: false,
      refetch,
    };
    rerender(
      <SavedMessagesDialog
        isOpen
        currentUserId="user-1"
        onClose={vi.fn()}
        onJumpToMessage={vi.fn()}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledTimes(1);

    const onClose = vi.fn();
    savedMessagesQueryMock.current = {
      data: [],
      isLoading: false,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    };
    rerender(
      <SavedMessagesDialog
        isOpen
        currentUserId="user-1"
        onClose={onClose}
        onJumpToMessage={vi.fn()}
      />
    );
    expect(screen.getByText('No saved messages')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close saved messages' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
