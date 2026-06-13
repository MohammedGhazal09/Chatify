import { createRef } from 'react';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeChat, makeMessage } from '../../../test/chatFixtures';
import MessageList from './MessageList';

type MessageListProps = ComponentProps<typeof MessageList>;

const renderMessageList = (overrides: Partial<MessageListProps> = {}) => {
  const props: MessageListProps = {
    selectedChat: makeChat(),
    messages: [],
    currentUserId: 'user-1',
    isLoading: false,
    isError: false,
    hasMore: false,
    isLoadingMore: false,
    highlightedMessageId: null,
    isSearchActive: false,
    showScrollButton: false,
    editingMessageId: null,
    editText: '',
    isSavingEdit: false,
    messagesContainerRef: createRef<HTMLDivElement>(),
    messagesEndRef: createRef<HTMLDivElement>(),
    onLoadMore: vi.fn(),
    onRetryLoad: vi.fn(),
    onScrollToBottom: vi.fn(),
    onMessageContextMenu: vi.fn(),
    onOpenMessageActions: vi.fn(),
    onStartEdit: vi.fn(),
    onRetryFailed: vi.fn(),
    onDismissFailed: vi.fn(),
    onEditTextChange: vi.fn(),
    onSaveEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    ...overrides,
  };

  const view = render(<MessageList {...props} />);
  return { props, ...view };
};

describe('MessageList', () => {
  it('renders empty conversation and search-empty states', () => {
    const { rerender, props } = renderMessageList();

    expect(screen.getByRole('heading', { name: 'No messages yet' })).toBeInTheDocument();
    expect(screen.getByText('Send the first message when you are ready.')).toBeInTheDocument();

    rerender(<MessageList {...props} isSearchActive />);

    expect(screen.getByRole('heading', { name: 'No matches found' })).toBeInTheDocument();
    expect(screen.getByText('Try a different name or message term.')).toBeInTheDocument();
  });

  it('renders stable skeleton rows while loading messages', () => {
    renderMessageList({ isLoading: true });

    expect(screen.getByLabelText('Loading messages')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Loading messages' })).not.toBeInTheDocument();
  });

  it('renders deduped message display and scroll/load callbacks', async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    const onScrollToBottom = vi.fn();

    renderMessageList({
      messages: [
        makeMessage({ _id: 'message-1', text: 'One canonical copy' }),
      ],
      hasMore: true,
      showScrollButton: true,
      onLoadMore,
      onScrollToBottom,
    });

    expect(screen.getAllByText('One canonical copy')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Load older messages' }));
    await user.click(screen.getByRole('button', { name: 'Scroll to bottom' }));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
    expect(onScrollToBottom).toHaveBeenCalledTimes(1);
  });

  it('labels the edit message textarea when editing', () => {
    renderMessageList({
      messages: [makeMessage({ _id: 'message-1', text: 'Editable message' })],
      editingMessageId: 'message-1',
      editText: 'Editable message',
    });

    expect(screen.getByRole('textbox', { name: 'Edit message' })).toHaveValue('Editable message');
  });

  it('keeps call activity in the durable timeline as system history', () => {
    renderMessageList({
      messages: [
        makeMessage({
          _id: 'call-activity-1',
          sender: 'user-2',
          text: '',
          messageType: 'call',
          callActivity: {
            callId: 'call-1',
            callerId: 'user-2',
            calleeId: 'user-1',
            mode: 'audio',
            result: 'missed',
            startedAt: '2026-06-13T10:00:00.000Z',
            ringingAt: '2026-06-13T10:00:01.000Z',
            answeredAt: null,
            endedAt: '2026-06-13T10:00:30.000Z',
            durationSeconds: null,
          },
          createdAt: '2026-06-13T10:00:30.000Z',
          updatedAt: '2026-06-13T10:00:30.000Z',
        }),
        makeMessage({ _id: 'message-1', text: 'Follow-up message' }),
      ],
    });

    expect(screen.getByRole('note', { name: /Missed audio call/ })).toBeInTheDocument();
    expect(screen.getByText('Follow-up message')).toBeInTheDocument();
  });
});
