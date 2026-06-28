import { useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeUser } from '../../../test/chatFixtures';
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

    await user.click(screen.getByRole('button', { name: 'Start conversation with Grace Hopper' }));

    expect(onSelectContact).toHaveBeenCalledWith('grace.hopper');
  });

  it('delegates to the new-chat flow from the footer button', async () => {
    const user = userEvent.setup();
    const onStartNewChat = vi.fn();

    render(<Harness contacts={[]} onStartNewChat={onStartNewChat} />);

    await user.click(screen.getByRole('button', { name: 'New conversation' }));

    expect(onStartNewChat).toHaveBeenCalledTimes(1);
  });
});
