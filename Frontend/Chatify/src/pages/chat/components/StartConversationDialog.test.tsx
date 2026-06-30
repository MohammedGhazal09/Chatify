import { useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeUser } from '../../../test/chatFixtures';
import type { ContactRequest } from '../../../types/chat';
import StartConversationDialog from './StartConversationDialog';

type DialogProps = ComponentProps<typeof StartConversationDialog>;

const makeProps = (overrides: Partial<DialogProps> = {}): DialogProps => ({
  isOpen: true,
  contacts: [],
  isLoading: false,
  isError: false,
  isCreatingChat: false,
  onlineUsers: new Map(),
  onSelectContact: vi.fn(),
  onStartNewChat: vi.fn(),
  onRetry: vi.fn(),
  onClose: vi.fn(),
  ...overrides,
});

const Harness = (overrides: Partial<DialogProps> = {}) => {
  const props = makeProps(overrides);
  const openerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(true);

  return (
    <>
      <button ref={openerRef} type="button" onClick={() => setIsOpen(true)}>
        Open contacts
      </button>
      <StartConversationDialog
        {...props}
        isOpen={isOpen}
        openerRef={openerRef}
        onClose={() => {
          setIsOpen(false);
          props.onClose();
        }}
      />
    </>
  );
};

const makeContactRequest = (overrides: Partial<ContactRequest> = {}): ContactRequest => ({
  _id: 'request-1',
  requester: makeUser({ _id: 'user-2', firstName: 'Grace', lastName: 'Hopper', username: 'grace.hopper' }),
  recipient: makeUser({ _id: 'user-1', firstName: 'Ada', lastName: 'Lovelace', username: 'ada.lovelace' }),
  status: 'pending',
  direction: 'incoming',
  chat: null,
  createdAt: '2026-06-30T08:00:00.000Z',
  updatedAt: '2026-06-30T08:00:00.000Z',
  respondedAt: null,
  ...overrides,
});

describe('StartConversationDialog', () => {
  it('shows the empty-contacts prompt to start a new conversation', () => {
    render(<Harness contacts={[]} />);

    expect(screen.getByRole('heading', { name: 'Start a conversation' })).toBeInTheDocument();
    expect(screen.getByText('No contacts yet')).toBeInTheDocument();
    expect(screen.getByText('Start a new conversation by entering a username.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New conversation' })).toBeInTheDocument();
  });

  it('lists available contacts and opens a conversation on click', async () => {
    const user = userEvent.setup();
    const onSelectContact = vi.fn();
    const contacts = [
      makeUser({ _id: 'user-2', firstName: 'Grace', lastName: 'Hopper', username: 'grace.hopper' }),
      makeUser({ _id: 'user-3', firstName: 'Alan', lastName: 'Turing', username: 'alan.turing' }),
    ];

    render(<Harness contacts={contacts} onSelectContact={onSelectContact} onlineUsers={new Map([['user-2', { isOnline: true }]])} />);

    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.getByText('@alan.turing')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Request or open conversation with Grace Hopper' }));

    expect(onSelectContact).toHaveBeenCalledWith('grace.hopper');
  });

  it('shows incoming request actions and outgoing cancel state', async () => {
    const user = userEvent.setup();
    const onAcceptContactRequest = vi.fn();
    const onDeclineContactRequest = vi.fn();
    const onCancelContactRequest = vi.fn();
    const incoming = makeContactRequest({ _id: 'incoming-request' });
    const outgoing = makeContactRequest({
      _id: 'outgoing-request',
      requester: makeUser({ _id: 'user-1', firstName: 'Ada', lastName: 'Lovelace', username: 'ada.lovelace' }),
      recipient: makeUser({ _id: 'user-3', firstName: 'Alan', lastName: 'Turing', username: 'alan.turing' }),
      direction: 'outgoing',
    });

    render(
      <Harness
        contacts={[]}
        contactRequests={{ incoming: [incoming], outgoing: [outgoing] }}
        onAcceptContactRequest={onAcceptContactRequest}
        onDeclineContactRequest={onDeclineContactRequest}
        onCancelContactRequest={onCancelContactRequest}
      />
    );

    expect(screen.getByText('Requests')).toBeInTheDocument();
    expect(screen.getByText('Wants to start a private chat')).toBeInTheDocument();
    expect(screen.getByText('Waiting for approval')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Accept' }));
    await user.click(screen.getByRole('button', { name: 'Decline' }));
    await user.click(screen.getByRole('button', { name: 'Cancel request' }));

    expect(onAcceptContactRequest).toHaveBeenCalledWith('incoming-request');
    expect(onDeclineContactRequest).toHaveBeenCalledWith('incoming-request');
    expect(onCancelContactRequest).toHaveBeenCalledWith('outgoing-request');
  });

  it('shows retry copy when contact requests fail to load', async () => {
    const user = userEvent.setup();
    const onRetryContactRequests = vi.fn();

    render(
      <Harness
        contacts={[]}
        isContactRequestsError
        onRetryContactRequests={onRetryContactRequests}
      />
    );

    expect(screen.getByText('Requests unavailable')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Try again' })[0]);

    expect(onRetryContactRequests).toHaveBeenCalledTimes(1);
  });

  it('delegates to the new-chat flow from the footer button', async () => {
    const user = userEvent.setup();
    const onStartNewChat = vi.fn();

    render(<Harness contacts={[]} onStartNewChat={onStartNewChat} />);

    await user.click(screen.getByRole('button', { name: 'New conversation' }));

    expect(onStartNewChat).toHaveBeenCalledTimes(1);
  });
});
